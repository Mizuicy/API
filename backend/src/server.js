import express from 'express';
import cron from 'node-cron';
import path from 'path';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import dbconfig from './db/dbconfig.js';
import { validarUsuario, validarLivro, validarAutor } from './utils/validacoes.js';
import { validateEmail, generateAuthCode, sendAuthEmail, sendWelcomeEmail, sendLoanExpiryEmail } from './utils/emailService.js';
import chatRoutes from './chat/routes/chatRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
    res.header('Access-Control-Expose-Headers', 'Content-Length, X-Kuma-Revision');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Limite aumentado para suportar imagens em base64
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos da pasta frontend/public
app.use(express.static(path.join(__dirname, '../../frontend/public')));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} -> ${req.method} ${req.url}`);
    next();
});

// ══════════════════════════════════════════════════════════════
//  MÓDULO WEBCHAT IA — Kairos Assistente Virtual
//  Rota base: /api/chat
// ══════════════════════════════════════════════════════════════
app.use('/api/chat', chatRoutes);

function handleQuery(res, err, results) {
    if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
    return res.json(results);
}

// ─────────────────────────────────────────────────────────────
// ARMAZENAMENTO EM MEMÓRIA
// authCodes  → códigos de verificação pendentes
// verifiedEmails → emails que já verificaram o código e podem resetar a senha
// ─────────────────────────────────────────────────────────────
const authCodes = new Map();      // { email → { code, expiresAt } }
const verifiedEmails = new Map(); // { email → expiresAt }  ← ✅ NOVO

// ══════════════════════════════════════════════════════════════
//  ROTAS DE USUÁRIO
// ══════════════════════════════════════════════════════════════

app.get('/usuario', (req, res) => {
    dbconfig.query('SELECT * FROM Usuario', (err, results) => {
        handleQuery(res, err, results);
    });
});

app.get('/usuario/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    dbconfig.query(
        'SELECT Usuario_id, Nome, Email, Telefone, CPF, DataNascimento, Tipo, FotoPerfil FROM Usuario WHERE Usuario_id = ?',
        [id],
        (err, results) => {
            if (err) return handleQuery(res, err);
            if (results.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
            res.json(results[0]);
        }
    );
});

// ─────────────────────────────────────────────────────────────
// CADASTRO – ✅ SENHA COM HASH (bcrypt)
// ─────────────────────────────────────────────────────────────
app.post('/usuario', async (req, res) => {
    const erro = validarUsuario(req.body);
    if (erro) return res.status(400).json({ error: erro });

    const { Nome, Email, Senha, Telefone, CPF, DataNascimento } = req.body;

    if (!DataNascimento) {
        return res.status(400).json({ error: 'Data de nascimento é obrigatória.' });
    }

    if (!validateEmail(Email)) {
        return res.status(400).json({ error: 'Email inválido.' });
    }

    try {
        // ✅ CORREÇÃO 2: hash da senha antes de salvar
        const senhaHash = await bcrypt.hash(Senha, 10);
        const normalizeOptional = (v) => (v === '' ? null : v);
        const values = [Nome, Email, senhaHash, normalizeOptional(Telefone), CPF, DataNascimento];
        const sql = `INSERT INTO Usuario (Nome, Email, Senha, Telefone, CPF, DataNascimento) VALUES (?, ?, ?, ?, ?, ?)`;

        dbconfig.query(sql, values, async (err) => {
            if (err) {
                if (err.errno === 1062) {
                    return res.status(400).json({ error: 'Este CPF ou Email já está cadastrado em nosso sistema.' });
                }
                console.error('Erro ao inserir usuário:', err);
                return res.status(500).json({ error: 'Erro interno no servidor.' });
            }

            const emailEnviado = await sendWelcomeEmail(Email, Nome);
            if (!emailEnviado) {
                console.warn('Falha ao enviar email de boas-vindas para:', Email);
            }

            res.status(201).json({ message: 'Usuário criado com sucesso!' });
        });
    } catch (err) {
        console.error('Erro ao fazer hash da senha:', err);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// ─────────────────────────────────────────────────────────────
// LOGIN – ✅ COMPARAÇÃO COM HASH (bcrypt.compare)
// ─────────────────────────────────────────────────────────────
app.post('/usuario/login', (req, res) => {
    const { Email, Senha } = req.body;
    if (!Email || !Senha) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    dbconfig.query(
        'SELECT * FROM Usuario WHERE Email = ?',
        [Email],
        async (err, results) => {
            if (err) return handleQuery(res, err);
            if (results.length === 0) {
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }

            const usuario = results[0];
            // ✅ CORREÇÃO 3: comparar senha com hash
            const senhaCorreta = await bcrypt.compare(Senha, usuario.Senha);
            if (!senhaCorreta) {
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }

            const { Senha: _, ...usuarioSemSenha } = usuario;
            res.json({ usuario: usuarioSemSenha });
        }
    );
});

// ─────────────────────────────────────────────────────────────
// ADMIN LOGIN – ✅ COMPARAÇÃO COM HASH (bcrypt.compare)
// ─────────────────────────────────────────────────────────────
app.post('/admin/login', (req, res) => {
    const { Email, Senha } = req.body;
    if (!Email || !Senha) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    dbconfig.query(
        'SELECT * FROM Usuario WHERE Email = ? AND Tipo = "admin"',
        [Email],
        async (err, results) => {
            if (err) return handleQuery(res, err);
            if (results.length === 0) {
                return res.status(401).json({ error: 'Credenciais inválidas ou sem permissão de administrador.' });
            }

            const admin = results[0];
            // ✅ CORREÇÃO 4: comparar senha com hash
            const senhaCorreta = await bcrypt.compare(Senha, admin.Senha);
            if (!senhaCorreta) {
                return res.status(401).json({ error: 'Credenciais inválidas ou sem permissão de administrador.' });
            }

            const { Senha: _, ...adminSemSenha } = admin;
            res.json({ usuario: adminSemSenha });
        }
    );
});

// ══════════════════════════════════════════════════════════════
//  FLUXO "ESQUECI MINHA SENHA"
// ══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// ETAPA 1: Gerar e enviar código
// ─────────────────────────────────────────────────────────────
app.post('/usuario/authcode', async (req, res) => {
    const { Email } = req.body;
    console.log('[authcode] Recebido pedido para:', Email);

    if (!Email || !validateEmail(Email)) {
        return res.status(400).json({ error: 'Email inválido.' });
    }

    // ✅ Verifica se o email existe no banco antes de enviar
    dbconfig.query('SELECT * FROM Usuario WHERE Email = ?', [Email], async (err, results) => {
        if (err) {
            console.error('[authcode] Erro no banco:', err);
            return res.status(500).json({ error: 'Erro interno.' });
        }
        if (results.length === 0) {
            // Retorna mensagem genérica por segurança (não expõe se o email existe ou não)
            return res.json({ message: 'Se este email estiver cadastrado, você receberá um código.' });
        }

        const code = generateAuthCode();
        console.log('[authcode] Código gerado para', Email, ':', code);

        const emailEnviado = await sendAuthEmail(Email, code);
        if (!emailEnviado) {
            console.error('[authcode] Falha ao enviar email para:', Email);
            return res.status(500).json({ error: 'Falha ao enviar código de autenticação. Verifique as configurações de email.' });
        }

        authCodes.set(Email.toLowerCase(), { code, expiresAt: Date.now() + 10 * 60 * 1000 });
        console.log('[authcode] Email enviado com sucesso para:', Email);
        res.json({ message: 'Código de autenticação enviado para o email.' });
    });
});

// ─────────────────────────────────────────────────────────────
// ETAPA 2: Verificar código
// ─────────────────────────────────────────────────────────────
app.post('/usuario/authcode/verify', (req, res) => {
    const { Email, Codigo } = req.body;
    console.log('[authcode/verify] Verificando código para:', Email);

    if (!Email || !Codigo) {
        return res.status(400).json({ error: 'Email e código são obrigatórios.' });
    }

    const emailKey = Email.toLowerCase();
    const saved = authCodes.get(emailKey);

    if (!saved) {
        console.warn('[authcode/verify] Nenhum código encontrado para:', Email);
        return res.status(401).json({ error: 'Código inválido ou não solicitado.' });
    }

    if (Date.now() > saved.expiresAt) {
        authCodes.delete(emailKey);
        console.warn('[authcode/verify] Código expirado para:', Email);
        return res.status(401).json({ error: 'Código expirado. Solicite um novo.' });
    }

    if (saved.code !== Codigo) {
        console.warn('[authcode/verify] Código incorreto para:', Email);
        return res.status(401).json({ error: 'Código inválido.' });
    }

    // ✅ CORREÇÃO 5: após verificar o código, marca o email como autorizado a resetar
    authCodes.delete(emailKey);
    verifiedEmails.set(emailKey, Date.now() + 15 * 60 * 1000); // 15 min para completar o reset
    console.log('[authcode/verify] Código correto! Email autorizado:', Email);

    // ✅ FIX: Retorna dados do usuario para o frontend salvar usuarioId na sessão
    dbconfig.query('SELECT Usuario_id, Nome, Email, Tipo FROM Usuario WHERE Email = ?', [Email], (errU, rowsU) => {
        if (errU || !rowsU.length) return res.json({ message: 'Código verificado com sucesso.' });
        res.json({ message: 'Código verificado com sucesso.', usuario: rowsU[0] });
    });
});

// ─────────────────────────────────────────────────────────────
// ETAPA 3: Redefinir senha
// ✅ CORREÇÃO 6: só permite resetar se o código foi verificado (no backend!)
// ✅ CORREÇÃO 7: salva a nova senha com hash bcrypt
// ─────────────────────────────────────────────────────────────
app.post('/usuario/reset-password', async (req, res) => {
    const { Email, Senha } = req.body;
    console.log('[reset-password] Pedido de reset para:', Email);

    if (!Email || !Senha) {
        return res.status(400).json({ error: 'Email e nova senha são obrigatórios.' });
    }

    if (!validateEmail(Email)) {
        return res.status(400).json({ error: 'Email inválido.' });
    }

    if (Senha.length < 8 || !/[A-Z]/.test(Senha) || !/[a-z]/.test(Senha) || !/[0-9]/.test(Senha)) {
        return res.status(400).json({
            error: 'Senha deve ter mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas e números.'
        });
    }

    // ✅ CORREÇÃO 6: verificar no BACKEND se o código foi validado
    const emailKey = Email.toLowerCase();
    const verifiedAt = verifiedEmails.get(emailKey);

    if (!verifiedAt) {
        console.warn('[reset-password] Email não autorizado (código não verificado):', Email);
        return res.status(403).json({ error: 'Código de verificação não validado. Reinicie o processo.' });
    }

    if (Date.now() > verifiedAt) {
        verifiedEmails.delete(emailKey);
        console.warn('[reset-password] Autorização expirada para:', Email);
        return res.status(403).json({ error: 'Tempo de redefinição expirado. Solicite um novo código.' });
    }

    try {
        // ✅ CORREÇÃO 7: hash da nova senha antes de salvar
        const senhaHash = await bcrypt.hash(Senha, 10);

        dbconfig.query('SELECT * FROM Usuario WHERE Email = ?', [Email], (err, results) => {
            if (err) return handleQuery(res, err);
            if (!results.length) {
                return res.status(404).json({ error: 'Usuário não encontrado.' });
            }

            dbconfig.query(
                'UPDATE Usuario SET Senha = ? WHERE Email = ?',
                [senhaHash, Email],
                (err2, result) => {
                    if (err2) return handleQuery(res, err2);
                    if (result.affectedRows === 0) {
                        return res.status(500).json({ error: 'Falha ao atualizar a senha.' });
                    }

                    // ✅ CORREÇÃO 8: invalidar token após uso
                    verifiedEmails.delete(emailKey);
                    console.log('[reset-password] Senha atualizada com sucesso para:', Email);
                    res.json({ message: 'Senha redefinida com sucesso.' });
                }
            );
        });
    } catch (err) {
        console.error('[reset-password] Erro ao fazer hash:', err);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// ══════════════════════════════════════════════════════════════
//  DEMAIS ROTAS DE USUÁRIO
// ══════════════════════════════════════════════════════════════

app.delete('/usuario/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    dbconfig.query('DELETE FROM Usuario WHERE Usuario_id = ?', [id], (err, result) => {
        if (err) return handleQuery(res, err);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }
        res.status(204).send();
    });
});

app.put('/usuario/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    // Email é imutável — ignorado mesmo que enviado no body
    const { Nome, Senha, FotoPerfil } = req.body;

    console.log(`[PUT /usuario/${id}] Payload recebido: Nome=${Nome}, Senha=${Senha ? '***' : 'não enviada'}, FotoPerfil=${FotoPerfil ? FotoPerfil.substring(0, 30) + '...' : 'null'}`);

    // Valida FotoPerfil: aceita null, string vazia ou data URL de imagem
    const fotoFinal = (FotoPerfil && typeof FotoPerfil === 'string' && FotoPerfil.trim())
        ? FotoPerfil.trim()
        : null;

    // Valida tamanho da foto (MEDIUMTEXT suporta até 16MB; base64 de 5MB ≈ 6.7MB)
    if (fotoFinal && Buffer.byteLength(fotoFinal, 'utf8') > 15 * 1024 * 1024) {
        return res.status(400).json({ error: 'Imagem muito grande. Máximo 10MB.' });
    }

    // Valida senha se fornecida
    if (Senha) {
        if (Senha.length < 6) return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    try {
        // Busca dados atuais do usuário para preservar campos não alterados
        const atual = await new Promise((resolve, reject) => {
            dbconfig.query(
                'SELECT Usuario_id, Nome, Email, Telefone, CPF, DataNascimento, Tipo, FotoPerfil FROM Usuario WHERE Usuario_id = ?',
                [id],
                (err, rows) => {
                    if (err) {
                        console.error('[PUT /usuario] Erro ao buscar usuário atual:', err);
                        reject(err);
                    } else {
                        resolve(rows[0] || null);
                    }
                }
            );
        });

        if (!atual) return res.status(404).json({ error: 'Usuário não encontrado.' });

        // Apenas Nome e FotoPerfil são editáveis pelo perfil.
        // CPF, Telefone e DataNascimento NUNCA são sobrescritos por este endpoint —
        // sempre mantemos os valores atuais do banco para evitar violação de NOT NULL/UNIQUE.
        const nomeUsar     = (Nome && typeof Nome === 'string' && Nome.trim()) ? Nome.trim() : atual.Nome;
        const telefoneUsar = atual.Telefone;      // imutável neste endpoint
        const cpfUsar      = atual.CPF;           // imutável neste endpoint
        const dataNascUsar = atual.DataNascimento; // imutável neste endpoint
        const fotoUsar     = (FotoPerfil !== undefined) ? fotoFinal : atual.FotoPerfil;

        console.log(`[PUT /usuario/${id}] Valores finais: Nome=${nomeUsar}, CPF=${cpfUsar}, DataNasc=${dataNascUsar}, Foto=${fotoUsar ? 'presente' : 'null'}`);

        const finalizar = (err, result) => {
            if (err) {
                console.error(`[PUT /usuario/${id}] Erro no UPDATE:`, err.message, err.code, err.sqlMessage);
                return res.status(500).json({ error: 'Erro ao salvar. Detalhe: ' + (err.sqlMessage || err.message) });
            }
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
            dbconfig.query(
                'SELECT Usuario_id, Nome, Email, Telefone, CPF, DataNascimento, Tipo, FotoPerfil FROM Usuario WHERE Usuario_id = ?',
                [id],
                (err2, rows) => {
                    if (err2 || !rows.length) return res.json({ Usuario_id: id, Nome: nomeUsar, FotoPerfil: fotoUsar });
                    console.log(`[PUT /usuario/${id}] Update concluído com sucesso.`);
                    res.json(rows[0]);
                }
            );
        };

        if (Senha) {
            const senhaHash = await bcrypt.hash(Senha, 10);
            const sql = `UPDATE Usuario
                         SET Nome = ?, Senha = ?, Telefone = ?, CPF = ?, DataNascimento = ?, FotoPerfil = ?
                         WHERE Usuario_id = ?`;
            dbconfig.query(sql, [nomeUsar, senhaHash, telefoneUsar, cpfUsar, dataNascUsar, fotoUsar, id], finalizar);
        } else {
            const sql = `UPDATE Usuario
                         SET Nome = ?, Telefone = ?, CPF = ?, DataNascimento = ?, FotoPerfil = ?
                         WHERE Usuario_id = ?`;
            dbconfig.query(sql, [nomeUsar, telefoneUsar, cpfUsar, dataNascUsar, fotoUsar, id], finalizar);
        }
    } catch (err) {
        console.error(`[PUT /usuario/${id}] Exceção capturada:`, err);
        res.status(500).json({ error: 'Erro interno no servidor. Detalhe: ' + err.message });
    }
});

// ══════════════════════════════════════════════════════════════
//  ROTAS DE LIVROS
// ══════════════════════════════════════════════════════════════

// ── Helper: normaliza array de gêneros vindo do body ─────────
function normalizarGeneros(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(g => String(g).trim()).filter(Boolean);
    // string separada por vírgula (fallback)
    return String(raw).split(',').map(g => g.trim()).filter(Boolean);
}

// ── Helper: busca/cria gêneros e devolve array de IDs ────────
function resolverGenerosIds(nomes, cb) {
    if (!nomes || nomes.length === 0) return cb(null, []);
    const ids = [];
    let pending = nomes.length;

    nomes.forEach(nome => {
        dbconfig.query(
            'INSERT IGNORE INTO Genero (Nome) VALUES (?)',
            [nome],
            (errIns) => {
                if (errIns) return cb(errIns);
                dbconfig.query('SELECT Genero_id FROM Genero WHERE Nome = ?', [nome], (errSel, rows) => {
                    if (errSel) return cb(errSel);
                    if (rows.length) ids.push(rows[0].Genero_id);
                    if (--pending === 0) cb(null, ids);
                });
            }
        );
    });
}

// ── Helper: salva relacionamento LivroGenero (apaga e reinseere) ─
function salvarLivroGeneros(livroId, generoIds, cb) {
    dbconfig.query('DELETE FROM LivroGenero WHERE Livro_id = ?', [livroId], (errDel) => {
        if (errDel) return cb(errDel);
        if (!generoIds.length) return cb(null);
        const rows = generoIds.map(gid => [livroId, gid]);
        dbconfig.query('INSERT IGNORE INTO LivroGenero (Livro_id, Genero_id) VALUES ?', [rows], cb);
    });
}

// ── Helper: salva relacionamento ExemplarGenero ──────────────
function salvarExemplarGeneros(exemplarId, generoIds, cb) {
    dbconfig.query('DELETE FROM ExemplarGenero WHERE Exemplar_id = ?', [exemplarId], (errDel) => {
        if (errDel) return cb(errDel);
        if (!generoIds.length) return cb(null);
        const rows = generoIds.map(gid => [exemplarId, gid]);
        dbconfig.query('INSERT IGNORE INTO ExemplarGenero (Exemplar_id, Genero_id) VALUES ?', [rows], cb);
    });
}

// ── Helper: anexa array de gêneros a cada livro (query única) ─
function anexarGeneroLivros(livros, cb) {
    if (!livros.length) return cb(null, livros);
    const ids = livros.map(l => l.Livro_id);
    const sql = `
        SELECT lg.Livro_id, g.Genero_id, g.Nome AS GeneroNome
        FROM LivroGenero lg
        JOIN Genero g ON g.Genero_id = lg.Genero_id
        WHERE lg.Livro_id IN (?)
        ORDER BY g.Nome
    `;
    dbconfig.query(sql, [ids], (err, rows) => {
        if (err) return cb(err);
        const map = {};
        rows.forEach(r => {
            if (!map[r.Livro_id]) map[r.Livro_id] = [];
            map[r.Livro_id].push({ Genero_id: r.Genero_id, Nome: r.GeneroNome });
        });
        livros.forEach(l => {
            l.Generos = map[l.Livro_id] || [];
            // mantém Categoria para compatibilidade com código legado
            if (!l.Categoria && l.Generos.length) l.Categoria = l.Generos[0].Nome;
        });
        cb(null, livros);
    });
}

// ──────────────────────────────────────────────────────────────
//  GET /genero — lista todos os gêneros cadastrados
// ──────────────────────────────────────────────────────────────
app.get('/genero', (req, res) => {
    dbconfig.query('SELECT Genero_id, Nome FROM Genero ORDER BY Nome', (err, results) => {
        if (err) return handleQuery(res, err);
        res.json(results);
    });
});

// ──────────────────────────────────────────────────────────────
//  GET /livro — lista todos os livros com seus gêneros
//  Query params: busca, genero_id, genero (nome)
// ──────────────────────────────────────────────────────────────
app.get('/livro', (req, res) => {
    const busca    = req.query.busca || req.query.search || '';
    const generoId = req.query.genero_id ? parseInt(req.query.genero_id, 10) : null;
    const generoNm = req.query.genero || '';

    let sql = `
        SELECT DISTINCT l.*
        FROM Livro l
    `;
    const params = [];

    // Se filtro por gênero, faz JOIN com LivroGenero
    if (generoId || generoNm) {
        sql += ` JOIN LivroGenero lg ON lg.Livro_id = l.Livro_id
                 JOIN Genero g ON g.Genero_id = lg.Genero_id`;
    }

    const conds = [];
    if (busca) {
        conds.push('(l.Nome LIKE ? OR l.Autor LIKE ? OR l.Editora LIKE ?)');
        const s = `%${busca}%`;
        params.push(s, s, s);
    }
    if (generoId) {
        conds.push('lg.Genero_id = ?');
        params.push(generoId);
    }
    if (generoNm) {
        conds.push('g.Nome LIKE ?');
        params.push(`%${generoNm}%`);
    }

    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' ORDER BY l.Nome';

    dbconfig.query(sql, params, (err, livros) => {
        if (err) return handleQuery(res, err);
        anexarGeneroLivros(livros, (err2, result) => {
            if (err2) return handleQuery(res, err2);
            res.json(result);
        });
    });
});

// ──────────────────────────────────────────────────────────────
//  GET /livro/:id — detalhe de um livro com seus gêneros
// ──────────────────────────────────────────────────────────────
app.get('/livro/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    dbconfig.query('SELECT * FROM Livro WHERE Livro_id = ?', [id], (err, results) => {
        if (err) return handleQuery(res, err);
        if (results.length === 0) return res.status(404).json({ message: 'Livro não encontrado' });
        anexarGeneroLivros(results, (err2, livros) => {
            if (err2) return handleQuery(res, err2);
            res.json(livros[0]);
        });
    });
});

// ──────────────────────────────────────────────────────────────
//  POST /livro — cadastra livro com múltiplos gêneros
// ──────────────────────────────────────────────────────────────
app.post('/livro', (req, res) => {
    const erro = validarLivro(req.body);
    if (erro) return res.status(400).json({ error: erro });

    const { Nome, Autor, Editora, AnoPublicacao, Idioma, NumeroPaginas, ClassEtaria,
            Categoria, Resumo, Imagem, NumeroChamada, DataPublicacao } = req.body;

    const nomeGeneros = normalizarGeneros(req.body.Generos || req.body.generos || Categoria);

    // Mantém Categoria com o primeiro gênero para compatibilidade
    const categoriaSalvar = nomeGeneros.length ? nomeGeneros[0] : (Categoria || null);

    const sql = `INSERT INTO Livro
        (Nome, Autor, Editora, AnoPublicacao, Idioma, NumeroPaginas, ClassEtaria, Categoria, Resumo, Imagem, NumeroChamada, DataPublicacao)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [Nome, Autor || null, Editora || null, AnoPublicacao || null,
        Idioma || null, NumeroPaginas || null, ClassEtaria || null, categoriaSalvar,
        Resumo || null, Imagem || null, NumeroChamada || null, DataPublicacao || null];

    dbconfig.query(sql, values, (err, result) => {
        if (err) {
            console.error('Erro ao inserir livro:', err);
            return res.status(500).json({ error: 'Erro interno no servidor.' });
        }
        const livroId = result.insertId;

        resolverGenerosIds(nomeGeneros, (errG, ids) => {
            if (errG) {
                console.error('Erro ao resolver gêneros:', errG);
                return res.status(201).json({ Livro_id: livroId, ...req.body, Generos: [] });
            }
            salvarLivroGeneros(livroId, ids, (errSalvar) => {
                if (errSalvar) console.error('Erro ao salvar LivroGenero:', errSalvar);
                res.status(201).json({ Livro_id: livroId, ...req.body, Generos: nomeGeneros });
            });
        });
    });
});

