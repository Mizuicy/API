/**
 * aiService.js — Kairos WebChat IA  [v2.0 — EXPANDIDO]
 * Serviço de comunicação com a API Groq (llama-3.3-70b-versatile).
 *
 * Novidades v2.0:
 *  - IA conversacional geral (não limitada ao sistema Kairos)
 *  - Suporte a resumos de livros
 *  - Integração com o banco de dados para consultas ao acervo
 *  - Detecção automática de intenção de consulta ao acervo
 */

import dbconfig from '../../db/dbconfig.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

// ────────────────────────────────────────────────────────────────────────────
//  System Prompt expandido
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
function buscarAcervo(userMessage) {
    return new Promise((resolve) => {
        // Busca livros com contagem de exemplares disponíveis
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

    const total = livros.length;
    const disponiveis = livros.filter(l => l.ExemplaresDisponiveis > 0).length;

    let texto = `\n\n[DADOS REAIS DO ACERVO DA BIBLIOTECA KAIROS - ${new Date().toLocaleDateString('pt-BR')}]\n`;
    texto += `Total de títulos: ${total} | Títulos com exemplares disponíveis: ${disponiveis}\n\n`;
    texto += 'Lista de livros:\n';

    livros.forEach(livro => {
        texto += `- "${livro.Titulo}"`;
        if (livro.Autor) texto += ` | Autor: ${livro.Autor}`;
        if (livro.Categoria) texto += ` | Categoria: ${livro.Categoria}`;
        if (livro.AnoPublicacao) texto += ` | Ano: ${livro.AnoPublicacao}`;
        texto += ` | Disponíveis: ${livro.ExemplaresDisponiveis}/${livro.TotalExemplares} exemplares`;
        texto += '\n';
    });

    texto += '\nIMPORTANTE: Use APENAS esses dados para responder perguntas sobre o acervo. Não invente livros.';
    texto += '\n[FIM DOS DADOS DO ACERVO]';

    return texto;
}

// ────────────────────────────────────────────────────────────────────────────
//  Função principal
// ────────────────────────────────────────────────────────────────────────────
export async function getChatResponse(messages) {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        console.error('[aiService] GROQ_API_KEY não configurada no .env');
        throw new Error('Configuração de IA ausente. Contate o administrador.');
    }

    // Verifica se a última mensagem do usuário pede dados do acervo
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    let acervoContexto = '';

    if (lastUserMsg && isAcervoQuery(lastUserMsg.content)) {
        console.log('[aiService] Consulta ao acervo detectada — buscando dados do banco...');
        try {
            const livros = await buscarAcervo(lastUserMsg.content);
            acervoContexto = formatarAcervoParaIA(livros);
            console.log(`[aiService] Acervo carregado: ${livros ? livros.length : 0} livros`);
        } catch (err) {
            console.error('[aiService] Falha ao buscar acervo:', err.message);
        }
    }

    // Monta system prompt com dados do acervo (se houver)
    const systemContent = SYSTEM_PROMPT + acervoContexto;

    const formattedMessages = [
        { role: 'system', content: systemContent },
        ...messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: String(m.content).trim() })),
    ];

    const lastMsg = formattedMessages[formattedMessages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user') {
        throw new Error('Mensagem do usuário ausente.');
    }

    console.log(`[aiService] Enviando ${formattedMessages.length - 1} msg(s) para o Groq${acervoContexto ? ' (com dados do acervo)' : ''}...`);

    const response = await fetch(GROQ_API_URL, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model:       GROQ_MODEL,
            messages:    formattedMessages,
            max_tokens:  2048,   // Aumentado para suportar resumos de livros
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
    console.log(`[aiService] OK. Tokens: ${usage?.prompt_tokens || 0} in / ${usage?.completion_tokens || 0} out`);

    return text;
}