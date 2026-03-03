import express from 'express'
import dbconfig from './db/dbconfig.js';

const app = express();
app.use(express.json());

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

    const sql = `INSERT INTO Usuario (Nome, Email, Senha, Telefone, CPF, DataNascimento) 
                 VALUES (?, ?, ?, ?, ?, ?)`;

    dbconfig.query(sql, [Nome, Email, Senha, Telefone, CPF, DataNascimento], (err, result) => {
        if (err) {
            if (err.errno === 1062) {
                return res.status(400).json({ 
                    error: "Este CPF ou Email já está cadastrado em nosso sistema." 
                });
            }
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


app.listen(3000, () => {
    console.log('Server listening on port 3000');
});
