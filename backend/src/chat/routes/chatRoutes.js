/**
 * chatRoutes.js — Kairos WebChat IA  [v2.0]
 * Rotas HTTP para o módulo de chat com IA.
 * Montado em /api/chat no servidor principal.
 */

import { Router } from 'express';
import { handleChat } from '../controllers/chatController.js';
import dbconfig from '../../db/dbconfig.js';

const router = Router();

// POST /api/chat — envia mensagem e recebe resposta da IA
router.post('/', handleChat);

// GET /api/chat/health — verifica se o módulo está ativo
router.get('/health', (req, res) => {
    const apiKeyConfigured = Boolean(process.env.GROQ_API_KEY);
    res.json({
        status:    apiKeyConfigured ? 'ok' : 'degraded',
        module:    'kairos-chat',
        apiKey:    apiKeyConfigured ? 'configured' : 'missing',
        model:     'llama-3.3-70b-versatile (Groq)',
        features:  ['chat-geral', 'resumo-livros', 'consulta-acervo'],
        timestamp: new Date().toISOString(),
    });
});

// GET /api/chat/acervo — retorna lista simplificada de livros para o frontend
router.get('/acervo', (req, res) => {
    const sql = `
        SELECT
            l.Livro_id,
            l.Nome AS Titulo,
            l.Autor,
            l.Categoria,
            COUNT(CASE WHEN ex.Status = 'Disponivel' THEN 1 END) AS ExemplaresDisponiveis,
            COUNT(ex.Exemplar_id) AS TotalExemplares
        FROM Livro l
        LEFT JOIN Exemplar ex ON ex.Livro_id = l.Livro_id
        GROUP BY l.Livro_id, l.Nome, l.Autor, l.Categoria
        ORDER BY l.Nome ASC
        LIMIT 200
    `;

    dbconfig.query(sql, (err, results) => {
        if (err) {
            console.error('[chatRoutes] Erro ao buscar acervo:', err.message);
            return res.status(500).json({ error: 'Erro ao consultar acervo.' });
        }
        res.json({ total: results.length, livros: results });
    });
});

export default router;