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
        // Log técnico completo apenas no servidor
        console.error(`[chatController][${requestId}] Erro:`, error.message);
        console.error(`[chatController][${requestId}] Stack:`, error.stack);

        // ── Mapeamento de erros conhecidos para mensagens amigáveis ─────────
        const msg = (error && error.message) ? error.message : '';

        // Chave de API ausente ou inválida
        if (
            msg.includes('não está configurado') ||
            msg.includes('configurar a chave') ||
            msg.includes('Configuração de IA') ||
            msg.includes('GROQ_API_KEY') ||
            msg.includes('API key') ||
            msg.includes('apikey')
        ) {
            return res.status(503).json({
                error: 'O serviço de IA não está disponível no momento. Contate o administrador do sistema.'
            });
        }

        // Chave inválida ou expirada
        if (msg.includes('Chave de API') || msg.includes('401') || msg.includes('inválida ou expirada')) {
            return res.status(503).json({
                error: 'Serviço de IA temporariamente indisponível. Tente novamente em breve.'
            });
        }

        // Limite de requisições
        if (msg.includes('Limite de requisições') || msg.includes('429') || msg.includes('sobrecarregado')) {
            return res.status(503).json({
                error: 'O serviço de IA está sobrecarregado. Aguarde alguns instantes e tente novamente.'
            });
        }

        // Serviço indisponível
        if (msg.includes('temporariamente indisponível') || msg.includes('503') || msg.includes('502')) {
            return res.status(503).json({
                error: 'Serviço de IA temporariamente indisponível. Tente novamente em breve.'
            });
        }

        // Erro de rede / timeout
        if (
            msg.includes('fetch') ||
            msg.includes('network') ||
            msg.includes('ECONNREFUSED') ||
            msg.includes('ETIMEDOUT') ||
            msg.includes('ENOTFOUND')
        ) {
            return res.status(503).json({
                error: 'Não foi possível conectar ao serviço de IA. Verifique sua conexão e tente novamente.'
            });
        }

        // Qualquer outro erro — nunca expor detalhes técnicos ao usuário
        return res.status(500).json({
            error: 'Não foi possível gerar uma resposta neste momento. Tente novamente.'
        });
    }
}