// ──────────────────────────────────────────────────────────────
//  PUT /livro/:id — atualiza livro e seus gêneros
// ──────────────────────────────────────────────────────────────
app.put('/livro/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const erro = validarLivro(req.body);
    if (erro) return res.status(400).json({ error: erro });

    const { Nome, Autor, Editora, AnoPublicacao, Idioma, NumeroPaginas, ClassEtaria,
            Categoria, Resumo, Imagem, NumeroChamada, DataPublicacao } = req.body;

    const nomeGeneros = normalizarGeneros(req.body.Generos || req.body.generos || Categoria);
    const categoriaSalvar = nomeGeneros.length ? nomeGeneros[0] : (Categoria || null);

    const sql = `UPDATE Livro SET
        Nome = ?, Autor = ?, Editora = ?, AnoPublicacao = ?, Idioma = ?,
        NumeroPaginas = ?, ClassEtaria = ?, Categoria = ?, Resumo = ?,
        Imagem = ?, NumeroChamada = ?, DataPublicacao = ?
        WHERE Livro_id = ?`;
    const values = [Nome, Autor || null, Editora || null, AnoPublicacao || null,
        Idioma || null, NumeroPaginas || null, ClassEtaria || null, categoriaSalvar,
        Resumo || null, Imagem || null, NumeroChamada || null, DataPublicacao || null, id];

    dbconfig.query(sql, values, (err, result) => {
        if (err) return handleQuery(res, err);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Livro não encontrado' });

        resolverGenerosIds(nomeGeneros, (errG, ids) => {
            if (errG) {
                console.error('Erro ao resolver gêneros:', errG);
                return res.json({ Livro_id: id, ...req.body, Generos: nomeGeneros });
            }
            salvarLivroGeneros(id, ids, (errSalvar) => {
                if (errSalvar) console.error('Erro ao salvar LivroGenero:', errSalvar);
                res.json({ Livro_id: id, ...req.body, Generos: nomeGeneros });
            });
        });
    });
});

