/**
 * chatRoutes.js — Kairos WebChat IA
 * Define as rotas HTTP para o módulo de chat com IA.
 * Montado em /api/chat no servidor principal.
 */

import { Router } from 'express';
import { handleChat } from '../controllers/chatController.js';

const router = Router();

// POST /api/chat — envia mensagem e recebe resposta da IA
router.post('/', handleChat);

// GET /api/chat/health — verifica se o módulo está ativo
router.get('/health', (req, res) => {
    const apiKeyConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
    res.json({
        status:   apiKeyConfigured ? 'ok' : 'degraded',
        module:   'kairos-chat',
        apiKey:   apiKeyConfigured ? 'configured' : 'missing',
        timestamp: new Date().toISOString(),
    });
});

export default router;
