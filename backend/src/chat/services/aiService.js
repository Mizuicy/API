/**
 * aiService.js — Kairos WebChat IA
 * Serviço responsável pela comunicação com a API Groq (gratuita).
 * Plano gratuito: 14.400 requisições/dia, sem cartão de crédito.
 * Obtenha sua chave em: https://console.groq.com/keys
 *
 * A chave é lida exclusivamente do ambiente (.env) — nunca exposta ao frontend.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile'; // Melhor modelo gratuito do Groq

// ────────────────────────────────────────────────────────────────────────────
//  Contexto do sistema — descreve o sistema Kairos para a IA
// ────────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é o Assistente Virtual da Biblioteca Kairos, um sistema de gestão de biblioteca online.
Seu nome é Kairos e você é prestativo, amigável e objetivo.

## SOBRE O SISTEMA KAIROS
O sistema Kairos é uma plataforma completa de gestão de biblioteca com as seguintes funcionalidades:

### Para USUÁRIOS (leitores):
- **Catálogo de Livros**: Pesquise e visualize todos os livros disponíveis em /pages/biblioteca/catalogo.html
- **Solicitar Empréstimo**: No catálogo, clique em "Solicitar Empréstimo" em qualquer livro disponível. O pedido vai para aprovação do administrador.
- **Meus Empréstimos**: Acompanhe seus empréstimos ativos, histórico e status em /pages/biblioteca/meus-emprestimos.html
- **Notificações**: Receba alertas sobre vencimentos e aprovações pelo sino 🔔 no menu
- **Perfil**: Atualize seu nome, foto de perfil e senha em /pages/perfil.html
- **Renovação**: Não há renovação automática — contate a biblioteca ou solicite um novo empréstimo após devolver
- **Status dos empréstimos**: "ativo" (em andamento), "atrasado" (passou do prazo), "devolvido" (concluído)

### Para ADMINISTRADORES:
- **Painel Admin**: Gerencie tudo em /pages/admin/admin.html
- **Solicitações**: Aprove ou reprove pedidos de empréstimo em /pages/gestao/solicitacoes.html
- **Empréstimos**: Visualize e gerencie todos os empréstimos em /pages/gestao/emprestimos.html
- **Livros**: Cadastre, edite e remova livros em /pages/gestao/livros.html
- **Autores**: Gerencie autores em /pages/gestao/autores.html
- **Exemplares**: Controle exemplares físicos (tombos) em /pages/gestao/exemplares.html

### Regras de negócio importantes:
- Prazo padrão de empréstimo: **14 dias**
- Não é possível ter dois empréstimos ativos do mesmo livro
- Um livro só pode ser emprestado se houver exemplar "Disponível"
- O usuário recebe e-mail e notificação quando o empréstimo vence em 2 dias
- Empréstimos atrasados continuam visíveis no histórico com status "atrasado"

## INSTRUÇÕES DE COMPORTAMENTO
- Responda SEMPRE em português brasileiro
- Seja conciso e direto — respostas curtas são preferidas
- Para dúvidas sobre o sistema, dê instruções passo a passo claras
- Para perguntas fora do sistema, responda normalmente com seu conhecimento geral
- Use emojis com moderação para tornar a resposta mais amigável
- Se não souber algo específico do sistema, oriente o usuário a contatar o administrador`;

// ────────────────────────────────────────────────────────────────────────────
//  Função principal: chama a API do Groq
//  O Groq usa o mesmo formato da API OpenAI — muito simples de usar
// ────────────────────────────────────────────────────────────────────────────
export async function getChatResponse(messages) {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        console.error('[aiService] GROQ_API_KEY não configurada no .env');
        throw new Error('Configuração de IA ausente. Contate o administrador.');
    }

    // Monta as mensagens no formato OpenAI (que o Groq também usa)
    // Adiciona o system prompt como primeira mensagem
    const formattedMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: String(m.content).trim() })),
    ];

    const lastMsg = formattedMessages[formattedMessages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user') {
        throw new Error('Mensagem do usuário ausente.');
    }

    console.log(`[aiService] Enviando ${formattedMessages.length - 1} mensagem(ns) para o Groq...`);

    const response = await fetch(GROQ_API_URL, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model:      GROQ_MODEL,
            messages:   formattedMessages,
            max_tokens: 1024,
            temperature: 0.7,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[aiService] Erro HTTP ${response.status}:`, errorBody);

        if (response.status === 401) throw new Error('Chave de API inválida ou expirada.');
        if (response.status === 429) throw new Error('Limite de requisições atingido. Tente novamente em instantes.');
        if (response.status >= 500) throw new Error('Serviço de IA temporariamente indisponível.');
        throw new Error('Erro ao comunicar com o serviço de IA.');
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
        console.error('[aiService] Resposta sem conteúdo:', JSON.stringify(data));
        throw new Error('Resposta vazia do serviço de IA.');
    }

    const usage = data?.usage;
    console.log(`[aiService] Resposta recebida. Tokens: ${usage?.prompt_tokens || 0} in / ${usage?.completion_tokens || 0} out`);

    return text;
}