// ──────────────────────────────────────────────────────────────
//  DELETE /livro/:id
// ──────────────────────────────────────────────────────────────
app.delete('/livro/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    // LivroGenero será excluído em cascata (FK ON DELETE CASCADE)
    dbconfig.query('DELETE FROM Livro WHERE Livro_id = ?', [id], (err, result) => {
        if (err) return handleQuery(res, err);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Livro não encontrado' });
        res.status(204).send();
    });
});


// ══════════════════════════════════════════════════════════════
//  ROTAS DE EMPRÉSTIMOS
// ══════════════════════════════════════════════════════════════

// Helper: atualiza status de empréstimos vencidos para 'atrasado'
function atualizarAtrasados(cb) {
    dbconfig.query(
        "UPDATE Emprestimo SET Status = 'atrasado' WHERE DataPrevista < CURDATE() AND Status = 'ativo'",
        cb
    );
}

// ─────────────────────────────────────────────────────────────
// GET /emprestimo — lista todos (admin) ou filtrado por usuário
// GET /emprestimo?usuario=ID
// ─────────────────────────────────────────────────────────────
app.get('/emprestimo', (req, res) => {
    atualizarAtrasados(() => {
        const usuarioId = req.query.usuario ? parseInt(req.query.usuario, 10) : null;

        let sql = `
            SELECT
                e.Emprestimo_id,
                e.DataSaida     AS DataEmprestimo,
                e.DataPrevista,
                e.DataDevolucao,
                e.Status,
                e.Usuario_id,
                e.Exemplar_id,
                ex.Livro_id,
                u.Nome          AS NomeUsuario,
                u.Email         AS EmailUsuario,
                l.Nome          AS NomeLivro,
                l.Autor         AS AutorLivro,
                l.Imagem        AS CapaLivro
            FROM Emprestimo e
            LEFT JOIN Exemplar ex ON e.Exemplar_id = ex.Exemplar_id
            LEFT JOIN Livro    l  ON ex.Livro_id   = l.Livro_id
            LEFT JOIN Usuario  u  ON e.Usuario_id  = u.Usuario_id
        `;
        const params = [];

        if (usuarioId) {
            sql += ' WHERE e.Usuario_id = ?';
            params.push(usuarioId);
        }

        sql += ' ORDER BY e.DataSaida DESC';

        dbconfig.query(sql, params, (err, results) => handleQuery(res, err, results));
    });
});



// ============================================================
//  ROTA: EMPRESTIMOS PROXIMOS DO VENCIMENTO (2 dias)
//  GET /emprestimo/vencendo?usuario=ID
// ============================================================
app.get('/emprestimo/vencendo', (req, res) => {
    const usuarioId = req.query.usuario ? parseInt(req.query.usuario, 10) : null;
    const params = [];

    let sql = `
        SELECT
            e.Emprestimo_id,
            e.DataPrevista,
            e.Status,
            e.Usuario_id,
            u.Nome   AS NomeUsuario,
            u.Email  AS EmailUsuario,
            l.Nome   AS NomeLivro
        FROM Emprestimo e
        LEFT JOIN Exemplar ex ON e.Exemplar_id = ex.Exemplar_id
        LEFT JOIN Livro    l  ON ex.Livro_id   = l.Livro_id
        LEFT JOIN Usuario  u  ON e.Usuario_id  = u.Usuario_id
        WHERE e.Status = 'ativo'
          AND DATEDIFF(e.DataPrevista, CURDATE()) BETWEEN 0 AND 2
    `;

    if (usuarioId) {
        sql += ' AND e.Usuario_id = ?';
        params.push(usuarioId);
    }

    sql += ' ORDER BY e.DataPrevista ASC';

    dbconfig.query(sql, params, (err, results) => {
        if (err) return handleQuery(res, err);
        res.json(results);
    });
});

// POST /emprestimo/vencendo/notificar
// Dispara emails de aviso para emprestimos vencendo em ate 2 dias
// Chamado pelo cron job externo
app.post('/emprestimo/vencendo/notificar', async (req, res) => {
    const sql = `
        SELECT
            e.Emprestimo_id,
            e.DataPrevista,
            u.Nome  AS NomeUsuario,
            u.Email AS EmailUsuario,
            l.Nome  AS NomeLivro
        FROM Emprestimo e
        LEFT JOIN Exemplar ex ON e.Exemplar_id = ex.Exemplar_id
        LEFT JOIN Livro    l  ON ex.Livro_id   = l.Livro_id
        LEFT JOIN Usuario  u  ON e.Usuario_id  = u.Usuario_id
        WHERE e.Status = 'ativo'
          AND DATEDIFF(e.DataPrevista, CURDATE()) = 2
    `;

    dbconfig.query(sql, async (err, emprestimos) => {
        if (err) {
            console.error('[vencendo/notificar] Erro no banco:', err);
            return res.status(500).json({ error: 'Erro interno.' });
        }

        if (!emprestimos.length) {
            console.log('[vencendo/notificar] Nenhum emprestimo vencendo em 2 dias.');
            return res.json({ message: 'Nenhum emprestimo a notificar.', enviados: 0 });
        }

        let enviados = 0;
        for (const emp of emprestimos) {
            const ok = await sendLoanExpiryEmail(
                emp.EmailUsuario,
                emp.NomeUsuario,
                emp.NomeLivro,
                emp.DataPrevista
            );
            if (ok) enviados++;
        }

        console.log('[vencendo/notificar] ' + enviados + '/' + emprestimos.length + ' emails enviados.');
        res.json({ message: 'Notificacoes enviadas.', total: emprestimos.length, enviados });
    });
});

