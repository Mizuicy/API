import mysql from 'mysql2';

const dbconfig = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'devolucao'
});

dbconfig.connect((err) => {
    if (err) {
        console.error('Erro ao conectar:', err.message);
        return;
    }
    console.log('Conectado ao banco com sucesso!');
});

export default dbconfig;
