/**
 * chatController.js — Kairos WebChat IA
 * Controller responsável por receber as requisições do frontend,
 * validar, chamar o serviço de IA e retornar a resposta.
 */

import { getChatResponse } from '../services/aiService.js';

// ────────────────────────────────────────────────────────────────────────────
//  POST /api/chat
//  Body: { messages: [ { role: "user" | "assistant", content: "..." } ] }
// ────────────────────────────────────────────────────────────────────────────
export async function handleChat(req, res) {
    const requestId = Date.now().toString(36);
    console.log(`[chatController][${requestId}] Nova requisição de chat recebida`);

    try {
        const { messages } = req.body;

        // ── Validação básica ────────────────────────────────────────────────
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: 'Campo "messages" é obrigatório e deve ser um array.'
            });
        }

        if (messages.length === 0) {
            return res.status(400).json({ error: 'Array de mensagens está vazio.' });
        }

        if (messages.length > 50) {
            return res.status(400).json({ error: 'Histórico de conversa muito longo (máx. 50 mensagens).' });
        }

        // Valida cada mensagem
        for (const msg of messages) {
            if (!msg.role || !msg.content) {
                return res.status(400).json({ error: 'Cada mensagem deve ter "role" e "content".' });
            }
            if (!['user', 'assistant'].includes(msg.role)) {
                return res.status(400).json({ error: `Role inválido: "${msg.role}". Use "user" ou "assistant".` });
            }
            if (typeof msg.content !== 'string' || msg.content.trim().length === 0) {
                return res.status(400).json({ error: 'O conteúdo da mensagem não pode ser vazio.' });
            }
            if (msg.content.length > 4000) {
                return res.status(400).json({ error: 'Mensagem muito longa (máx. 4000 caracteres).' });
            }
        }

        // A última mensagem deve ser do usuário
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role !== 'user') {
            return res.status(400).json({ error: 'A última mensagem deve ser do usuário (role: "user").' });
        }

        console.log(`[chatController][${requestId}] Histórico: ${messages.length} msg(s). Última: "${lastMessage.content.substring(0, 60)}..."`);

        // ── Chama o serviço de IA ───────────────────────────────────────────
        const reply = await getChatResponse(messages);

        console.log(`[chatController][${requestId}] Resposta gerada com sucesso.`);

        return res.json({ reply });

    } catch (error) {
        console.error(`[chatController][${requestId}] Erro:`, error.message);

        // Erros conhecidos da IA → status 503
        const knownErrors = [
            'Chave de API',
            'Limite de requisições',
            'temporariamente indisponível',
            'Configuração de IA',
        ];

        const isKnownError = knownErrors.some(e => error.message.includes(e));
        const statusCode = isKnownError ? 503 : 500;

        return res.status(statusCode).json({
            error: error.message || 'Erro interno ao processar a mensagem.'
        });
    }
}
