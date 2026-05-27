// gerar_admin.js — Executar UMA VEZ para criar o usuário admin
// Uso: node gerar_admin.js
// Requer: npm install bcrypt mysql2 (ou as dependências já instaladas)

import bcrypt from 'bcrypt';
import dbconfig from '../src/db/dbconfig.js';

const SENHA = 'Admin@123';
const EMAIL = 'bibliotecakairos.tcc@gmail.com';

async function criarAdmin() {
    const hash = await bcrypt.hash(SENHA, 10);
    console.log('Hash gerado:', hash);

    const sql = `
        INSERT INTO Usuario (Nome, Email, Senha, Telefone, CPF, DataNascimento, Tipo)
        VALUES (?, ?, ?, NULL, NULL, '1990-01-01', 'admin')
        ON DUPLICATE KEY UPDATE Senha = VALUES(Senha), Tipo = 'admin'
    `;

    dbconfig.query(sql, ['Administrador', EMAIL, hash], (err, result) => {
        if (err) {
            console.error('Erro ao inserir admin:', err.message);
        } else {
            console.log('✅ Admin criado/atualizado com sucesso!');
            console.log('   Email:', EMAIL);
            console.log('   Senha:', SENHA);
        }
        process.exit(0);
    });
}

criarAdmin();