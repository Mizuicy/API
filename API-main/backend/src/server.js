import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import dbconfig from './db/dbconfig.js';

const app = express();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'troque_por_uma_chave_secreta_forte';

app.use(express.json());
app.use(cors()); // substitui o middleware manual de CORS

// Logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} -> ${req.method} ${req.url}`);
    next();
});

// Middleware de autenticação JWT
function autenticarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
    if (!token) return res.status(401).json({ error: 'Token não fornecido.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido ou expirado.' });
        req.user = user;
        next();
    });
}

// Helper para erros de query
function handleQuery(res, err, results) {
    if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
    return res.json(results);
}

// Armazenamento temporário de códigos de verificação (em produção use Redis)
const codigosVerificacao = new Map();


// ─── ROTAS PÚBLICAS ─────────────────────────────────────────────────────────

// Registro de usuário
app.post('/usuario', async (req, res) => {
    const { Nome, Email, Senha, Telefone, CPF, DataNascimento } = req.body;

    if (!Nome || !Email || !Senha || !CPF) {
        return res.status(400).json({ error: 'Campos obrigatórios: Nome, Email, Senha, CPF.' });
    }

    try {
        const senhaHash = await bcrypt.hash(Senha, SALT_ROUNDS);
        const sql = `INSERT INTO Usuario (Nome, Email, Senha, Telefone, CPF, DataNascimento)
                     VALUES (?, ?, ?, ?, ?, ?)`;

        dbconfig.query(sql, [Nome, Email, senhaHash, Telefone, CPF, DataNascimento], (err, result) => {
            if (err) {
                if (err.errno === 1062) {
                    return res.status(400).json({ error: 'Este CPF ou Email já está cadastrado.' });
                }
                return res.status(500).json({ error: 'Erro interno no servidor.' });
            }
            res.status(201).json({ message: 'Usuário criado com sucesso!' });
        });
    } catch (err) {
        console.error('Erro ao criar hash:', err);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// Login — retorna JWT
app.post('/login', (req, res) => {
    const { Email, Senha } = req.body;
    if (!Email || !Senha) {
        return res.status(400).json({ error: 'Email e Senha são obrigatórios.' });
    }

    dbconfig.query('SELECT * FROM Usuario WHERE Email = ?', [Email], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Erro interno no servidor.' });
        if (results.length === 0) {
            return res.status(401).json({ error: 'Email ou senha inválidos.' });
        }

        const usuario = results[0];
        const senhaCorreta = await bcrypt.compare(Senha, usuario.Senha);
        if (!senhaCorreta) {
            return res.status(401).json({ error: 'Email ou senha inválidos.' });
        }

        const token = jwt.sign(
            { id: usuario.Usuario_id, email: usuario.Email },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ token, usuario: { id: usuario.Usuario_id, Nome: usuario.Nome, Email: usuario.Email } });
    });
});

// Solicitar código de verificação por email
app.post('/verificacao/solicitar', (req, res) => {
    const { Email } = req.body;
    if (!Email) return res.status(400).json({ error: 'Email é obrigatório.' });

    const codigo = gerarCodigoVerificacao();
    codigosVerificacao.set(Email, { codigo, expira: Date.now() + 10 * 60 * 1000 }); // expira em 10 min

    enviarEmail(Email, codigo)
        .then(() => res.json({ message: 'Código enviado para o email.' }))
        .catch(() => res.status(500).json({ error: 'Erro ao enviar email.' }));
});

// Validar código de verificação
app.post('/verificacao/validar', (req, res) => {
    const { Email, Codigo } = req.body;
    const registro = codigosVerificacao.get(Email);

    if (!registro) return res.status(400).json({ error: 'Nenhum código solicitado para este email.' });
    if (Date.now() > registro.expira) {
        codigosVerificacao.delete(Email);
        return res.status(400).json({ error: 'Código expirado. Solicite um novo.' });
    }
    if (registro.codigo !== Codigo) {
        return res.status(400).json({ error: 'Código incorreto.' });
    }

    codigosVerificacao.delete(Email);
    res.json({ message: 'Email verificado com sucesso!' });
});


// ─── ROTAS PROTEGIDAS (exigem JWT) ───────────────────────────────────────────

app.get('/usuario', autenticarToken, (req, res) => {
    dbconfig.query('SELECT Usuario_id, Nome, Email, Telefone, CPF, DataNascimento FROM Usuario', (err, results) => {
        handleQuery(res, err, results);
    });
});

app.put('/usuario/:id', autenticarToken, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { Nome, Email, Senha, Telefone, CPF, DataNascimento } = req.body;

    try {
        const senhaHash = await bcrypt.hash(Senha, SALT_ROUNDS);
        const sql = 'UPDATE Usuario SET Nome=?, Email=?, Senha=?, Telefone=?, CPF=?, DataNascimento=? WHERE Usuario_id=?';

        dbconfig.query(sql, [Nome, Email, senhaHash, Telefone, CPF, DataNascimento, id], (err, result) => {
            if (err) return handleQuery(res, err);
            if (result.affectedRows === 0) return res.status(404).json({ message: 'Usuário não encontrado.' });
            res.json({ Usuario_id: id, Nome, Email, Telefone, CPF, DataNascimento });
        });
    } catch (err) {
        console.error('Erro ao criar hash:', err);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

app.delete('/usuario/:id', autenticarToken, (req, res) => {
    const id = parseInt(req.params.id, 10);
    dbconfig.query('DELETE FROM Usuario WHERE Usuario_id = ?', [id], (err, result) => {
        if (err) return handleQuery(res, err);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Usuário não encontrado.' });
        res.status(204).send();
    });
});


// ─── FUNÇÕES AUXILIARES ──────────────────────────────────────────────────────

function gerarCodigoVerificacao() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function enviarEmail(email, codigo) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS, // use App Password do Gmail, não a senha normal
        },
    });

    await transporter.sendMail({
        from: `"Verificação" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Seu código de verificação',
        text: `Seu código de verificação é: ${codigo}. Válido por 10 minutos.`,
    });
}
//function reservarLivro() {
    // Lógica para reservar um livro
//}
//function devolverLivro() {
    // Lógica para devolver um livro
//}
//function consultarDisponibilidade() {
    // Lógica para consultar a disponibilidade de um livro
//}
//function listarLivros() {
    // Lógica para listar os livros disponíveis
//}
app.listen(3000, () => {
    console.log('Server listening on port 3000');
});

export { gerarCodigoVerificacao, enviarEmail };