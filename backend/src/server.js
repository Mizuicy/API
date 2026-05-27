import express from 'express';
import cron from 'node-cron';
import path from 'path';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import dbconfig from './db/dbconfig.js';
import { validarUsuario, validarLivro } from './utils/validacoes.js';
import { validateEmail, generateAuthCode, sendAuthEmail, sendWelcomeEmail, sendLoanExpiryEmail } from './utils/emailService.js';

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

app.get('/livro', (req, res) => {
    dbconfig.query('SELECT * FROM Livro', (err, results) => {
        handleQuery(res, err, results);
    });
});

app.get('/livro/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    dbconfig.query('SELECT * FROM Livro WHERE Livro_id = ?', [id], (err, results) => {
        if (err) return handleQuery(res, err);
        if (results.length === 0) {
            return res.status(404).json({ message: 'Livro não encontrado' });
        }
        res.json(results[0]);
    });
});

app.post('/livro', (req, res) => {
    const erro = validarLivro(req.body);
    if (erro) return res.status(400).json({ error: erro });

    const { Nome, Autor, Editora, AnoPublicacao, Idioma, NumeroPaginas, ClassEtaria, Categoria, Resumo, Imagem, NumeroChamada, DataPublicacao } = req.body;
    const values = [
        Nome,
        Autor || null,
        Editora || null,
        AnoPublicacao || null,
        Idioma || null,
        NumeroPaginas || null,
        ClassEtaria || null,
        Categoria || null,
        Resumo || null,
        Imagem || null,
        NumeroChamada || null,
        DataPublicacao || null
    ];
    const sql = `INSERT INTO Livro
        (Nome, Autor, Editora, AnoPublicacao, Idioma, NumeroPaginas, ClassEtaria, Categoria, Resumo, Imagem, NumeroChamada, DataPublicacao)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    dbconfig.query(sql, values, (err, result) => {
        if (err) {
            console.error('Erro ao inserir livro:', err);
            return res.status(500).json({ error: 'Erro interno no servidor.' });
        }
        res.status(201).json({ Livro_id: result.insertId, ...req.body });
    });
});

app.put('/livro/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const erro = validarLivro(req.body);
    if (erro) return res.status(400).json({ error: erro });

    const { Nome, Autor, Editora, AnoPublicacao, Idioma, NumeroPaginas, ClassEtaria, Categoria, Resumo, Imagem, NumeroChamada, DataPublicacao } = req.body;
    const sql = `UPDATE Livro SET
        Nome = ?, Autor = ?, Editora = ?, AnoPublicacao = ?, Idioma = ?,
        NumeroPaginas = ?, ClassEtaria = ?, Categoria = ?, Resumo = ?,
        Imagem = ?, NumeroChamada = ?, DataPublicacao = ?
        WHERE Livro_id = ?`;
    const values = [Nome, Autor || null, Editora || null, AnoPublicacao || null, Idioma || null,
        NumeroPaginas || null, ClassEtaria || null, Categoria || null, Resumo || null,
        Imagem || null, NumeroChamada || null, DataPublicacao || null, id];

    dbconfig.query(sql, values, (err, result) => {
        if (err) return handleQuery(res, err);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Livro não encontrado' });
        }
        res.json({ Livro_id: id, ...req.body });
    });
});

app.delete('/livro/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    dbconfig.query('DELETE FROM Livro WHERE Livro_id = ?', [id], (err, result) => {
        if (err) return handleQuery(res, err);
        if (result.affectedRows === 0) {
             return res.status(404).json({ message: 'Livro não encontrado' });
        }
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

// GET /exemplar — lista todos os exemplares com info do livro
// GET /exemplar?livro_id=ID — filtra por livro
// GET /exemplar?status=Disponivel — filtra por status
app.get('/exemplar', (req, res) => {
    // aceita tanto `busca` (frontend) quanto `search` (genérico)
    const busca = req.query.busca || req.query.search || '';
    const { livro_id, status } = req.query;

    const conditions = [];
    const values = [];

    if (livro_id) {
        conditions.push('ex.Livro_id = ?');
        values.push(parseInt(livro_id, 10));
    }
    if (status) {
        conditions.push('ex.Status = ?');
        values.push(status);
    }
    if (busca) {
        conditions.push('(l.Nome LIKE ? OR ex.NumeroTombo LIKE ? OR ex.Localizacao LIKE ?)');
        const s = `%${busca}%`;
        values.push(s, s, s);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const dataSql = `
        SELECT
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
        ${where}
        ORDER BY ex.Exemplar_id DESC
    `;

    dbconfig.query(dataSql, values, (errData, rows) => {
        if (errData) return handleQuery(res, errData);
        // Retorna array direto — compatível com o frontend
        res.json(rows);
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

// GET /exemplar/:id — busca exemplar por ID
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
        res.json(results[0]);
    });
});

// POST /exemplar — cadastra um novo exemplar
app.post('/exemplar', (req, res) => {
    const { Livro_id, NumeroTombo, Localizacao, Status, Observacoes, DataAquisicao } = req.body;

    if (!Livro_id) return res.status(400).json({ error: 'Livro_id é obrigatório.' });
    if (!NumeroTombo || NumeroTombo.trim().length < 2) return res.status(400).json({ error: 'Número de Tombo é obrigatório.' });
    if (!Localizacao || !Localizacao.trim()) return res.status(400).json({ error: 'Localização é obrigatória.' });

    const statusValidos = ['Disponivel', 'Emprestado', 'Reservado', 'Manutencao'];
    const statusFinal = Status || 'Disponivel';
    if (!statusValidos.includes(statusFinal)) return res.status(400).json({ error: 'Status inválido.' });

    // Verifica duplicata de tombo
    dbconfig.query('SELECT Exemplar_id FROM Exemplar WHERE NumeroTombo = ?', [NumeroTombo.trim()], (errDup, dupRows) => {
        if (errDup) return handleQuery(res, errDup);
        if (dupRows.length > 0) return res.status(409).json({ error: `Número de Tombo "${NumeroTombo}" já existe.` });

        // Verifica se livro existe
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
                res.status(201).json({ Exemplar_id: result.insertId, Livro_id: parseInt(Livro_id, 10), NumeroTombo: NumeroTombo.trim(), Localizacao: Localizacao.trim(), Status: statusFinal, Observacoes: Observacoes || null, DataAquisicao: DataAquisicao || null });
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

// PUT /exemplar/:id — atualiza um exemplar
app.put('/exemplar/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const { Livro_id, NumeroTombo, Localizacao, Status, Observacoes, DataAquisicao } = req.body;

    if (!Livro_id) return res.status(400).json({ error: 'Livro_id é obrigatório.' });
    if (!NumeroTombo || NumeroTombo.trim().length < 2) return res.status(400).json({ error: 'Número de Tombo é obrigatório.' });
    if (!Localizacao || !Localizacao.trim()) return res.status(400).json({ error: 'Localização é obrigatória.' });

    const statusValidos = ['Disponivel', 'Emprestado', 'Reservado', 'Manutencao'];
    if (!statusValidos.includes(Status)) return res.status(400).json({ error: 'Status inválido.' });

    // Verifica duplicata de tombo (exceto o próprio)
    dbconfig.query('SELECT Exemplar_id FROM Exemplar WHERE NumeroTombo = ? AND Exemplar_id != ?', [NumeroTombo.trim(), id], (errDup, dupRows) => {
        if (errDup) return handleQuery(res, errDup);
        if (dupRows.length > 0) return res.status(409).json({ error: `Número de Tombo "${NumeroTombo}" já pertence a outro exemplar.` });

        const sql = `UPDATE Exemplar SET Livro_id = ?, NumeroTombo = ?, Localizacao = ?, Status = ?, Observacoes = ?, DataAquisicao = ? WHERE Exemplar_id = ?`;
        const vals = [parseInt(Livro_id, 10), NumeroTombo.trim(), Localizacao.trim(), Status, Observacoes || null, DataAquisicao || null, id];

        dbconfig.query(sql, vals, (err, result) => {
            if (err) return handleQuery(res, err);
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Exemplar não encontrado.' });
            res.json({ Exemplar_id: id, ...req.body });
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

app.listen(3000, () => {
    console.log('✅ Server listening on port 3000');
    console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✅ configurado' : '❌ NÃO configurado');
    console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ configurado' : '❌ NÃO configurado');
});