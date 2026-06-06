/**
 * aiService.js — Kairos WebChat IA  [v2.1 — CORRIGIDO]
 * Serviço de comunicação com a API Groq (llama-3.3-70b-versatile).
 *
 * CORREÇÕES v2.1:
 *  - Removida exposição de mensagens técnicas ("função ausente", stack traces etc.)
 *  - Todas as exceções lançadas têm mensagens amigáveis em PT-BR
 *  - Adicionado timeout na chamada ao Groq (30s)
 *  - Verificação de tipo de getChatResponse para evitar "is not a function"
 */

import dbconfig from '../../db/dbconfig.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Carrega o .env caso ainda não esteja carregado
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const TIMEOUT_MS   = 30000; // 30 segundos

// ────────────────────────────────────────────────────────────────────────────
//  System Prompt
// ────────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é o Assistente Virtual da Biblioteca Kairos, chamado Kairos.
Você é inteligente, amigável, prestativo e versátil. Responde SEMPRE em português brasileiro.

## SUAS CAPACIDADES

### 1. Assistente do Sistema Kairos
Você conhece profundamente o sistema de biblioteca Kairos:

**Para USUÁRIOS (leitores):**
- **Catálogo**: Pesquise livros em /pages/biblioteca/catalogo.html
- **Solicitar Empréstimo**: No catálogo, clique em "Solicitar Empréstimo" em qualquer livro disponível
- **Meus Empréstimos**: Acompanhe em /pages/biblioteca/meus-emprestimos.html
- **Notificações**: Alertas de vencimento pelo sino 🔔 no menu
- **Perfil**: Atualize dados em /pages/perfil.html
- **Prazo padrão**: 14 dias. Sem renovação automática — devolva e solicite novamente.
- **Status**: "ativo" (em andamento), "atrasado" (passou do prazo), "devolvido" (concluído)

**Para ADMINISTRADORES:**
- Painel em /pages/admin/admin.html
- Solicitações em /pages/gestao/solicitacoes.html
- Empréstimos em /pages/gestao/emprestimos.html
- Livros em /pages/gestao/livros.html
- Autores em /pages/gestao/autores.html
- Exemplares em /pages/gestao/exemplares.html

**Regras de negócio:**
- Prazo padrão: 14 dias
- Não é possível ter dois empréstimos ativos do mesmo livro
- Um livro só pode ser emprestado se houver exemplar "Disponível"
- Notificação de vencimento 2 dias antes

### 2. IA Conversacional Geral
Você também pode:
- Responder perguntas gerais sobre qualquer assunto
- Explicar conceitos, fatos históricos, ciência, tecnologia, etc.
- Conversar naturalmente sobre qualquer tema
- Dar conselhos, opiniões e recomendações

### 3. Especialista em Literatura — Resumos de Livros
Você pode gerar resumos claros e organizados de qualquer obra literária.
Formato padrão para resumos:
- Título e autor
- Contexto histórico (breve)
- Sinopse (sem spoilers principais, a menos que solicitado)
- Personagens principais
- Temas centrais
- Por que ler

Se o usuário pedir para evitar spoilers, respeite isso.
Se não tiver informações suficientes sobre a obra, diga honestamente.

### 4. Consulta ao Acervo (dados reais do banco)
Quando os dados do acervo forem fornecidos no contexto da mensagem, use-os para responder
perguntas sobre livros disponíveis, autores, quantidades, etc.

