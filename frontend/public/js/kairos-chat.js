/**
 * kairos-chat.js — WebChat IA da Biblioteca Kairos
 * Módulo autocontido que injeta o chat em qualquer página.
 * Usa Fetch API para comunicação assíncrona com o backend.
 * O histórico é salvo no sessionStorage (por sessão, não entre abas).
 */

(function () {
    'use strict';

    // ── Configuração ─────────────────────────────────────────────────────────
    const CONFIG = {
        endpoint:       '/api/chat',
        storageKey:     'kairos_chat_history',
        maxHistory:     40,       // máx. de mensagens no histórico enviado à API
        welcomeDelay:   600,      // ms antes de mostrar msg de boas-vindas
        suggestions: [
            '📚 Como solicitar empréstimo?',
            '🔄 Como renovar um livro?',
            '📋 Ver meus empréstimos',
            '🔔 Como funcionam as notificações?',
            '🔍 Como pesquisar livros?',
        ],
    };

    // ── Estado interno ────────────────────────────────────────────────────────
    let isOpen        = false;
    let isWaiting     = false;   // aguardando resposta da IA
    let history       = [];      // [ { role, content } ]
    let unreadCount   = 0;
    let welcomeShown  = false;

    // ── Elementos do DOM ──────────────────────────────────────────────────────
    let btn, window_, messages, input, sendBtn, badge, suggestionsEl, typingEl;

    // ── Inicialização ─────────────────────────────────────────────────────────
    function init() {
        injectCSS();
        injectHTML();
        bindElements();
        bindEvents();
        loadHistory();

        // Mostra boas-vindas se não há histórico
        setTimeout(() => {
            if (history.length === 0) showWelcome();
        }, CONFIG.welcomeDelay);
    }

    function injectCSS() {
        // O CSS já é carregado via <link> nas páginas — não injetar novamente
        // Mas caso não esteja, injeta dinamicamente
        if (!document.querySelector('link[href*="kairos-chat.css"]')) {
            const link = document.createElement('link');
            link.rel  = 'stylesheet';
            // Detecta profundidade do caminho atual
            const depth = (window.location.pathname.match(/\//g) || []).length - 1;
            link.href = '../'.repeat(Math.max(depth - 1, 0)) + 'css/kairos-chat.css';
            document.head.appendChild(link);
        }
    }

    function injectHTML() {
        const div = document.createElement('div');
        div.innerHTML = `
<!-- ── Botão flutuante ── -->
<button id="kairos-chat-btn" aria-label="Abrir assistente virtual Kairos" title="Assistente Kairos">
    <svg class="icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
    <span id="kairos-chat-badge"></span>
</button>

<!-- ── Janela do chat ── -->
<div id="kairos-chat-window" role="dialog" aria-label="Chat Assistente Kairos" aria-modal="true">

    <!-- Header -->
    <div class="kc-header">
        <div class="kc-avatar" aria-hidden="true">✨</div>
        <div class="kc-header-info">
            <div class="kc-header-title">Assistente Kairos</div>
            <div class="kc-header-status">
                <span class="kc-status-dot"></span>
                Online agora
            </div>
        </div>
        <div class="kc-header-actions">
            <button class="kc-icon-btn" id="kc-clear-btn" title="Limpar conversa" aria-label="Limpar conversa">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
            </button>
            <button class="kc-icon-btn" id="kc-close-btn" title="Fechar chat" aria-label="Fechar chat">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    </div>

    <!-- Mensagens -->
    <div class="kc-messages" id="kc-messages" role="log" aria-live="polite"></div>

    <!-- Sugestões -->
    <div class="kc-suggestions" id="kc-suggestions"></div>

    <!-- Input -->
    <div class="kc-footer">
        <div class="kc-input-wrapper">
            <textarea
                id="kc-input"
                class="kc-input"
                placeholder="Digite sua dúvida…"
                rows="1"
                aria-label="Mensagem para o assistente"
                maxlength="4000"
            ></textarea>
        </div>
        <button id="kc-send-btn" class="kc-send-btn" aria-label="Enviar mensagem" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
        </button>
    </div>

</div>
        `.trim();

        document.body.appendChild(div.children[0]); // botão
        document.body.appendChild(div.children[0]); // janela
    }

    function bindElements() {
        btn          = document.getElementById('kairos-chat-btn');
        window_      = document.getElementById('kairos-chat-window');
        messages     = document.getElementById('kc-messages');
        input        = document.getElementById('kc-input');
        sendBtn      = document.getElementById('kc-send-btn');
        badge        = document.getElementById('kairos-chat-badge');
        suggestionsEl= document.getElementById('kc-suggestions');
    }

    function bindEvents() {
        // Abre/fecha ao clicar no botão flutuante
        btn.addEventListener('click', toggleChat);

        // Botão de fechar no header
        document.getElementById('kc-close-btn').addEventListener('click', closeChat);

        // Botão de limpar conversa
        document.getElementById('kc-clear-btn').addEventListener('click', clearChat);

        // Botão enviar
        sendBtn.addEventListener('click', sendMessage);

        // Enter envia (Shift+Enter cria nova linha)
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Habilita/desabilita botão enviar + auto-resize textarea
        input.addEventListener('input', () => {
            const hasText = input.value.trim().length > 0;
            sendBtn.disabled = !hasText || isWaiting;

            // Auto-resize
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });

        // Fecha ao clicar fora da janela (mas não no botão)
        document.addEventListener('click', (e) => {
            if (isOpen && !window_.contains(e.target) && !btn.contains(e.target)) {
                closeChat();
            }
        });

        // Fecha com Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) closeChat();
        });
    }

    // ── Abrir / Fechar ────────────────────────────────────────────────────────
    function toggleChat() {
        isOpen ? closeChat() : openChat();
    }

    function openChat() {
        isOpen = true;
        btn.classList.add('is-open');
        window_.classList.add('is-open');
        window_.setAttribute('aria-hidden', 'false');

        // Limpa badge de não lidos
        unreadCount = 0;
        updateBadge();

        // Foca no input
        setTimeout(() => {
            input.focus();
            scrollToBottom();
        }, 280);

        // Carrega sugestões se não há histórico
        if (history.length === 0 || (history.length === 1 && history[0].role === 'assistant')) {
            renderSuggestions();
        }
    }

    function closeChat() {
        isOpen = false;
        btn.classList.remove('is-open');
        window_.classList.remove('is-open');
        window_.setAttribute('aria-hidden', 'true');
    }

    // ── Envio de mensagem ─────────────────────────────────────────────────────
    async function sendMessage() {
        const text = input.value.trim();
        if (!text || isWaiting) return;

        // Esconde sugestões após primeiro envio
        suggestionsEl.innerHTML = '';

        // Adiciona ao DOM e histórico
        appendMessage('user', text);
        history.push({ role: 'user', content: text });
        saveHistory();

        // Limpa input
        input.value = '';
        input.style.height = 'auto';
        sendBtn.disabled = true;

        // Mostra indicador de digitação
        showTyping();
        isWaiting = true;

        try {
            // Usa os últimos N turnos para não exceder contexto
            const apiMessages = history.slice(-CONFIG.maxHistory);

            const res = await fetch(CONFIG.endpoint, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ messages: apiMessages }),
            });

            const data = await res.json();

            hideTyping();
            isWaiting = false;

            if (!res.ok) {
                const errorMsg = data.error || 'Erro ao processar sua mensagem.';
                appendMessage('bot', `⚠️ ${errorMsg}`, true);
                console.error('[kairos-chat] Erro da API:', errorMsg);
                return;
            }

            const reply = data.reply || 'Desculpe, não consegui gerar uma resposta.';
            appendMessage('bot', reply);
            history.push({ role: 'assistant', content: reply });
            saveHistory();

            // Incrementa badge se chat estiver fechado
            if (!isOpen) {
                unreadCount++;
                updateBadge();
            }

        } catch (err) {
            hideTyping();
            isWaiting = false;
            appendMessage('bot', '⚠️ Não foi possível conectar ao assistente. Verifique sua conexão e tente novamente.', true);
            console.error('[kairos-chat] Erro de rede:', err);
        }
    }

    // ── Renderização de mensagens ─────────────────────────────────────────────
    function appendMessage(role, content, isError = false) {
        const msgEl = document.createElement('div');
        msgEl.className = `kc-msg ${role}${isError ? ' error' : ''}`;

        const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const avatarIcon = role === 'bot' ? '✨' : getUserInitial();

        msgEl.innerHTML = `
            <div class="kc-msg-avatar" aria-hidden="true">${avatarIcon}</div>
            <div>
                <div class="kc-bubble">${formatMessage(content)}</div>
                <div class="kc-msg-time">${time}</div>
            </div>
        `;

        messages.appendChild(msgEl);
        scrollToBottom();
    }

    function formatMessage(text) {
        // Converte markdown básico para HTML
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^(.*)$/, '<p>$1</p>')
            .replace(/<p><\/p>/g, '');
    }

    function getUserInitial() {
        try {
            const user = JSON.parse(sessionStorage.getItem('usuario') || localStorage.getItem('usuario') || '{}');
            if (user && user.Nome) return user.Nome.charAt(0).toUpperCase();
        } catch {}
        return '👤';
    }

    // ── Indicador de digitação ────────────────────────────────────────────────
    function showTyping() {
        typingEl = document.createElement('div');
        typingEl.className = 'kc-msg bot';
        typingEl.id = 'kc-typing-indicator';
        typingEl.innerHTML = `
            <div class="kc-msg-avatar" aria-hidden="true">✨</div>
            <div class="kc-typing" aria-label="Assistente está digitando">
                <div class="kc-typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        messages.appendChild(typingEl);
        scrollToBottom();
    }

    function hideTyping() {
        const existing = document.getElementById('kc-typing-indicator');
        if (existing) existing.remove();
    }

    // ── Mensagem de boas-vindas ───────────────────────────────────────────────
    function showWelcome() {
        if (welcomeShown) return;
        welcomeShown = true;

        const welcomeEl = document.createElement('div');
        welcomeEl.className = 'kc-welcome';
        welcomeEl.innerHTML = `
            <span class="kc-welcome-icon">📚</span>
            <h3>Olá! Sou o Assistente Kairos</h3>
            <p>Estou aqui para ajudar com dúvidas sobre a biblioteca.<br>Selecione uma opção abaixo ou escreva sua pergunta!</p>
        `;
        messages.appendChild(welcomeEl);

        // Adiciona mensagem de boas-vindas ao histórico (para contexto)
        const welcomeMsg = 'Olá! Sou o Assistente Virtual da Biblioteca Kairos 📚. Como posso ajudar você hoje? Posso responder dúvidas sobre empréstimos, devoluções, catálogo de livros e tudo sobre o sistema!';
        appendMessage('bot', welcomeMsg);
        history.push({ role: 'assistant', content: welcomeMsg });
        saveHistory();

        renderSuggestions();
    }

    // ── Sugestões rápidas ─────────────────────────────────────────────────────
    function renderSuggestions() {
        suggestionsEl.innerHTML = '';
        CONFIG.suggestions.forEach((text) => {
            const btn = document.createElement('button');
            btn.className = 'kc-suggestion-btn';
            btn.textContent = text;
            btn.addEventListener('click', () => {
                // Remove emoji para enviar texto limpo
                const cleanText = text.replace(/^[^\w]+/, '').trim();
                input.value = cleanText;
                input.dispatchEvent(new Event('input'));
                sendMessage();
                suggestionsEl.innerHTML = '';
            });
            suggestionsEl.appendChild(btn);
        });
    }

    // ── Limpar conversa ───────────────────────────────────────────────────────
    function clearChat() {
        history = [];
        saveHistory();
        messages.innerHTML = '';
        suggestionsEl.innerHTML = '';
        welcomeShown = false;
        showWelcome();
    }

    // ── Utilidades ────────────────────────────────────────────────────────────
    function scrollToBottom() {
        requestAnimationFrame(() => {
            messages.scrollTop = messages.scrollHeight;
        });
    }

    function updateBadge() {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.classList.add('show');
        } else {
            badge.classList.remove('show');
        }
    }

    // ── Persistência do histórico ─────────────────────────────────────────────
    function saveHistory() {
        try {
            // Salva apenas as últimas 20 mensagens para não sobrecarregar
            const toSave = history.slice(-20);
            sessionStorage.setItem(CONFIG.storageKey, JSON.stringify(toSave));
        } catch {}
    }

    function loadHistory() {
        try {
            const stored = sessionStorage.getItem(CONFIG.storageKey);
            if (!stored) return;

            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed) || parsed.length === 0) return;

            history = parsed;
            welcomeShown = true; // Não mostrar boas-vindas se já há histórico

            // Re-renderiza as mensagens salvas
            parsed.forEach(msg => {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    appendMessage(msg.role === 'assistant' ? 'bot' : 'user', msg.content);
                }
            });

        } catch {
            // Histórico corrompido — limpa silenciosamente
            sessionStorage.removeItem(CONFIG.storageKey);
        }
    }

    // ── Inicializa quando o DOM estiver pronto ────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
