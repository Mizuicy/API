import express from 'express'
import path from 'path';
import { fileURLToPath } from 'url';
import dbconfig from './db/dbconfig.js';

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

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// helper to send query results/errors
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
    const { Nome, Email, Senha, Telefone, CPF, DataNascimento } = req.body;

    // Validação básica de campos obrigatórios
    if (!Nome || !Email || !Senha || !CPF || !DataNascimento) {
        return res.status(400).json({ error: 'Nome, Email, Senha, CPF e Data de nascimento são obrigatórios.' });
    }

    // Normaliza valores vazios para NULL apenas para campos opcionais
    const normalizeOptional = (value) => (value === '' ? null : value);
    const values = [
        Nome,
        Email,
        Senha,
        normalizeOptional(Telefone),
        CPF,
        DataNascimento
    ];

    const sql = `INSERT INTO Usuario (Nome, Email, Senha, Telefone, CPF, DataNascimento) 
                 VALUES (?, ?, ?, ?, ?, ?)`;

    dbconfig.query(sql, values, (err, result) => {
        if (err) {
            if (err.errno === 1062) {
                return res.status(400).json({ 
                    error: "Este CPF ou Email já está cadastrado em nosso sistema." 
                });
            }

            // Em desenvolvimento pode ser útil devolver a mensagem do SQL
            console.error('Erro ao inserir usuário:', err);
            return res.status(500).json({ error: "Erro interno no servidor." });
        }

        res.status(201).json({ message: "Usuário criado com sucesso!" });
    });
});

app.delete('/usuario/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
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

// ======== ENDPOINTS PARA LIVROS ========

// GET - Listar todos os livros
app.get('/livros', (req, res) => {
    dbconfig.query('SELECT * FROM Livro ORDER BY data_criacao DESC', (err, results) => {
        handleQuery(res, err, results);
    });
});

// GET - Listar um livro específico por ID
app.get('/livros/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    dbconfig.query('SELECT * FROM Livro WHERE id = ?', [id], (err, results) => {
        if (err) return handleQuery(res, err);
        if (results.length === 0) {
            return res.status(404).json({ message: 'Livro não encontrado' });
        }
        res.json(results[0]);
    });
});

// POST - Adicionar novo livro
app.post('/livros', (req, res) => {
    const { titulo, autor, editora, ano_publicacao, idioma, numero_paginas, classificacao_etaria, genero, resumo, capa } = req.body;

    // Validação básica de campos obrigatórios
    if (!titulo || !autor || !editora || !ano_publicacao || !idioma || !numero_paginas || !classificacao_etaria || !genero || !resumo || !capa) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    const sql = `INSERT INTO Livro (titulo, autor, editora, ano_publicacao, idioma, numero_paginas, classificacao_etaria, genero, resumo, capa) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [titulo, autor, editora, ano_publicacao, idioma, numero_paginas, classificacao_etaria, genero, resumo, capa];

    dbconfig.query(sql, values, (err, result) => {
        if (err) {
            console.error('Erro ao inserir livro:', err);
            return res.status(500).json({ error: 'Erro ao inserir livro no banco de dados.' });
        }
        res.status(201).json({ message: 'Livro criado com sucesso!', id: result.insertId });
    });
});

// PUT - Atualizar um livro
app.put('/livros/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { titulo, autor, editora, ano_publicacao, idioma, numero_paginas, classificacao_etaria, genero, resumo, capa } = req.body;

    // Validação básica de campos obrigatórios
    if (!titulo || !autor || !editora || !ano_publicacao || !idioma || !numero_paginas || !classificacao_etaria || !genero || !resumo || !capa) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    const sql = `UPDATE Livro SET titulo = ?, autor = ?, editora = ?, ano_publicacao = ?, idioma = ?, numero_paginas = ?, classificacao_etaria = ?, genero = ?, resumo = ?, capa = ? WHERE id = ?`;

    const values = [titulo, autor, editora, ano_publicacao, idioma, numero_paginas, classificacao_etaria, genero, resumo, capa, id];

    dbconfig.query(sql, values, (err, result) => {
        if (err) {
            console.error('Erro ao atualizar livro:', err);
            return res.status(500).json({ error: 'Erro ao atualizar livro.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Livro não encontrado' });
        }
        res.json({ message: 'Livro atualizado com sucesso!' });
    });
});

// DELETE - Deletar um livro
app.delete('/livros/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    dbconfig.query('DELETE FROM Livro WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.error('Erro ao deletar livro:', err);
            return res.status(500).json({ error: 'Erro ao deletar livro.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Livro não encontrado' });
        }
        res.status(204).send();
    });
});


app.listen(3000, () => {
    console.log('Server listening on port 3000');
});
