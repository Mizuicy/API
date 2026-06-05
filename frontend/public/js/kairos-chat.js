/**
 * kairos-chat.js — WebChat IA da Biblioteca Kairos  [v2.0 — CORRIGIDO]
 * Módulo autocontido que injeta o chat em qualquer página.
 * Usa Fetch API para comunicação assíncrona com o backend.
 * O histórico é salvo no sessionStorage (por sessão) e localStorage (persistente).
 *
 * CORREÇÕES v2.0:
 *  - Chat não fecha mais ao enviar mensagem (stopPropagation nos elementos internos)
 *  - Histórico persistido em localStorage além de sessionStorage
 *  - IA expandida: suporte a resumos, perguntas gerais e integração com acervo
 *  - Sugestões ampliadas para cobrir as novas funcionalidades
 */

(function () {
    'use strict';

    // ── Configuração ─────────────────────────────────────────────────────────
    const CONFIG = {
        endpoint:       '/api/chat',
        storageKey:     'kairos_chat_history',
        maxHistory:     40,
        welcomeDelay:   600,
        suggestions: [
            '📚 Como solicitar empréstimo?',
            '🔄 Como renovar um livro?',
            '📖 Resuma Dom Casmurro',
            '🔍 Quais livros estão disponíveis?',
            '🔔 Como funcionam as notificações?',
        ],
    };

    // ── Estado interno ────────────────────────────────────────────────────────
    let isOpen        = false;
    let isWaiting     = false;
    let history       = [];
    let unreadCount   = 0;
    let welcomeShown  = false;

    // ── Elementos do DOM ──────────────────────────────────────────────────────
    let btn, window_, messages, input, sendBtn, badge, suggestionsEl;

    // ── Inicialização ─────────────────────────────────────────────────────────
    function init() {
        injectCSS();
        injectHTML();
        bindElements();
        bindEvents();
        loadHistory();

        setTimeout(() => {
            if (history.length === 0) showWelcome();
        }, CONFIG.welcomeDelay);
    }

    function injectCSS() {
        if (!document.querySelector('link[href*="kairos-chat.css"]')) {
            const link = document.createElement('link');
            link.rel  = 'stylesheet';
            const depth = (window.location.pathname.match(/\//g) || []).length - 1;
            link.href = '../'.repeat(Math.max(depth - 1, 0)) + 'css/kairos-chat.css';
            document.head.appendChild(link);
        }
    }

    function injectHTML() {
        const div = document.createElement('div');
        div.innerHTML = `
<button id="kairos-chat-btn" aria-label="Abrir assistente virtual Kairos" title="Assistente Kairos">
    <svg class="icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
    <span id="kairos-chat-badge"></span>
</button>

<div id="kairos-chat-window" role="dialog" aria-label="Chat Assistente Kairos" aria-modal="true">

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

    <div class="kc-messages" id="kc-messages" role="log" aria-live="polite"></div>

    <div class="kc-suggestions" id="kc-suggestions"></div>

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
        btn           = document.getElementById('kairos-chat-btn');
        window_       = document.getElementById('kairos-chat-window');
        messages      = document.getElementById('kc-messages');
        input         = document.getElementById('kc-input');
        sendBtn       = document.getElementById('kc-send-btn');
        badge         = document.getElementById('kairos-chat-badge');
        suggestionsEl = document.getElementById('kc-suggestions');
    }

    function bindEvents() {
        // ── CORREÇÃO PRINCIPAL: stopPropagation em toda a janela do chat ──────
        // Impede que cliques dentro do chat alcancem o document click handler
        window_.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        // O botão flutuante também precisa parar propagação para não conflitar
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleChat();
        });

        // Botão de fechar no header
        document.getElementById('kc-close-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            closeChat();
        });

        // Botão de limpar conversa
        document.getElementById('kc-clear-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            clearChat();
        });

        // Botão enviar — sem preventDefault desnecessário, sem propagation
        sendBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            sendMessage();
        });

        // Enter envia (Shift+Enter nova linha)
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                sendMessage();
            }
        });

        // Habilita/desabilita botão + auto-resize
        input.addEventListener('input', function() {
            const hasText = input.value.trim().length > 0;
            sendBtn.disabled = !hasText || isWaiting;
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });

        // Fecha ao clicar fora — apenas quando o clique não veio de dentro do chat
        document.addEventListener('click', function(e) {
            if (isOpen && !window_.contains(e.target) && !btn.contains(e.target)) {
                closeChat();
            }
        });

        // Fecha com Escape
        document.addEventListener('keydown', function(e) {
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

        unreadCount = 0;
        updateBadge();

        setTimeout(function() {
            input.focus();
            scrollToBottom();
        }, 280);

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

        // Adiciona mensagem do usuário imediatamente ao DOM e histórico
        appendMessage('user', text);
        history.push({ role: 'user', content: text });
        saveHistory();

        // Limpa input e mantém o chat ABERTO
        input.value = '';
        input.style.height = 'auto';
        sendBtn.disabled = true;

        // Indicador de digitação
        showTyping();
        isWaiting = true;

        try {
            const apiMessages = history.slice(-CONFIG.maxHistory);

            const res = await fetch(CONFIG.endpoint, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ messages: apiMessages }),
            });

            const data = await res.json();

            hideTyping();
            isWaiting = false;
            sendBtn.disabled = input.value.trim().length === 0;

            if (!res.ok) {
                const errorMsg = data.error || 'Erro ao processar sua mensagem.';
                appendMessage('bot', '⚠️ ' + errorMsg, true);
                console.error('[kairos-chat] Erro da API:', errorMsg);
                return;
            }

            const reply = data.reply || 'Desculpe, não consegui gerar uma resposta.';
            appendMessage('bot', reply);
            history.push({ role: 'assistant', content: reply });
            saveHistory();

            if (!isOpen) {
                unreadCount++;
                updateBadge();
            }

        } catch (err) {
            hideTyping();
            isWaiting = false;
            sendBtn.disabled = input.value.trim().length === 0;
            appendMessage('bot', '⚠️ Não foi possível conectar ao assistente. Verifique sua conexão e tente novamente.', true);
            console.error('[kairos-chat] Erro de rede:', err);
        }
    }

    // ── Renderização de mensagens ─────────────────────────────────────────────
    function appendMessage(role, content, isError) {
        isError = isError || false;
        const msgEl = document.createElement('div');
        msgEl.className = 'kc-msg ' + role + (isError ? ' error' : '');

        const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const avatarIcon = role === 'bot' ? '✨' : getUserInitial();

        msgEl.innerHTML =
            '<div class="kc-msg-avatar" aria-hidden="true">' + avatarIcon + '</div>' +
            '<div>' +
                '<div class="kc-bubble">' + formatMessage(content) + '</div>' +
                '<div class="kc-msg-time">' + time + '</div>' +
            '</div>';

        messages.appendChild(msgEl);
        scrollToBottom();
    }

    function formatMessage(text) {
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
            var user = JSON.parse(sessionStorage.getItem('usuario') || localStorage.getItem('usuario') || '{}');
            if (user && user.Nome) return user.Nome.charAt(0).toUpperCase();
        } catch (e) {}
        return '👤';
    }

    // ── Indicador de digitação ────────────────────────────────────────────────
    function showTyping() {
        var typingEl = document.createElement('div');
        typingEl.className = 'kc-msg bot';
        typingEl.id = 'kc-typing-indicator';
        typingEl.innerHTML =
            '<div class="kc-msg-avatar" aria-hidden="true">✨</div>' +
            '<div class="kc-typing" aria-label="Assistente está digitando">' +
                '<div class="kc-typing-dots">' +
                    '<span></span><span></span><span></span>' +
                '</div>' +
            '</div>';
        messages.appendChild(typingEl);
        scrollToBottom();
    }

    function hideTyping() {
        var existing = document.getElementById('kc-typing-indicator');
        if (existing) existing.remove();
    }

    // ── Mensagem de boas-vindas ───────────────────────────────────────────────
    function showWelcome() {
        if (welcomeShown) return;
        welcomeShown = true;

        var welcomeEl = document.createElement('div');
        welcomeEl.className = 'kc-welcome';
        welcomeEl.innerHTML =
            '<span class="kc-welcome-icon">📚</span>' +
            '<h3>Olá! Sou o Assistente Kairos</h3>' +
            '<p>Posso ajudar com a biblioteca, responder perguntas gerais, gerar resumos de livros e muito mais!<br>Selecione uma opção ou escreva sua pergunta.</p>';
        messages.appendChild(welcomeEl);

        var welcomeMsg = 'Olá! Sou o Assistente Virtual da Biblioteca Kairos 📚. Posso ajudar com:\n\n- **Dúvidas sobre o sistema** (empréstimos, devoluções, catálogo)\n- **Resumos de livros** — experimente: "Resuma Dom Casmurro"\n- **Consulta ao acervo** — "Quais livros estão disponíveis?"\n- **Perguntas gerais** — é só perguntar!\n\nComo posso ajudar você hoje?';
        appendMessage('bot', welcomeMsg);
        history.push({ role: 'assistant', content: welcomeMsg });
        saveHistory();

        renderSuggestions();
    }

    // ── Sugestões rápidas ─────────────────────────────────────────────────────
    function renderSuggestions() {
        suggestionsEl.innerHTML = '';
        CONFIG.suggestions.forEach(function(text) {
            var suggBtn = document.createElement('button');
            suggBtn.className = 'kc-suggestion-btn';
            suggBtn.textContent = text;
            suggBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var cleanText = text.replace(/^[^\w]+/, '').trim();
                input.value = cleanText;
                input.dispatchEvent(new Event('input'));
                sendMessage();
                suggestionsEl.innerHTML = '';
            });
            suggestionsEl.appendChild(suggBtn);
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
        requestAnimationFrame(function() {
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

    // ── Persistência do histórico (sessionStorage + localStorage) ─────────────
    function saveHistory() {
        try {
            var toSave = history.slice(-20);
            var serialized = JSON.stringify(toSave);
            sessionStorage.setItem(CONFIG.storageKey, serialized);
            // Persiste também no localStorage para sobreviver entre sessões
            localStorage.setItem(CONFIG.storageKey, serialized);
        } catch (e) {}
    }

    function loadHistory() {
        try {
            // Tenta sessionStorage primeiro, depois localStorage
            var stored = sessionStorage.getItem(CONFIG.storageKey)
                      || localStorage.getItem(CONFIG.storageKey);
            if (!stored) return;

            var parsed = JSON.parse(stored);
            if (!Array.isArray(parsed) || parsed.length === 0) return;

            history = parsed;
            welcomeShown = true;

            parsed.forEach(function(msg) {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    appendMessage(msg.role === 'assistant' ? 'bot' : 'user', msg.content);
                }
            });

        } catch (e) {
            sessionStorage.removeItem(CONFIG.storageKey);
            localStorage.removeItem(CONFIG.storageKey);
        }
    }

    // ── Inicializa quando o DOM estiver pronto ────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();