// ─────────────────────────────────────────────────────────────
// GET /emprestimo/:id — busca um empréstimo específico
// ─────────────────────────────────────────────────────────────
app.get('/emprestimo/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const sql = `
        SELECT
            e.Emprestimo_id,
            e.DataSaida     AS DataEmprestimo,
            e.DataPrevista,
            e.DataDevolucao,
            e.Status,
            e.Usuario_id,
            e.Exemplar_id,
            ex.Livro_id,
            u.Nome          AS NomeUsuario,
            u.Email         AS EmailUsuario,
            l.Nome          AS NomeLivro,
            l.Autor         AS AutorLivro,
            l.Imagem        AS CapaLivro
        FROM Emprestimo e
        LEFT JOIN Exemplar ex ON e.Exemplar_id = ex.Exemplar_id
        LEFT JOIN Livro    l  ON ex.Livro_id   = l.Livro_id
        LEFT JOIN Usuario  u  ON e.Usuario_id  = u.Usuario_id
        WHERE e.Emprestimo_id = ?
    `;

    dbconfig.query(sql, [id], (err, results) => {
        if (err) return handleQuery(res, err);
        if (!results.length) return res.status(404).json({ error: 'Empréstimo não encontrado.' });
        res.json(results[0]);
    });
});

// ─────────────────────────────────────────────────────────────
// POST /emprestimo — solicitar empréstimo
// Body: { Usuario_id, Livro_id, DataPrevista? }
// ─────────────────────────────────────────────────────────────
app.post('/emprestimo', (req, res) => {
    const { Usuario_id, Livro_id, DataPrevista } = req.body;

    if (!Usuario_id || !Livro_id) {
        return res.status(400).json({ error: 'Usuario_id e Livro_id são obrigatórios.' });
    }

    // Verifica se o usuário já tem um empréstimo ativo deste livro
    const sqlDuplicado = `
        SELECT e.Emprestimo_id FROM Emprestimo e
        JOIN Exemplar ex ON e.Exemplar_id = ex.Exemplar_id
        WHERE e.Usuario_id = ? AND ex.Livro_id = ? AND e.Status IN ('ativo', 'atrasado')
    `;

    dbconfig.query(sqlDuplicado, [Usuario_id, Livro_id], (err, duplicados) => {
        if (err) return handleQuery(res, err);
        if (duplicados.length > 0) {
            return res.status(400).json({ error: 'Você já possui um empréstimo ativo deste livro.' });
        }

        // Busca um exemplar disponível para este livro
        dbconfig.query(
            "SELECT Exemplar_id FROM Exemplar WHERE Livro_id = ? AND Status = 'Disponivel' LIMIT 1",
            [Livro_id],
            (err2, exemplares) => {
                if (err2) return handleQuery(res, err2);
                if (!exemplares.length) {
                    return res.status(409).json({ error: 'Não há exemplares disponíveis para este livro no momento.' });
                }

                const exemplarId = exemplares[0].Exemplar_id;

                // Data de hoje e data prevista (+14 dias por padrão)
                const hoje = new Date();
                const dataSaida = hoje.toISOString().split('T')[0];
                const dataPrevista = DataPrevista || (() => {
                    const d = new Date(hoje);
                    d.setDate(d.getDate() + 14);
                    return d.toISOString().split('T')[0];
                })();

                const sqlInsert = `
                    INSERT INTO Emprestimo (DataSaida, DataPrevista, Status, Usuario_id, Exemplar_id)
                    VALUES (?, ?, 'ativo', ?, ?)
                `;


                dbconfig.query(sqlInsert, [dataSaida, dataPrevista, Usuario_id, exemplarId], (err3, result) => {
                    if (err3) {
                        console.error('Erro ao criar emprestimo:', err3);
                        return res.status(500).json({ error: 'Erro interno ao registrar o emprestimo.' });
                    }

                    // Atualiza o exemplar para 'Emprestado'
                    dbconfig.query(
                        "UPDATE Exemplar SET Status = 'Emprestado' WHERE Exemplar_id = ?",
                        [exemplarId],
                        (err4) => {
                            if (err4) console.error('Aviso: falha ao atualizar status do exemplar:', err4);
                        }
                    );

                    // ✅ FIX: diff de datas sem bug de fuso horário
                    const hojeStr = new Date().toISOString().split('T')[0];
                    const [hy, hm, hd] = hojeStr.split('-').map(Number);
                    const [py, pm, pd] = dataPrevista.split('-').map(Number);
                    const diffDias = Math.round((Date.UTC(py, pm-1, pd) - Date.UTC(hy, hm-1, hd)) / 86400000);
                    if (diffDias <= 2 && diffDias >= 0) {
                        // Busca email/nome do usuario para notificar
                        dbconfig.query(
                            'SELECT Nome, Email FROM Usuario WHERE Usuario_id = ?',
                            [Usuario_id],
                            async (errU, rowsU) => {
                                if (!errU && rowsU.length) {
                                    const u = rowsU[0];
                                    dbconfig.query(
                                        'SELECT Nome FROM Livro WHERE Livro_id = ?',
                                        [Livro_id],
                                        async (errL, rowsL) => {
                                            const nomeLivro = (!errL && rowsL.length) ? rowsL[0].Nome : 'Livro';
                                            await sendLoanExpiryEmail(u.Email, u.Nome, nomeLivro, dataPrevista);
                                            console.log('[emprestimo] Email de vencimento imediato enviado para:', u.Email);
                                            // ✅ FIX: Persiste notificação no banco
                                            const diasTexto = diffDias === 0 ? 'hoje' : `em ${diffDias} dia(s)`;
                                            const msgNotif = `Seu empréstimo do livro "${nomeLivro}" vence ${diasTexto}. Por favor, devolva até ${dataPrevista}.`;
                                            dbconfig.query(
                                                'INSERT INTO Notificacao (Usuario_id, Emprestimo_id, Tipo, Mensagem) VALUES (?, ?, ?, ?)',
                                                [Usuario_id, result.insertId, 'vencimento', msgNotif],
                                                (errN) => { if (errN) console.error('[emprestimo] Erro ao persistir notificação:', errN.message); }
                                            );
                                        }
                                    );
                                }
                            }
                        );
                    }

                    res.status(201).json({
                        Emprestimo_id: result.insertId,
                        DataEmprestimo: dataSaida,
                        DataPrevista: dataPrevista,
                        Status: 'ativo',
                        Usuario_id,
                        Livro_id,
                        Exemplar_id: exemplarId
                    });
                });

            }
        );
    });
});

// ─────────────────────────────────────────────────────────────
// PUT /emprestimo/:id — atualizar (devolver ou alterar status)
// Body: { Status?, DataDevolucao? }
// ─────────────────────────────────────────────────────────────
app.put('/emprestimo/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const { Status, DataDevolucao } = req.body;
    const statusValidos = ['ativo', 'devolvido', 'atrasado'];
    if (Status && !statusValidos.includes(Status)) {
        return res.status(400).json({ error: 'Status inválido. Use: ativo, devolvido ou atrasado.' });
    }

    // Busca o empréstimo atual para pegar o Exemplar_id
    dbconfig.query('SELECT * FROM Emprestimo WHERE Emprestimo_id = ?', [id], (err, rows) => {
        if (err) return handleQuery(res, err);
        if (!rows.length) return res.status(404).json({ error: 'Empréstimo não encontrado.' });

        const emp = rows[0];
        const novoStatus = Status || emp.Status;
        const novaData = DataDevolucao !== undefined ? DataDevolucao : emp.DataDevolucao;

        dbconfig.query(
            'UPDATE Emprestimo SET Status = ?, DataDevolucao = ? WHERE Emprestimo_id = ?',
            [novoStatus, novaData, id],
            (err2) => {
                if (err2) return handleQuery(res, err2);

                // Se devolvido, libera o exemplar
                if (novoStatus === 'devolvido' && emp.Exemplar_id) {
                    dbconfig.query(
                        "UPDATE Exemplar SET Status = 'Disponivel' WHERE Exemplar_id = ?",
                        [emp.Exemplar_id],
                        (err3) => {
                            if (err3) console.error('Aviso: falha ao liberar exemplar:', err3);
                        }
                    );
                }

                res.json({ message: 'Empréstimo atualizado com sucesso.', Emprestimo_id: id, Status: novoStatus });
            }
        );
    });
});

// ─────────────────────────────────────────────────────────────
// DELETE /emprestimo/:id — remover empréstimo
// ─────────────────────────────────────────────────────────────
app.delete('/emprestimo/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    // Busca exemplar antes de deletar para liberar
    dbconfig.query('SELECT Exemplar_id, Status FROM Emprestimo WHERE Emprestimo_id = ?', [id], (err, rows) => {
        if (err) return handleQuery(res, err);
        if (!rows.length) return res.status(404).json({ error: 'Empréstimo não encontrado.' });

        const { Exemplar_id, Status } = rows[0];

        dbconfig.query('DELETE FROM Emprestimo WHERE Emprestimo_id = ?', [id], (err2) => {
            if (err2) return handleQuery(res, err2);

            // Libera o exemplar se estava ativo/atrasado
            if (Exemplar_id && Status !== 'devolvido') {
                dbconfig.query(
                    "UPDATE Exemplar SET Status = 'Disponivel' WHERE Exemplar_id = ?",
                    [Exemplar_id],
                    () => {}
                );
            }

            res.status(204).send();
        });
    });
});



// ══════════════════════════════════════════════════════════════
//  ROTAS DE EXEMPLARES
// ══════════════════════════════════════════════════════════════

// ── Helper: anexa gêneros a exemplares ───────────────────────
function anexarGeneroExemplares(exemplares, cb) {
    if (!exemplares.length) return cb(null, exemplares);
    const ids = exemplares.map(e => e.Exemplar_id);
    const sql = `
        SELECT eg.Exemplar_id, g.Genero_id, g.Nome AS GeneroNome
        FROM ExemplarGenero eg
        JOIN Genero g ON g.Genero_id = eg.Genero_id
        WHERE eg.Exemplar_id IN (?)
        ORDER BY g.Nome
    `;
    dbconfig.query(sql, [ids], (err, rows) => {
        if (err) return cb(err);
        const map = {};
        rows.forEach(r => {
            if (!map[r.Exemplar_id]) map[r.Exemplar_id] = [];
            map[r.Exemplar_id].push({ Genero_id: r.Genero_id, Nome: r.GeneroNome });
        });
        exemplares.forEach(e => { e.Generos = map[e.Exemplar_id] || []; });
        cb(null, exemplares);
    });
}

// GET /exemplar — lista todos os exemplares com info do livro e gêneros
// GET /exemplar?livro_id=ID — filtra por livro
// GET /exemplar?status=Disponivel — filtra por status
// GET /exemplar?genero_id=ID — filtra por gênero
// GET /exemplar?genero=Nome — filtra por nome do gênero
app.get('/exemplar', (req, res) => {
    const busca    = req.query.busca || req.query.search || '';
    const { livro_id, status } = req.query;
    const generoId = req.query.genero_id ? parseInt(req.query.genero_id, 10) : null;
    const generoNm = req.query.genero || '';

    let sql = `
        SELECT DISTINCT
            ex.Exemplar_id,
            ex.Status,
            ex.Localizacao,
            ex.NumeroTombo,
            ex.Observacoes,
            ex.DataAquisicao,
            ex.CriadoEm,
            ex.Livro_id,
            l.Nome      AS NomeLivro,
            l.Autor     AS AutorLivro,
            l.Imagem    AS CapaLivro
        FROM Exemplar ex
        LEFT JOIN Livro l ON ex.Livro_id = l.Livro_id
    `;
    const values = [];

    if (generoId || generoNm) {
        sql += ` JOIN ExemplarGenero eg ON eg.Exemplar_id = ex.Exemplar_id
                 JOIN Genero gf ON gf.Genero_id = eg.Genero_id`;
    }

    const conditions = [];
    if (livro_id) { conditions.push('ex.Livro_id = ?'); values.push(parseInt(livro_id, 10)); }
    if (status)   { conditions.push('ex.Status = ?');   values.push(status); }
    if (busca) {
        conditions.push('(l.Nome LIKE ? OR ex.NumeroTombo LIKE ? OR ex.Localizacao LIKE ?)');
        const s = `%${busca}%`;
        values.push(s, s, s);
    }
    if (generoId) { conditions.push('eg.Genero_id = ?');    values.push(generoId); }
    if (generoNm) { conditions.push('gf.Nome LIKE ?');       values.push(`%${generoNm}%`); }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY ex.Exemplar_id DESC';

    dbconfig.query(sql, values, (errData, rows) => {
        if (errData) return handleQuery(res, errData);
        anexarGeneroExemplares(rows, (err2, result) => {
            if (err2) return handleQuery(res, err2);
            res.json(result);
        });
    });
});

// GET /exemplar/stats — estatísticas de exemplares
app.get('/exemplar/stats', (req, res) => {
    const sql = `
        SELECT
            COUNT(*) AS total,
            SUM(Status = 'Disponivel')  AS disponivel,
            SUM(Status = 'Emprestado')  AS emprestado,
            SUM(Status = 'Reservado')   AS reservado,
            SUM(Status = 'Manutencao')  AS manutencao
        FROM Exemplar
    `;
    dbconfig.query(sql, (err, results) => {
        if (err) return handleQuery(res, err);
        res.json(results[0]);
    });
});

// GET /exemplar/:id — busca exemplar por ID com gêneros
app.get('/exemplar/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const sql = `
        SELECT
            ex.Exemplar_id, ex.Status, ex.Localizacao, ex.NumeroTombo,
            ex.Observacoes, ex.DataAquisicao, ex.CriadoEm, ex.Livro_id,
            l.Nome   AS NomeLivro,
            l.Autor  AS AutorLivro,
            l.Imagem AS CapaLivro
        FROM Exemplar ex
        LEFT JOIN Livro l ON ex.Livro_id = l.Livro_id
        WHERE ex.Exemplar_id = ?
    `;
    dbconfig.query(sql, [id], (err, results) => {
        if (err) return handleQuery(res, err);
        if (results.length === 0) return res.status(404).json({ error: 'Exemplar não encontrado.' });
        anexarGeneroExemplares(results, (err2, exemplares) => {
            if (err2) return handleQuery(res, err2);
            res.json(exemplares[0]);
        });
    });
});

// POST /exemplar — cadastra um novo exemplar com gêneros
app.post('/exemplar', (req, res) => {
    const { Livro_id, NumeroTombo, Localizacao, Status, Observacoes, DataAquisicao } = req.body;
    const nomeGeneros = normalizarGeneros(req.body.Generos || req.body.generos);

    if (!Livro_id) return res.status(400).json({ error: 'Livro_id é obrigatório.' });
    if (!NumeroTombo || NumeroTombo.trim().length < 2) return res.status(400).json({ error: 'Número de Tombo é obrigatório.' });
    if (!Localizacao || !Localizacao.trim()) return res.status(400).json({ error: 'Localização é obrigatória.' });

    const statusValidos = ['Disponivel', 'Emprestado', 'Reservado', 'Manutencao'];
    const statusFinal = Status || 'Disponivel';
    if (!statusValidos.includes(statusFinal)) return res.status(400).json({ error: 'Status inválido.' });

    dbconfig.query('SELECT Exemplar_id FROM Exemplar WHERE NumeroTombo = ?', [NumeroTombo.trim()], (errDup, dupRows) => {
        if (errDup) return handleQuery(res, errDup);
        if (dupRows.length > 0) return res.status(409).json({ error: `Número de Tombo "${NumeroTombo}" já existe.` });

        dbconfig.query('SELECT Livro_id FROM Livro WHERE Livro_id = ?', [parseInt(Livro_id, 10)], (errLivro, livroRows) => {
            if (errLivro) return handleQuery(res, errLivro);
            if (livroRows.length === 0) return res.status(404).json({ error: 'Livro não encontrado.' });

            const sql = `INSERT INTO Exemplar (Livro_id, NumeroTombo, Localizacao, Status, Observacoes, DataAquisicao, CriadoEm)
                         VALUES (?, ?, ?, ?, ?, ?, NOW())`;
            const vals = [parseInt(Livro_id, 10), NumeroTombo.trim(), Localizacao.trim(), statusFinal, Observacoes || null, DataAquisicao || null];

            dbconfig.query(sql, vals, (err, result) => {
                if (err) {
                    console.error('Erro ao inserir exemplar:', err);
                    return res.status(500).json({ error: 'Erro interno ao cadastrar exemplar.' });
                }
                const exemplarId = result.insertId;

                resolverGenerosIds(nomeGeneros, (errG, ids) => {
                    if (errG) {
                        console.error('Erro ao resolver gêneros do exemplar:', errG);
                        return res.status(201).json({ Exemplar_id: exemplarId, Livro_id: parseInt(Livro_id, 10), NumeroTombo: NumeroTombo.trim(), Localizacao: Localizacao.trim(), Status: statusFinal, Observacoes: Observacoes || null, DataAquisicao: DataAquisicao || null, Generos: [] });
                    }
                    salvarExemplarGeneros(exemplarId, ids, (errSalvar) => {
                        if (errSalvar) console.error('Erro ao salvar ExemplarGenero:', errSalvar);
                        res.status(201).json({ Exemplar_id: exemplarId, Livro_id: parseInt(Livro_id, 10), NumeroTombo: NumeroTombo.trim(), Localizacao: Localizacao.trim(), Status: statusFinal, Observacoes: Observacoes || null, DataAquisicao: DataAquisicao || null, Generos: nomeGeneros });
                    });
                });
            });
        });
    });
});

// POST /exemplar/lote — cadastra múltiplos exemplares de uma vez
// Aceita: { Livro_id, tombos: [...], Localizacao, Status }   ← formato do frontend
// Aceita: { Livro_id, TomboInicial, Quantidade, Localizacao, Status } ← formato legado
app.post('/exemplar/lote', (req, res) => {
    const { Livro_id, Localizacao, Status, Observacoes, DataAquisicao } = req.body;

    if (!Livro_id) return res.status(400).json({ error: 'Livro_id é obrigatório.' });
    if (!Localizacao || !Localizacao.trim()) return res.status(400).json({ error: 'Localização é obrigatória.' });

    const statusValidos = ['Disponivel', 'Emprestado', 'Reservado', 'Manutencao'];
    const statusFinal = Status || 'Disponivel';
    if (!statusValidos.includes(statusFinal)) return res.status(400).json({ error: 'Status inválido.' });

    // Resolve lista de tombos — suporta array direto OU TomboInicial+Quantidade
    let tombos = [];
    if (Array.isArray(req.body.tombos) && req.body.tombos.length > 0) {
        tombos = req.body.tombos.map(t => String(t).trim()).filter(Boolean);
    } else {
        const { TomboInicial, Quantidade } = req.body;
        if (!TomboInicial || TomboInicial.trim().length < 2) return res.status(400).json({ error: 'tombos ou TomboInicial são obrigatórios.' });
        const qtd = parseInt(Quantidade, 10);
        if (!qtd || qtd < 1 || qtd > 100) return res.status(400).json({ error: 'Quantidade deve ser entre 1 e 100.' });
        const match = TomboInicial.trim().match(/^([A-Za-z\-]+)(\d+)$/);
        if (!match) return res.status(400).json({ error: 'Formato de TomboInicial inválido. Use padrão como TMB-000001.' });
        const prefixo = match[1];
        const numBase = parseInt(match[2], 10);
        const digits = match[2].length;
        for (let i = 0; i < qtd; i++) {
            tombos.push(prefixo + String(numBase + i).padStart(digits, '0'));
        }
    }

    if (tombos.length === 0) return res.status(400).json({ error: 'Nenhum tombo informado.' });
    if (tombos.length > 100) return res.status(400).json({ error: 'Máximo de 100 exemplares por lote.' });

    // Verifica se livro existe
    dbconfig.query('SELECT Livro_id FROM Livro WHERE Livro_id = ?', [parseInt(Livro_id, 10)], (errLivro, livroRows) => {
        if (errLivro) return handleQuery(res, errLivro);
        if (livroRows.length === 0) return res.status(404).json({ error: 'Livro não encontrado.' });

        // Verifica duplicatas
        const placeholders = tombos.map(() => '?').join(',');
        dbconfig.query(`SELECT NumeroTombo FROM Exemplar WHERE NumeroTombo IN (${placeholders})`, tombos, (errDup, dupRows) => {
            if (errDup) return handleQuery(res, errDup);
            if (dupRows.length > 0) {
                const dups = dupRows.map(r => r.NumeroTombo).join(', ');
                return res.status(409).json({ error: `Tombos já existentes: ${dups}` });
            }

            const sql = `INSERT INTO Exemplar (Livro_id, NumeroTombo, Localizacao, Status, Observacoes, DataAquisicao, CriadoEm) VALUES ?`;
            const rows = tombos.map(tombo => [parseInt(Livro_id, 10), tombo, Localizacao.trim(), statusFinal, Observacoes || null, DataAquisicao || null, new Date()]);

            dbconfig.query(sql, [rows], (err, result) => {
                if (err) {
                    console.error('Erro ao inserir lote de exemplares:', err);
                    return res.status(500).json({ error: 'Erro interno ao cadastrar lote.' });
                }
                res.status(201).json({ message: `${result.affectedRows} exemplar(es) cadastrado(s) com sucesso!`, inseridos: result.affectedRows, tombos });
            });
        });
    });
});

// PUT /exemplar/:id — atualiza um exemplar com gêneros
app.put('/exemplar/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const { Livro_id, NumeroTombo, Localizacao, Status, Observacoes, DataAquisicao } = req.body;
    const nomeGeneros = normalizarGeneros(req.body.Generos || req.body.generos);

    if (!Livro_id) return res.status(400).json({ error: 'Livro_id é obrigatório.' });
    if (!NumeroTombo || NumeroTombo.trim().length < 2) return res.status(400).json({ error: 'Número de Tombo é obrigatório.' });
    if (!Localizacao || !Localizacao.trim()) return res.status(400).json({ error: 'Localização é obrigatória.' });

    const statusValidos = ['Disponivel', 'Emprestado', 'Reservado', 'Manutencao'];
    if (!statusValidos.includes(Status)) return res.status(400).json({ error: 'Status inválido.' });

    dbconfig.query('SELECT Exemplar_id FROM Exemplar WHERE NumeroTombo = ? AND Exemplar_id != ?', [NumeroTombo.trim(), id], (errDup, dupRows) => {
        if (errDup) return handleQuery(res, errDup);
        if (dupRows.length > 0) return res.status(409).json({ error: `Número de Tombo "${NumeroTombo}" já pertence a outro exemplar.` });

        const sql = `UPDATE Exemplar SET Livro_id = ?, NumeroTombo = ?, Localizacao = ?, Status = ?, Observacoes = ?, DataAquisicao = ? WHERE Exemplar_id = ?`;
        const vals = [parseInt(Livro_id, 10), NumeroTombo.trim(), Localizacao.trim(), Status, Observacoes || null, DataAquisicao || null, id];

        dbconfig.query(sql, vals, (err, result) => {
            if (err) return handleQuery(res, err);
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Exemplar não encontrado.' });

            resolverGenerosIds(nomeGeneros, (errG, ids) => {
                if (errG) {
                    console.error('Erro ao resolver gêneros do exemplar:', errG);
                    return res.json({ Exemplar_id: id, ...req.body, Generos: nomeGeneros });
                }
                salvarExemplarGeneros(id, ids, (errSalvar) => {
                    if (errSalvar) console.error('Erro ao salvar ExemplarGenero:', errSalvar);
                    res.json({ Exemplar_id: id, ...req.body, Generos: nomeGeneros });
                });
            });
        });
    });
});

// PATCH /exemplar/:id/status — atualiza apenas o status
app.patch('/exemplar/:id/status', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const { Status } = req.body;
    const statusValidos = ['Disponivel', 'Emprestado', 'Reservado', 'Manutencao'];
    if (!statusValidos.includes(Status)) return res.status(400).json({ error: 'Status inválido.' });

    dbconfig.query('UPDATE Exemplar SET Status = ? WHERE Exemplar_id = ?', [Status, id], (err, result) => {
        if (err) return handleQuery(res, err);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Exemplar não encontrado.' });
        res.json({ Exemplar_id: id, Status });
    });
});

// DELETE /exemplar/:id — remove um exemplar
app.delete('/exemplar/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    // Impede exclusão se houver empréstimo ativo
    dbconfig.query(
        "SELECT Emprestimo_id FROM Emprestimo WHERE Exemplar_id = ? AND Status IN ('ativo','atrasado')",
        [id],
        (errEmp, empRows) => {
            if (errEmp) return handleQuery(res, errEmp);
            if (empRows.length > 0) return res.status(409).json({ error: 'Não é possível excluir: exemplar possui empréstimo ativo.' });

            dbconfig.query('DELETE FROM Exemplar WHERE Exemplar_id = ?', [id], (err, result) => {
                if (err) return handleQuery(res, err);
                if (result.affectedRows === 0) return res.status(404).json({ error: 'Exemplar não encontrado.' });
                res.status(204).send();
            });
        }
    );
});

// ══════════════════════════════════════════════════════════════
//  ROTAS DE NOTIFICAÇÕES PERSISTENTES
// ══════════════════════════════════════════════════════════════

// GET /notificacoes?usuario=ID
app.get('/notificacoes', (req, res) => {
    const usuarioId = parseInt(req.query.usuario, 10);
    if (!usuarioId || isNaN(usuarioId)) return res.status(400).json({ error: 'usuario obrigatorio.' });
    const sql = `
        SELECT n.Notificacao_id, n.Usuario_id, n.Emprestimo_id, n.Tipo,
               n.Mensagem, n.Lida, n.CriadaEm,
               l.Nome AS NomeLivro, e.DataPrevista
        FROM Notificacao n
        LEFT JOIN Emprestimo e  ON n.Emprestimo_id = e.Emprestimo_id
        LEFT JOIN Exemplar   ex ON e.Exemplar_id   = ex.Exemplar_id
        LEFT JOIN Livro      l  ON ex.Livro_id     = l.Livro_id
        WHERE n.Usuario_id = ?
        ORDER BY n.CriadaEm DESC
        LIMIT 50
    `;
    dbconfig.query(sql, [usuarioId], (err, results) => {
        if (err) return handleQuery(res, err);
        res.json(results);
    });
});

// PATCH /notificacoes/:id/lida
app.patch('/notificacoes/:id/lida', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID invalido.' });
    dbconfig.query('UPDATE Notificacao SET Lida = 1 WHERE Notificacao_id = ?', [id], (err) => {
        if (err) return handleQuery(res, err);
        res.json({ ok: true });
    });
});

// PATCH /notificacoes/:id/nao-lida
app.patch('/notificacoes/:id/nao-lida', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID invalido.' });
    dbconfig.query('UPDATE Notificacao SET Lida = 0 WHERE Notificacao_id = ?', [id], (err) => {
        if (err) return handleQuery(res, err);
        res.json({ ok: true });
    });
});

// PATCH /notificacoes/marcar-todas-lidas?usuario=ID
app.patch('/notificacoes/marcar-todas-lidas', (req, res) => {
    const usuarioId = parseInt(req.query.usuario, 10);
    if (!usuarioId || isNaN(usuarioId)) return res.status(400).json({ error: 'usuario obrigatorio.' });
    dbconfig.query('UPDATE Notificacao SET Lida = 1 WHERE Usuario_id = ?', [usuarioId], (err) => {
        if (err) return handleQuery(res, err);
        res.json({ ok: true });
    });
});

// ══════════════════════════════════════════════════════════════
//  ROTAS DE SOLICITAÇÃO DE EMPRÉSTIMOS
//  Fluxo correto: usuário solicita → pendente → admin aprova/reprova → empréstimo ativo
//  CORRIGIDO: rotas estavam ausentes do servidor em execução (backend/src/server.js)
// ══════════════════════════════════════════════════════════════

// GET /solicitacao — lista solicitações (admin: todas; usuário: suas)
// Query params: ?usuario=ID  e/ou  ?status=pendente|aprovado|reprovado
app.get('/solicitacao', (req, res) => {
    const usuarioId = req.query.usuario ? parseInt(req.query.usuario, 10) : null;
    const status    = req.query.status  || null;

    let sql = `
        SELECT
            s.Solicitacao_id,
            s.Usuario_id,
            s.Livro_id,
            s.Status,
            s.DataSolicitacao,
            s.DataDecisao,
            s.AdminDecisao_id,
            s.ObservacaoAdmin,
            s.Emprestimo_id,
            u.Nome   AS NomeUsuario,
            u.Email  AS EmailUsuario,
            l.Nome   AS NomeLivro,
            l.Imagem AS CapaLivro,
            l.Autor  AS AutorLivro
        FROM SolicitacaoEmprestimo s
        JOIN Usuario u ON s.Usuario_id = u.Usuario_id
        JOIN Livro   l ON s.Livro_id   = l.Livro_id
        WHERE 1=1
    `;
    const params = [];

    if (usuarioId) { sql += ' AND s.Usuario_id = ?'; params.push(usuarioId); }
    if (status)    { sql += ' AND s.Status = ?';     params.push(status); }

    sql += ' ORDER BY s.DataSolicitacao DESC LIMIT 200';

    dbconfig.query(sql, params, (err, results) => {
        if (err) {
            console.error('[GET /solicitacao] Erro:', err.sqlMessage || err.message);
            return res.status(500).json({ error: 'Erro interno ao buscar solicitações.', detalhe: err.sqlMessage || err.message });
        }
        res.json(results);
    });
});

// GET /solicitacao/:id — detalhes de uma solicitação específica
app.get('/solicitacao/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const sql = `
        SELECT
            s.Solicitacao_id, s.Usuario_id, s.Livro_id, s.Status,
            s.DataSolicitacao, s.DataDecisao, s.AdminDecisao_id,
            s.ObservacaoAdmin, s.Emprestimo_id,
            u.Nome  AS NomeUsuario, u.Email AS EmailUsuario,
            l.Nome  AS NomeLivro,  l.Imagem AS CapaLivro, l.Autor AS AutorLivro
        FROM SolicitacaoEmprestimo s
        JOIN Usuario u ON s.Usuario_id = u.Usuario_id
        JOIN Livro   l ON s.Livro_id   = l.Livro_id
        WHERE s.Solicitacao_id = ?
    `;
    dbconfig.query(sql, [id], (err, rows) => {
        if (err) {
            console.error('[GET /solicitacao/:id] Erro:', err.sqlMessage || err.message);
            return res.status(500).json({ error: 'Erro interno.', detalhe: err.sqlMessage || err.message });
        }
        if (!rows.length) return res.status(404).json({ error: 'Solicitação não encontrada.' });
        res.json(rows[0]);
    });
});

// POST /solicitacao — usuário registra pedido de empréstimo (NÃO cria empréstimo ativo)
// Body: { Usuario_id, Livro_id }
app.post('/solicitacao', (req, res) => {
    const { Usuario_id, Livro_id } = req.body;

    console.log(`[POST /solicitacao] Recebido: Usuario_id=${Usuario_id}, Livro_id=${Livro_id}`);

    if (!Usuario_id || !Livro_id) {
        return res.status(400).json({ error: 'Usuario_id e Livro_id são obrigatórios.' });
    }

    // 1) Verifica se já existe solicitação pendente deste livro por este usuário
    dbconfig.query(
        "SELECT Solicitacao_id FROM SolicitacaoEmprestimo WHERE Usuario_id = ? AND Livro_id = ? AND Status = 'pendente'",
        [Usuario_id, Livro_id],
        (err, pendentes) => {
            if (err) {
                console.error('[POST /solicitacao] Erro ao checar pendentes:', err.sqlMessage || err.message);
                return res.status(500).json({ error: 'Erro interno ao verificar solicitações.', detalhe: err.sqlMessage || err.message });
            }
            if (pendentes.length > 0) {
                return res.status(400).json({ error: 'Você já possui uma solicitação pendente para este livro.' });
            }

            // 2) Verifica se já tem empréstimo ativo deste livro
            dbconfig.query(
                `SELECT e.Emprestimo_id FROM Emprestimo e
                 JOIN Exemplar ex ON e.Exemplar_id = ex.Exemplar_id
                 WHERE e.Usuario_id = ? AND ex.Livro_id = ? AND e.Status IN ('ativo','atrasado')`,
                [Usuario_id, Livro_id],
                (err2, ativos) => {
                    if (err2) {
                        console.error('[POST /solicitacao] Erro ao checar ativos:', err2.sqlMessage || err2.message);
                        return res.status(500).json({ error: 'Erro interno ao verificar empréstimos.', detalhe: err2.sqlMessage || err2.message });
                    }
                    if (ativos.length > 0) {
                        return res.status(400).json({ error: 'Você já possui um empréstimo ativo deste livro.' });
                    }

                    // 3) Verifica se há exemplar disponível
                    dbconfig.query(
                        "SELECT COUNT(*) AS total FROM Exemplar WHERE Livro_id = ? AND Status = 'Disponivel'",
                        [Livro_id],
                        (err3, countRows) => {
                            if (err3) {
                                console.error('[POST /solicitacao] Erro ao checar exemplares:', err3.sqlMessage || err3.message);
                                return res.status(500).json({ error: 'Erro interno ao verificar exemplares.', detalhe: err3.sqlMessage || err3.message });
                            }
                            if (!countRows[0].total) {
                                return res.status(409).json({ error: 'Não há exemplares disponíveis para este livro no momento.' });
                            }

                            // 4) Cria a solicitação com status 'pendente' — NÃO cria empréstimo
                            dbconfig.query(
                                "INSERT INTO SolicitacaoEmprestimo (Usuario_id, Livro_id, Status) VALUES (?, ?, 'pendente')",
                                [Usuario_id, Livro_id],
                                (err4, result) => {
                                    if (err4) {
                                        console.error('[POST /solicitacao] Erro ao inserir solicitação:', err4.sqlMessage || err4.message);
                                        return res.status(500).json({ error: 'Erro interno ao registrar a solicitação.', detalhe: err4.sqlMessage || err4.message });
                                    }

                                    const solicitacaoId = result.insertId;
                                    console.log(`[POST /solicitacao] Solicitação #${solicitacaoId} criada com sucesso (pendente).`);

                                    // 5) Notifica todos os admins (fire-and-forget — não bloqueia a resposta)
                                    dbconfig.query('SELECT Nome FROM Usuario WHERE Usuario_id = ?', [Usuario_id], (errUN, rowsUN) => {
                                        const nomeUsuario = (!errUN && rowsUN.length) ? rowsUN[0].Nome : `Usuário #${Usuario_id}`;
                                        dbconfig.query('SELECT Nome FROM Livro WHERE Livro_id = ?', [Livro_id], (errLN, rowsLN) => {
                                            const nomeLivro = (!errLN && rowsLN.length) ? rowsLN[0].Nome : `Livro #${Livro_id}`;
                                            const msgAdmin  = `Novo pedido de empréstimo solicitado por ${nomeUsuario}. Livro: "${nomeLivro}".`;
                                            dbconfig.query("SELECT Usuario_id FROM Usuario WHERE Tipo = 'admin'", (errAdm, admins) => {
                                                if (!errAdm && admins.length) {
                                                    admins.forEach(adm => {
                                                        dbconfig.query(
                                                            'INSERT INTO Notificacao (Usuario_id, Solicitacao_id, Tipo, Mensagem) VALUES (?, ?, ?, ?)',
                                                            [adm.Usuario_id, solicitacaoId, 'admin_solicitacao', msgAdmin],
                                                            (errN) => { if (errN) console.error('[POST /solicitacao] Erro ao notificar admin:', errN.sqlMessage || errN.message); }
                                                        );
                                                    });
                                                }
                                            });
                                        });
                                    });

                                    res.status(201).json({
                                        Solicitacao_id : solicitacaoId,
                                        Usuario_id,
                                        Livro_id,
                                        Status         : 'pendente',
                                        message        : 'Solicitação enviada com sucesso! Aguarde a aprovação do administrador.'
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// POST /solicitacao/:id/aprovar — admin aprova a solicitação e cria o empréstimo ativo
// Body: { admin_id, DataPrevista? }
app.post('/solicitacao/:id/aprovar', (req, res) => {
    const id      = parseInt(req.params.id, 10);
    const adminId = req.body.admin_id ? parseInt(req.body.admin_id, 10) : null;
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    console.log(`[POST /solicitacao/${id}/aprovar] admin_id=${adminId}`);

    dbconfig.query("SELECT * FROM SolicitacaoEmprestimo WHERE Solicitacao_id = ?", [id], (err, rows) => {
        if (err) {
            console.error('[aprovar] Erro ao buscar solicitação:', err.sqlMessage || err.message);
            return res.status(500).json({ error: 'Erro interno.', detalhe: err.sqlMessage || err.message });
        }
        if (!rows.length) return res.status(404).json({ error: 'Solicitação não encontrada.' });

        const solic = rows[0];
        if (solic.Status !== 'pendente') {
            return res.status(400).json({ error: `Esta solicitação já foi ${solic.Status}.` });
        }

        // Busca exemplar disponível
        dbconfig.query(
            "SELECT Exemplar_id FROM Exemplar WHERE Livro_id = ? AND Status = 'Disponivel' LIMIT 1",
            [solic.Livro_id],
            (err2, exemplares) => {
                if (err2) {
                    console.error('[aprovar] Erro ao buscar exemplar:', err2.sqlMessage || err2.message);
                    return res.status(500).json({ error: 'Erro interno ao buscar exemplar.', detalhe: err2.sqlMessage || err2.message });
                }
                if (!exemplares.length) {
                    return res.status(409).json({ error: 'Não há exemplares disponíveis no momento. Não é possível aprovar.' });
                }

                const exemplarId = exemplares[0].Exemplar_id;
                const hoje = new Date();
                const dataSaida = hoje.toISOString().split('T')[0];
                const dataPrevista = req.body.DataPrevista || (() => {
                    const d = new Date(hoje);
                    d.setDate(d.getDate() + 14);
                    return d.toISOString().split('T')[0];
                })();

                // Cria o empréstimo ativo
                dbconfig.query(
                    "INSERT INTO Emprestimo (DataSaida, DataPrevista, Status, Usuario_id, Exemplar_id) VALUES (?, ?, 'ativo', ?, ?)",
                    [dataSaida, dataPrevista, solic.Usuario_id, exemplarId],
                    (err3, empResult) => {
                        if (err3) {
                            console.error('[aprovar] Erro ao criar empréstimo:', err3.sqlMessage || err3.message);
                            return res.status(500).json({ error: 'Erro interno ao criar empréstimo.', detalhe: err3.sqlMessage || err3.message });
                        }

                        const emprestimoId = empResult.insertId;
                        console.log(`[aprovar] Empréstimo #${emprestimoId} criado para solicitação #${id}.`);

                        // Atualiza exemplar para Emprestado
                        dbconfig.query(
                            "UPDATE Exemplar SET Status = 'Emprestado' WHERE Exemplar_id = ?",
                            [exemplarId],
                            (err4) => { if (err4) console.error('[aprovar] Aviso: falha ao atualizar exemplar:', err4.message); }
                        );

                        // Atualiza solicitação para aprovado
                        dbconfig.query(
                            "UPDATE SolicitacaoEmprestimo SET Status='aprovado', DataDecisao=NOW(), AdminDecisao_id=?, Emprestimo_id=? WHERE Solicitacao_id=?",
                            [adminId, emprestimoId, id],
                            (err5) => { if (err5) console.error('[aprovar] Erro ao atualizar solicitação:', err5.message); }
                        );

                        // Notifica o usuário (fire-and-forget)
                        dbconfig.query('SELECT Nome FROM Livro WHERE Livro_id = ?', [solic.Livro_id], (errL, rowsL) => {
                            const nomeLivro = (!errL && rowsL.length) ? rowsL[0].Nome : 'Livro';
                            const msgUsuario = `Seu pedido de empréstimo do livro "${nomeLivro}" foi APROVADO! Prazo de devolução: ${dataPrevista}.`;
                            dbconfig.query(
                                'INSERT INTO Notificacao (Usuario_id, Emprestimo_id, Solicitacao_id, Tipo, Mensagem) VALUES (?, ?, ?, ?, ?)',
                                [solic.Usuario_id, emprestimoId, id, 'aprovacao_emprestimo', msgUsuario],
                                (errN) => { if (errN) console.error('[aprovar] Erro ao notificar usuário:', errN.message); }
                            );
                            dbconfig.query(
                                "UPDATE Notificacao SET Lida=1 WHERE Solicitacao_id=? AND Tipo='admin_solicitacao'",
                                [id], () => {}
                            );
                        });

                        res.json({
                            message        : 'Solicitação aprovada. Empréstimo criado com sucesso.',
                            Solicitacao_id : id,
                            Emprestimo_id  : emprestimoId,
                            Status         : 'aprovado',
                            DataSaida      : dataSaida,
                            DataPrevista   : dataPrevista
                        });
                    }
                );
            }
        );
    });
});

// POST /solicitacao/:id/reprovar — admin reprova a solicitação
// Body: { admin_id, observacao? }
app.post('/solicitacao/:id/reprovar', (req, res) => {
    const id         = parseInt(req.params.id, 10);
    const adminId    = req.body.admin_id   ? parseInt(req.body.admin_id, 10) : null;
    const observacao = req.body.observacao || null;
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    console.log(`[POST /solicitacao/${id}/reprovar] admin_id=${adminId}`);

    dbconfig.query("SELECT * FROM SolicitacaoEmprestimo WHERE Solicitacao_id = ?", [id], (err, rows) => {
        if (err) {
            console.error('[reprovar] Erro ao buscar solicitação:', err.sqlMessage || err.message);
            return res.status(500).json({ error: 'Erro interno.', detalhe: err.sqlMessage || err.message });
        }
        if (!rows.length) return res.status(404).json({ error: 'Solicitação não encontrada.' });

        const solic = rows[0];
        if (solic.Status !== 'pendente') {
            return res.status(400).json({ error: `Esta solicitação já foi ${solic.Status}.` });
        }

        dbconfig.query(
            "UPDATE SolicitacaoEmprestimo SET Status='reprovado', DataDecisao=NOW(), AdminDecisao_id=?, ObservacaoAdmin=? WHERE Solicitacao_id=?",
            [adminId, observacao, id],
            (err2) => {
                if (err2) {
                    console.error('[reprovar] Erro ao atualizar solicitação:', err2.sqlMessage || err2.message);
                    return res.status(500).json({ error: 'Erro interno ao reprovar.', detalhe: err2.sqlMessage || err2.message });
                }

                // Notifica o usuário (fire-and-forget)
                dbconfig.query('SELECT Nome FROM Livro WHERE Livro_id = ?', [solic.Livro_id], (errL, rowsL) => {
                    const nomeLivro = (!errL && rowsL.length) ? rowsL[0].Nome : 'Livro';
                    const obs = observacao ? ` Motivo: ${observacao}` : '';
                    const msgUsuario = `Seu pedido de empréstimo do livro "${nomeLivro}" foi reprovado.${obs}`;
                    dbconfig.query(
                        'INSERT INTO Notificacao (Usuario_id, Solicitacao_id, Tipo, Mensagem) VALUES (?, ?, ?, ?)',
                        [solic.Usuario_id, id, 'reprovacao_emprestimo', msgUsuario],
                        (errN) => { if (errN) console.error('[reprovar] Erro ao notificar usuário:', errN.message); }
                    );
                    dbconfig.query(
                        "UPDATE Notificacao SET Lida=1 WHERE Solicitacao_id=? AND Tipo='admin_solicitacao'",
                        [id], () => {}
                    );
                });

                res.json({
                    message        : 'Solicitação reprovada.',
                    Solicitacao_id : id,
                    Status         : 'reprovado'
                });
            }
        );
    });
});

// ══════════════════════════════════════════════════════════════
//  ROTAS DE NOTIFICAÇÕES DO ADMINISTRADOR
//  CORRIGIDO: ausentes do servidor em execução
// ══════════════════════════════════════════════════════════════

// GET /admin/notificacoes?admin=ID
app.get('/admin/notificacoes', (req, res) => {
    const adminId = parseInt(req.query.admin, 10);
    if (!adminId || isNaN(adminId)) return res.status(400).json({ error: 'Parâmetro admin é obrigatório.' });

    const sql = `
        SELECT
            n.Notificacao_id, n.Usuario_id, n.Emprestimo_id,
            n.Solicitacao_id, n.Tipo, n.Mensagem, n.Lida, n.CriadaEm,
            s.Status        AS StatusSolicitacao,
            s.DataSolicitacao,
            us.Nome         AS NomeSolicitante,
            us.Email        AS EmailSolicitante,
            l.Nome          AS NomeLivro,
            l.Imagem        AS CapaLivro
        FROM Notificacao n
        LEFT JOIN SolicitacaoEmprestimo s  ON n.Solicitacao_id = s.Solicitacao_id
        LEFT JOIN Usuario               us ON s.Usuario_id     = us.Usuario_id
        LEFT JOIN Livro                 l  ON s.Livro_id       = l.Livro_id
        WHERE n.Usuario_id = ? AND n.Tipo LIKE 'admin_%'
        ORDER BY n.CriadaEm DESC
        LIMIT 50
    `;
    dbconfig.query(sql, [adminId], (err, results) => {
        if (err) {
            console.error('[GET /admin/notificacoes] Erro:', err.sqlMessage || err.message);
            return res.status(500).json({ error: 'Erro interno.', detalhe: err.sqlMessage || err.message });
        }
        res.json(results);
    });
});

// PATCH /admin/notificacoes/:id/lida
app.patch('/admin/notificacoes/:id/lida', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
    dbconfig.query('UPDATE Notificacao SET Lida = 1 WHERE Notificacao_id = ?', [id], (err) => {
        if (err) return handleQuery(res, err);
        res.json({ ok: true });
    });
});

// PATCH /admin/notificacoes/:id/nao-lida
app.patch('/admin/notificacoes/:id/nao-lida', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
    dbconfig.query('UPDATE Notificacao SET Lida = 0 WHERE Notificacao_id = ?', [id], (err) => {
        if (err) return handleQuery(res, err);
        res.json({ ok: true });
    });
});

// PATCH /admin/notificacoes/marcar-todas-lidas?admin=ID
app.patch('/admin/notificacoes/marcar-todas-lidas', (req, res) => {
    const adminId = parseInt(req.query.admin, 10);
    if (!adminId || isNaN(adminId)) return res.status(400).json({ error: 'admin obrigatório.' });
    dbconfig.query(
        "UPDATE Notificacao SET Lida = 1 WHERE Usuario_id = ? AND Tipo LIKE 'admin_%'",
        [adminId],
        (err) => {
            if (err) return handleQuery(res, err);
            res.json({ ok: true });
        }
    );
});

// ── Cron interno: roda às 07h todo dia ────────────────────────
cron.schedule('0 7 * * *', async () => {
    console.log('[CRON 07h] Verificando emprestimos vencendo em 2 dias...');
    const sqlCron = `
        SELECT e.Emprestimo_id, e.DataPrevista, e.Usuario_id,
               u.Nome AS NomeUsuario, u.Email AS EmailUsuario, l.Nome AS NomeLivro
        FROM Emprestimo e
        LEFT JOIN Exemplar ex ON e.Exemplar_id = ex.Exemplar_id
        LEFT JOIN Livro    l  ON ex.Livro_id   = l.Livro_id
        LEFT JOIN Usuario  u  ON e.Usuario_id  = u.Usuario_id
        WHERE e.Status = 'ativo' AND DATEDIFF(e.DataPrevista, CURDATE()) = 2
    `;
    dbconfig.query(sqlCron, async (errC, emprestimos) => {
        if (errC) { console.error('[CRON] Erro:', errC); return; }
        if (!emprestimos.length) { console.log('[CRON] Nenhum emprestimo vencendo.'); return; }
        for (const emp of emprestimos) {
            await sendLoanExpiryEmail(emp.EmailUsuario, emp.NomeUsuario, emp.NomeLivro, emp.DataPrevista);
            const msgC = `Seu empréstimo do livro "${emp.NomeLivro}" vence em 2 dias (${emp.DataPrevista}). Por favor, devolva até essa data.`;
            dbconfig.query(
                `INSERT INTO Notificacao (Usuario_id, Emprestimo_id, Tipo, Mensagem)
                 SELECT ?, ?, 'vencimento', ?
                 FROM DUAL
                 WHERE NOT EXISTS (
                     SELECT 1 FROM Notificacao WHERE Emprestimo_id = ? AND DATE(CriadaEm) = CURDATE() AND Tipo = 'vencimento'
                 )`,
                [emp.Usuario_id, emp.Emprestimo_id, msgC, emp.Emprestimo_id],
                (errN) => { if (errN) console.error('[CRON] Erro notificacao:', errN.message); }
            );
        }
        console.log(`[CRON] ${emprestimos.length} emprestimo(s) processado(s).`);
    });
});

// ══════════════════════════════════════════════════════════════
//  ROTAS DE AUTOR
// ══════════════════════════════════════════════════════════════

// GET /autor — lista todos os autores ordenados por Nome, com contagem de livros
app.get('/autor', (req, res) => {
    const sql = `
        SELECT a.*, COUNT(l.Livro_id) AS TotalLivros
        FROM Autor a
        LEFT JOIN Livro l ON l.Autor_id = a.Autor_id
        GROUP BY a.Autor_id
        ORDER BY a.Nome ASC
    `;
    dbconfig.query(sql, (err, results) => {
        handleQuery(res, err, results);
    });
});

// GET /autor/busca?q=termo — busca por nome para autocomplete
app.get('/autor/busca', (req, res) => {
    const q = req.query.q || '';
    if (q.trim().length < 2) return res.json([]);

    const sql = `
        SELECT Autor_id, Nome, Foto
        FROM Autor
        WHERE Nome LIKE ?
        ORDER BY Nome ASC
        LIMIT 10
    `;
    dbconfig.query(sql, [`%${q}%`], (err, results) => {
        handleQuery(res, err, results);
    });
});

// GET /autor/:id — busca autor por ID com lista de livros vinculados
app.get('/autor/:id', (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT a.*, l.Livro_id, l.Nome AS NomeLivro, l.Imagem AS CapaLivro,
               l.AnoPublicacao, l.Categoria
        FROM Autor a
        LEFT JOIN Livro l ON l.Autor_id = a.Autor_id
        WHERE a.Autor_id = ?
    `;
    dbconfig.query(sql, [id], (err, results) => {
        if (err) { console.error('Erro ao buscar autor:', err); return res.status(500).json({ error: 'Erro interno no servidor.' }); }
        if (!results || results.length === 0) return res.status(404).json({ error: 'Autor não encontrado.' });
        // Agrupa livros no objeto do autor
        const autor = {
            Autor_id:      results[0].Autor_id,
            Nome:          results[0].Nome,
            Nacionalidade: results[0].Nacionalidade,
            DataNascimento:results[0].DataNascimento,
            Biografia:     results[0].Biografia,
            Foto:          results[0].Foto,
            CriadoEm:      results[0].CriadoEm,
            Livros: results
                .filter(r => r.Livro_id)
                .map(r => ({
                    Livro_id:     r.Livro_id,
                    Nome:         r.NomeLivro,
                    Imagem:       r.CapaLivro,
                    AnoPublicacao:r.AnoPublicacao,
                    Categoria:    r.Categoria
                }))
        };
        res.json(autor);
    });
});

// POST /autor — cadastra novo autor
app.post('/autor', (req, res) => {
    const erro = validarAutor(req.body);
    if (erro) return res.status(400).json({ error: erro });

    const { Nome, Nacionalidade = null, DataNascimento = null, Biografia = null, Foto = null } = req.body;
    const nomeTrimmed = Nome.trim();

    // Verificar duplicata
    dbconfig.query('SELECT Autor_id FROM Autor WHERE Nome = ?', [nomeTrimmed], (errDup, dup) => {
        if (errDup) { console.error('Erro ao verificar duplicata de autor:', errDup); return res.status(500).json({ error: 'Erro interno no servidor.' }); }
        if (dup.length > 0) return res.status(409).json({ error: 'Já existe um autor com esse nome.' });

        const sql = 'INSERT INTO Autor (Nome, Nacionalidade, DataNascimento, Biografia, Foto) VALUES (?, ?, ?, ?, ?)';
        const values = [nomeTrimmed, Nacionalidade || null, DataNascimento || null, Biografia || null, Foto || null];

        dbconfig.query(sql, values, (err, result) => {
            if (err) { console.error('Erro ao cadastrar autor:', err); return res.status(500).json({ error: 'Erro interno no servidor.' }); }
            res.status(201).json({ Autor_id: result.insertId, Nome: nomeTrimmed, Nacionalidade, DataNascimento, Biografia, Foto });
        });
    });
});

// PUT /autor/:id — atualiza autor
app.put('/autor/:id', (req, res) => {
    const { id } = req.params;
    const erro = validarAutor(req.body);
    if (erro) return res.status(400).json({ error: erro });

    const { Nome, Nacionalidade = null, DataNascimento = null, Biografia = null, Foto = null } = req.body;
    const nomeTrimmed = Nome.trim();

    // Verificar se o autor existe
    dbconfig.query('SELECT Autor_id FROM Autor WHERE Autor_id = ?', [id], (errExiste, existe) => {
        if (errExiste) { console.error('Erro ao verificar autor:', errExiste); return res.status(500).json({ error: 'Erro interno no servidor.' }); }
        if (!existe || existe.length === 0) return res.status(404).json({ error: 'Autor não encontrado.' });

        // Verificar duplicata excluindo o próprio registro
        dbconfig.query('SELECT Autor_id FROM Autor WHERE Nome = ? AND Autor_id != ?', [nomeTrimmed, id], (errDup, dup) => {
            if (errDup) { console.error('Erro ao verificar duplicata de autor:', errDup); return res.status(500).json({ error: 'Erro interno no servidor.' }); }
            if (dup.length > 0) return res.status(409).json({ error: 'Já existe outro autor com esse nome.' });

            const sql = 'UPDATE Autor SET Nome = ?, Nacionalidade = ?, DataNascimento = ?, Biografia = ?, Foto = ? WHERE Autor_id = ?';
            const values = [nomeTrimmed, Nacionalidade || null, DataNascimento || null, Biografia || null, Foto || null, id];

            dbconfig.query(sql, values, (err) => {
                if (err) { console.error('Erro ao atualizar autor:', err); return res.status(500).json({ error: 'Erro interno no servidor.' }); }
                res.json({ Autor_id: parseInt(id), Nome: nomeTrimmed, Nacionalidade, DataNascimento, Biografia, Foto });
            });
        });
    });
});

// DELETE /autor/:id — exclui autor (verifica livros vinculados antes)
app.delete('/autor/:id', (req, res) => {
    const { id } = req.params;

    // Verificar se o autor existe
    dbconfig.query('SELECT Autor_id, Nome FROM Autor WHERE Autor_id = ?', [id], (errExiste, existe) => {
        if (errExiste) { console.error('Erro ao verificar autor:', errExiste); return res.status(500).json({ error: 'Erro interno no servidor.' }); }
        if (!existe || existe.length === 0) return res.status(404).json({ error: 'Autor não encontrado.' });

        // Verificar livros vinculados
        dbconfig.query('SELECT COUNT(*) AS total FROM Livro WHERE Autor_id = ?', [id], (errCount, count) => {
            if (errCount) { console.error('Erro ao verificar livros do autor:', errCount); return res.status(500).json({ error: 'Erro interno no servidor.' }); }
            if (count[0].total > 0) return res.status(409).json({ error: 'Não é possível excluir: autor possui livros cadastrados.' });

            dbconfig.query('DELETE FROM Autor WHERE Autor_id = ?', [id], (err) => {
                if (err) { console.error('Erro ao excluir autor:', err); return res.status(500).json({ error: 'Erro interno no servidor.' }); }
                res.json({ mensagem: 'Autor excluído com sucesso.' });
            });
        });
    });
});
app.listen(3000, () => {
    console.log('✅ Server listening on port 3000');
    console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✅ configurado' : '❌ NÃO configurado');
    console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ configurado' : '❌ NÃO configurado');
});