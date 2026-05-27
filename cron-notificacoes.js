import cron from 'node-cron';
import fetch from 'node-fetch';

// Roda todo dia às 08:00
cron.schedule('0 7 * * *', async () => {
    const res = await fetch('http://localhost:3000/emprestimo/vencendo/notificar', {
        method: 'POST'
    });
    const data = await res.json();
    console.log('[CRON 07h]', data);
});

console.log('Cron de notificacoes iniciado.');