## INSTRUÇÕES DE COMPORTAMENTO
- Responda SEMPRE em português brasileiro
- Seja conciso e direto; respostas longas apenas quando necessário
- Use formatação markdown (negrito, listas) para organizar respostas complexas
- Use emojis com moderação
- Para dúvidas do sistema, dê instruções passo a passo
- Nunca invente dados do acervo — use apenas os dados fornecidos no contexto
- Se não souber algo específico do sistema, oriente o usuário a contatar o administrador`;

// ────────────────────────────────────────────────────────────────────────────
//  Detecta se a mensagem é uma consulta ao acervo
// ────────────────────────────────────────────────────────────────────────────
const ACERVO_PATTERNS = [
    /quais?\s+livros?\s+(est[aã]o\s+)?(dis[pí]on[ií]ve[il]s?|no\s+acervo|cadastrados?|na\s+biblioteca)/i,
    /tem\s+(algum|alguma|livro|obra)/i,
    /existe[m]?\s+(algum|livro|obra)/i,
    /quantos?\s+(livros?|exemplares?)/i,
    /livros?\s+de\s+\w+/i,
    /autor\s+\w+/i,
    /obras?\s+de\s+\w+/i,
    /categoria\s+(de\s+)?/i,
    /g[êe]nero\s+(de\s+)?/i,
    /acervo/i,
    /dispon[ií]ve[il]s?/i,
];

function isAcervoQuery(text) {
    return ACERVO_PATTERNS.some(pattern => pattern.test(text));
}

// ────────────────────────────────────────────────────────────────────────────
//  Busca dados do acervo no banco de dados
// ────────────────────────────────────────────────────────────────────────────
function buscarAcervo() {
    return new Promise((resolve) => {
        const sql = `
            SELECT
                l.Livro_id,
                l.Nome AS Titulo,
                l.Autor,
                l.Editora,
                l.Categoria,
                l.AnoPublicacao,
                l.Idioma,
                COUNT(CASE WHEN ex.Status = 'Disponivel' THEN 1 END) AS ExemplaresDisponiveis,
                COUNT(ex.Exemplar_id) AS TotalExemplares
            FROM Livro l
            LEFT JOIN Exemplar ex ON ex.Livro_id = l.Livro_id
            GROUP BY l.Livro_id, l.Nome, l.Autor, l.Editora, l.Categoria, l.AnoPublicacao, l.Idioma
            ORDER BY l.Nome ASC
            LIMIT 100
        `;

        dbconfig.query(sql, (err, results) => {
            if (err) {
                console.error('[aiService] Erro ao consultar acervo:', err.message);
                resolve(null); // Continua sem dados do acervo
                return;
            }
            resolve(results);
        });
    });
}

// ────────────────────────────────────────────────────────────────────────────
//  Formata os dados do acervo para incluir no contexto da IA
// ────────────────────────────────────────────────────────────────────────────
function formatarAcervoParaIA(livros) {
    if (!livros || livros.length === 0) {
        return '\n\n[ACERVO DA BIBLIOTECA: Nenhum livro cadastrado no momento.]';
    }

    const total      = livros.length;
    const disponiveis = livros.filter(l => l.ExemplaresDisponiveis > 0).length;

    let texto = `\n\n[DADOS REAIS DO ACERVO DA BIBLIOTECA KAIROS - ${new Date().toLocaleDateString('pt-BR')}]\n`;
    texto += `Total de títulos: ${total} | Títulos com exemplares disponíveis: ${disponiveis}\n\n`;
    texto += 'Lista de livros:\n';

    livros.forEach(livro => {
        texto += `- "${livro.Titulo}"`;
        if (livro.Autor)         texto += ` | Autor: ${livro.Autor}`;
        if (livro.Categoria)     texto += ` | Categoria: ${livro.Categoria}`;
        if (livro.AnoPublicacao) texto += ` | Ano: ${livro.AnoPublicacao}`;
        texto += ` | Disponíveis: ${livro.ExemplaresDisponiveis}/${livro.TotalExemplares} exemplares`;
        texto += '\n';
    });

    texto += '\nIMPORTANTE: Use APENAS esses dados para responder perguntas sobre o acervo. Não invente livros.';
    texto += '\n[FIM DOS DADOS DO ACERVO]';

    return texto;
}

// ────────────────────────────────────────────────────────────────────────────
//  Fetch com timeout
// ────────────────────────────────────────────────────────────────────────────
async function fetchComTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('O serviço de IA demorou demais para responder. Tente novamente.');
        }
        throw new Error('Não foi possível conectar ao serviço de IA. Verifique sua conexão e tente novamente.');
    } finally {
        clearTimeout(timer);
    }
}

// ────────────────────────────────────────────────────────────────────────────
//  Função principal — exportada
// ────────────────────────────────────────────────────────────────────────────
export async function getChatResponse(messages) {
    // ── Verificação da chave de API ─────────────────────────────────────────
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey || apiKey.trim() === '') {
        console.error('[aiService] GROQ_API_KEY não configurada no .env');
        throw new Error('O serviço de IA não está configurado. Por favor, contate o administrador para configurar a chave de API.');
    }

    // ── Verifica se a mensagem pede dados do acervo ─────────────────────────
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    let acervoContexto = '';

    if (lastUserMsg && isAcervoQuery(lastUserMsg.content)) {
        console.log('[aiService] Consulta ao acervo detectada — buscando dados do banco...');
        try {
            const livros = await buscarAcervo();
            acervoContexto = formatarAcervoParaIA(livros);
            console.log(`[aiService] Acervo carregado: ${livros ? livros.length : 0} livros`);
        } catch (err) {
            console.error('[aiService] Falha ao buscar acervo:', err.message);
            // Continua sem dados do acervo
        }
    }

    // ── Monta as mensagens ──────────────────────────────────────────────────
    const systemContent = SYSTEM_PROMPT + acervoContexto;

    const formattedMessages = [
        { role: 'system', content: systemContent },
        ...messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: String(m.content).trim() })),
    ];

    // Garante que a última mensagem seja do usuário
    const lastMsg = formattedMessages[formattedMessages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user') {
        throw new Error('Não foi possível processar sua mensagem. Por favor, tente novamente.');
    }

    console.log(`[aiService] Enviando ${formattedMessages.length - 1} msg(s) para o Groq${acervoContexto ? ' (com dados do acervo)' : ''}...`);

    // ── Chamada à API do Groq ───────────────────────────────────────────────
    let response;
    try {
        response = await fetchComTimeout(
            GROQ_API_URL,
            {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model:       GROQ_MODEL,
                    messages:    formattedMessages,
                    max_tokens:  2048,
                    temperature: 0.7,
                }),
            },
            TIMEOUT_MS
        );
    } catch (err) {
        // fetchComTimeout já retorna mensagens amigáveis
        throw err;
    }

    // ── Tratamento da resposta HTTP ─────────────────────────────────────────
    if (!response.ok) {
        let errorBody = '';
        try { errorBody = await response.text(); } catch (_) {}
        console.error(`[aiService] Erro HTTP ${response.status}:`, errorBody);

        if (response.status === 401) {
            throw new Error('Chave de API inválida ou expirada.');
        }
        if (response.status === 429) {
            throw new Error('Limite de requisições atingido. Tente novamente em instantes.');
        }
        if (response.status >= 500) {
            throw new Error('Serviço de IA temporariamente indisponível.');
        }
        throw new Error('Não foi possível gerar uma resposta neste momento. Tente novamente.');
    }

    // ── Extrai o texto da resposta ──────────────────────────────────────────
    let data;
    try {
        data = await response.json();
    } catch (_) {
        throw new Error('Resposta inválida do serviço de IA. Tente novamente.');
    }

    const text = data?.choices?.[0]?.message?.content;

    if (!text || typeof text !== 'string' || text.trim() === '') {
        console.error('[aiService] Resposta sem conteúdo:', JSON.stringify(data));
        throw new Error('O serviço de IA retornou uma resposta vazia. Tente novamente.');
    }

    const usage = data?.usage;
    console.log(`[aiService] OK. Tokens: ${usage?.prompt_tokens || 0} in / ${usage?.completion_tokens || 0} out`);

    return text.trim();
}