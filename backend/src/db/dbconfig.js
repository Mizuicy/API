import mysql from 'mysql2';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const pool = mysql.createPool({
    host    : process.env.DB_HOST     || 'localhost',
    port    : parseInt(process.env.DB_PORT) || 3306,
    user    : process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'devolucao',
    waitForConnections: true,
    connectionLimit   : 10,
    queueLimit        : 0
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco de dados:', err.message);
        return;
    }
    console.log('✅ Conectado ao banco MySQL com sucesso!');
    connection.release();
});

export default pool;