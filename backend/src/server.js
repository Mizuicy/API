import express from 'express'
import path from 'path';
import { fileURLToPath } from 'url';
import dbconfig from './db/dbconfig.js';
import { validarUsuario, validarLivro } from './utils/validacoes.js'
import { validateEmail, generateAuthCode, sendAuthEmail, sendWelcomeEmail } from './utils/emailService.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Servir arquivos estáticos da pasta frontend/public
app.use(express.static(path.join(__dirname, '../../frontend/public')));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} -> ${req.method} ${req.url}`);
    next();
});

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
    res.header('Access-Control-Expose-Headers', 'Content-Length, X-Kuma-Revision');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

function handleQuery(res, err, results) {
    if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
    return res.json(results);
}

app.get('/usuario', (req, res) => {
    dbconfig.query('SELECT * FROM Usuario', (err, results) => {
        handleQuery(res, err, results);
    });
});

app.post('/usuario', (req, res) => {
    const erro = validarUsuario(req.body);
    if (erro) return res.status(400).json({ error: erro });

    const { Nome, Email, Senha, Telefone, CPF, DataNascimento } = req.body;

    if (!DataNascimento) {
        return res.status(400).json({ error: 'Data de nascimento é obrigatória.' });
    }

    if (!validateEmail(Email)) {
        return res.status(400).json({ error: 'Email inválido.' });
    }

    const normalizeOptional = (value) => (value === '' ? null : value);
    const values = [Nome, Email, Senha, normalizeOptional(Telefone), CPF, DataNascimento];
    const sql = `INSERT INTO Usuario (Nome, Email, Senha, Telefone, CPF, DataNascimento) VALUES (?, ?, ?, ?, ?, ?)`;

    dbconfig.query(sql, values, async (err) => {
        if (err) {
            if (err.errno === 1062) {
                return res.status(400).json({ error: "Este CPF ou Email já está cadastrado em nosso sistema." });
            }
            console.error('Erro ao inserir usuário:', err);
            return res.status(500).json({ error: "Erro interno no servidor." });
        }

        const emailEnviado = await sendWelcomeEmail(Email, Nome);
        if (!emailEnviado) {
            console.warn('Falha ao enviar email de boas-vindas para:', Email);
        }

        res.status(201).json({ message: "Usuário criado com sucesso!" });
    });
});

app.post('/usuario/login', (req, res) => {
    const { Email, Senha } = req.body;
    if (!Email || !Senha) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }
    dbconfig.query(
        'SELECT * FROM Usuario WHERE Email = ? AND Senha = ?',
        [Email, Senha],
        (err, results) => {
            if (err) return handleQuery(res, err);
            if (results.length === 0) {
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }
            const { Senha: _, ...usuarioSemSenha } = results[0];
            res.json({ usuario: usuarioSemSenha });
        }
    );
});

const authCodes = new Map();

app.post('/usuario/authcode', async (req, res) => {
    const { Email } = req.body;
    if (!Email || !validateEmail(Email)) {
        return res.status(400).json({ error: 'Email inválido.' });
    }

    const code = generateAuthCode();
    authCodes.set(Email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

    const emailEnviado = await sendAuthEmail(Email, code);
    if (!emailEnviado) {
        return res.status(500).json({ error: 'Falha ao enviar código de autenticação.' });
    }

    res.json({ message: 'Código de autenticação enviado para o email.' });
});

app.post('/usuario/authcode/verify', (req, res) => {
    const { Email, Codigo } = req.body;
    if (!Email || !Codigo) {
        return res.status(400).json({ error: 'Email e código são obrigatórios.' });
    }

    const saved = authCodes.get(Email);
    if (!saved || saved.code !== Codigo) {
        return res.status(401).json({ error: 'Código inválido.' });
    }

    if (Date.now() > saved.expiresAt) {
        authCodes.delete(Email);
        return res.status(401).json({ error: 'Código expirado.' });
    }

    authCodes.delete(Email);
    res.json({ message: 'Código verificado com sucesso.' });
});

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

app.put('/usuario/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const erro = validarUsuario(req.body);
    if (erro) return res.status(400).json({ error: erro });

    const { Nome, Email, Senha, Telefone, CPF, DataNascimento } = req.body;
    const sql = 'UPDATE Usuario SET Nome = ?, Email = ?, Senha = ?, Telefone = ?, CPF = ?, DataNascimento = ? WHERE Usuario_id = ?';
    dbconfig.query(sql, [Nome, Email, Senha, Telefone, CPF, DataNascimento, id], (err, result) => {
        if (err) return handleQuery(res, err);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }
        res.json({ Usuario_id: id, Nome, Email, Telefone, CPF, DataNascimento });
    });
});
//Função para validar os dados do livro 
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

    const { Titulo, Autor, ISBN, Editora, AnoPublicacao, Categoria, Descricao } = req.body;
    const values = [Titulo, Autor, ISBN, Editora || null, AnoPublicacao, Categoria || null, Descricao || null];
    const sql = 'INSERT INTO Livro (Titulo, Autor, ISBN, Editora, AnoPublicacao, Categoria, Descricao) VALUES (?, ?, ?, ?, ?, ?, ?)';

    dbconfig.query(sql, values, (err, result) => {
        if (err) {
            if (err.errno === 1062) {
                return res.status(400).json({ error: 'Este ISBN já está cadastrado.' });
            }
            console.error('Erro ao inserir livro:', err);
            return res.status(500).json({ error: 'Erro interno no servidor.' });
        }
        res.status(201).json({ Livro_id: result.insertId, Titulo, Autor, ISBN, Editora, AnoPublicacao, Categoria, Descricao });
    });
});

app.put('/livro/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const erro = validarLivro(req.body);
    if (erro) return res.status(400).json({ error: erro });

    const { Titulo, Autor, ISBN, Editora, AnoPublicacao, Categoria, Descricao } = req.body;
    const sql = 'UPDATE Livro SET Titulo = ?, Autor = ?, ISBN = ?, Editora = ?, AnoPublicacao = ?, Categoria = ?, Descricao = ? WHERE Livro_id = ?';
    dbconfig.query(sql, [Titulo, Autor, ISBN, Editora || null, AnoPublicacao, Categoria || null, Descricao || null, id], (err, result) => {
        if (err) return handleQuery(res, err);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Livro não encontrado' });
        }
        res.json({ Livro_id: id, Titulo, Autor, ISBN, Editora, AnoPublicacao, Categoria, Descricao });
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

app.listen(3000, () => {
    console.log('Server listening on port 3000');
});
