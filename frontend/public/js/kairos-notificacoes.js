/**
 * kairos-notificacoes.js — VERSÃO CORRIGIDA
 * ✅ FIX: usa /notificacoes (banco) em vez de /emprestimo/vencendo
 * ✅ FIX: lê usuarioId do sessionStorage (salvo após login)
 * ✅ FIX: marcar como lida / não lida com persistência via API
 */

(function () {
    'use strict';

    const API = 'http://localhost:3000';
    let _notificacoes = [];

    const CSS = `
        #kn-bell-btn {
            position: relative; background: none; border: none; cursor: pointer;
            padding: 7px; border-radius: 9px; color: var(--muted);
            display: flex; align-items: center; justify-content: center;
            transition: background .15s, color .15s; flex-shrink: 0;
        }
        #kn-bell-btn:hover { background: var(--bg); color: var(--text); }
        #kn-bell-btn.kn-active { color: #d97706; animation: kn-ring 0.5s ease 0.2s 2; }
        @keyframes kn-ring {
            0%,100% { transform: rotate(0); }
            20%      { transform: rotate(-18deg); }
            60%      { transform: rotate(14deg); }
            80%      { transform: rotate(-8deg); }
        }
        #kn-badge {
            display: none; position: absolute; top: 3px; right: 3px;
            width: 17px; height: 17px; background: #ef4444; color: #fff;
            border-radius: 50%; font-size: 0.65rem; font-weight: 700;
            align-items: center; justify-content: center; line-height: 1;
            border: 2px solid var(--surface); font-family: 'DM Sans', sans-serif;
        }
        #kn-badge.kn-show { display: flex; }
        #kn-dropdown {
            display: none; position: absolute; top: calc(100% + 10px); right: 0;
            width: 340px; background: var(--surface); border: 1px solid var(--border);
            border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.14);
            z-index: 9999; overflow: hidden; animation: kn-drop .2s ease;
        }
        @keyframes kn-drop {
            from { opacity:0; transform: translateY(-8px) scale(.97); }
            to   { opacity:1; transform: none; }
        }
        #kn-dropdown.kn-open { display: block; }
        .kn-dd-header {
            padding: 14px 18px 10px; border-bottom: 1px solid var(--border);
            display: flex; align-items: center; justify-content: space-between;
        }
        .kn-dd-title { font-size: 0.88rem; font-weight: 700; color: var(--text); font-family: 'DM Sans', sans-serif; }
        .kn-dd-clear { font-size: 0.75rem; color: var(--purple); cursor: pointer; background: none; border: none; font-family: inherit; padding: 0; }
        .kn-dd-clear:hover { text-decoration: underline; }
        .kn-list { max-height: 360px; overflow-y: auto; }
        .kn-item {
            display: flex; gap: 10px; align-items: flex-start;
            padding: 12px 18px; border-bottom: 1px solid var(--border);
            transition: background .12s; color: inherit;
        }
        .kn-item:last-child { border-bottom: none; }
        .kn-item:hover { background: var(--bg); }
        .kn-item.kn-nao-lida { background: rgba(245,158,11,0.06); }
        .kn-item-icon {
            width: 36px; height: 36px; border-radius: 10px;
            background: #fef9ec; border: 1px solid #f59e0b;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.1rem; flex-shrink: 0; margin-top: 1px;
        }
        [data-theme="dark"] .kn-item-icon { background: #422006; border-color: #92400e; }
        .kn-item-body { flex: 1; min-width: 0; }
        .kn-item-book {
            font-size: 0.875rem; font-weight: 600; color: var(--text);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            font-family: 'DM Sans', sans-serif;
        }
        .kn-item.kn-nao-lida .kn-item-book { color: #d97706; }
        .kn-item-msg { font-size: 0.78rem; color: var(--muted); margin-top: 2px; font-family: 'DM Sans', sans-serif; }
        .kn-item-date { font-size: 0.72rem; font-weight: 600; color: #d97706; margin-top: 4px; }
        .kn-item-actions { display: flex; gap: 6px; margin-top: 5px; }
        .kn-btn-acao {
            font-size: 0.70rem; padding: 2px 8px; border-radius: 6px; cursor: pointer;
            border: 1px solid var(--border); background: var(--surface);
            color: var(--muted); font-family: 'DM Sans', sans-serif; transition: all .15s;
        }
        .kn-btn-acao:hover { background: #fef9ec; color: #92400e; border-color: #fcd34d; }
        .kn-empty {
            padding: 28px 18px; text-align: center; color: var(--muted);
            font-size: 0.88rem; font-family: 'DM Sans', sans-serif;
        }
        .kn-empty-icon { font-size: 2rem; display: block; margin-bottom: 8px; }
        .kn-dd-footer { border-top: 1px solid var(--border); padding: 10px 18px; text-align: center; }
        .kn-dd-footer a {
            font-size: 0.82rem; color: var(--purple); font-weight: 600;
            text-decoration: none; font-family: 'DM Sans', sans-serif;
        }
        .kn-dd-footer a:hover { text-decoration: underline; }
        #kn-wrapper { position: relative; }
    `;

    function injetarCSS() {
        if (document.getElementById('kn-style')) return;
        const style = document.createElement('style');
        style.id = 'kn-style';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    function criarSino() {
        if (document.getElementById('kn-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'kn-wrapper';
        wrapper.innerHTML = `
            <button id="kn-bell-btn" title="Notificações" aria-label="Notificações" aria-haspopup="true" aria-expanded="false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span id="kn-badge">0</span>
            </button>
            <div id="kn-dropdown" role="menu">
                <div class="kn-dd-header">
                    <span class="kn-dd-title">🔔 Notificações</span>
                    <button class="kn-dd-clear" id="kn-mark-all">Marcar todas como lidas</button>
                </div>
                <div class="kn-list" id="kn-list"></div>
                <div class="kn-dd-footer">
                    <a href="meus-emprestimos.html">Ver todos os empréstimos →</a>
                </div>
            </div>
        `;

        const userActions = document.querySelector('.u-user-actions');
        const themeBtn    = document.querySelector('.theme-toggle');
        if (userActions) {
            userActions.parentNode.insertBefore(wrapper, userActions);
        } else if (themeBtn) {
            themeBtn.parentNode.insertBefore(wrapper, themeBtn.nextSibling);
        }

        document.getElementById('kn-bell-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const dd  = document.getElementById('kn-dropdown');
            const btn = document.getElementById('kn-bell-btn');
            const open = dd.classList.toggle('kn-open');
            btn.setAttribute('aria-expanded', open);
        });

        document.addEventListener('click', (e) => {
            const w = document.getElementById('kn-wrapper');
            if (w && !w.contains(e.target)) {
                document.getElementById('kn-dropdown').classList.remove('kn-open');
                document.getElementById('kn-bell-btn').setAttribute('aria-expanded', 'false');
            }
        });

        document.getElementById('kn-mark-all').addEventListener('click', async () => {
            const uid = sessionStorage.getItem('usuarioId');
            if (!uid) return;
            try { await fetch(`${API}/notificacoes/marcar-todas-lidas?usuario=${uid}`, { method: 'PATCH' }); } catch (_) {}
            _notificacoes.forEach(n => n.Lida = 1);
            renderizarLista(_notificacoes);
            document.getElementById('kn-dropdown').classList.remove('kn-open');
        });
    }

    async function marcarLida(id) {
        try { await fetch(`${API}/notificacoes/${id}/lida`, { method: 'PATCH' }); } catch (_) {}
        const n = _notificacoes.find(n => n.Notificacao_id === id);
        if (n) n.Lida = 1;
        renderizarLista(_notificacoes);
    }

    async function marcarNaoLida(id) {
        try { await fetch(`${API}/notificacoes/${id}/nao-lida`, { method: 'PATCH' }); } catch (_) {}
        const n = _notificacoes.find(n => n.Notificacao_id === id);
        if (n) n.Lida = 0;
        renderizarLista(_notificacoes);
    }

    function renderizarLista(notificacoes) {
        const list  = document.getElementById('kn-list');
        const badge = document.getElementById('kn-badge');
        const btn   = document.getElementById('kn-bell-btn');
        if (!list) return;

        const naoLidas = notificacoes.filter(n => !n.Lida);

        if (!notificacoes || notificacoes.length === 0) {
            list.innerHTML = `<div class="kn-empty"><span class="kn-empty-icon">✅</span>Nenhuma notificação.</div>`;
            badge.classList.remove('kn-show');
            btn.classList.remove('kn-active');
            return;
        }

        list.innerHTML = notificacoes.map(n => {
            const dataFmt = n.DataPrevista
                ? new Date(n.DataPrevista).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                : '';
            const lida = n.Lida ? 1 : 0;
            return `
                <div class="kn-item ${lida ? '' : 'kn-nao-lida'}" data-id="${n.Notificacao_id}">
                    <span class="kn-item-icon">📚</span>
                    <div class="kn-item-body">
                        <div class="kn-item-book">${n.NomeLivro || 'Livro'}</div>
                        <div class="kn-item-msg">${n.Mensagem || 'Vencimento se aproximando'}</div>
                        ${dataFmt ? `<div class="kn-item-date">⏰ Vence em: ${dataFmt}</div>` : ''}
                        <div class="kn-item-actions">
                            ${lida
                                ? `<button class="kn-btn-acao" data-action="nao-lida" data-id="${n.Notificacao_id}">Marcar como não lida</button>`
                                : `<button class="kn-btn-acao" data-action="lida" data-id="${n.Notificacao_id}">Marcar como lida</button>`
                            }
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('[data-action]').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(b.dataset.id, 10);
                if (b.dataset.action === 'lida') marcarLida(id);
                else marcarNaoLida(id);
            });
        });

        if (naoLidas.length > 0) {
            badge.textContent = naoLidas.length;
            badge.classList.add('kn-show');
            btn.classList.add('kn-active');
        } else {
            badge.classList.remove('kn-show');
            btn.classList.remove('kn-active');
        }
    }

    async function verificarNotificacoes() {
        const usuarioId = sessionStorage.getItem('usuarioId');
        if (!usuarioId) {
            console.warn('[Kairos Notif] usuarioId ausente na sessão — faça login novamente.');
            return;
        }
        try {
            const res = await fetch(`${API}/notificacoes?usuario=${usuarioId}`);
            if (!res.ok) {
                console.warn('[Kairos Notif] Erro na API:', res.status, res.statusText);
                return;
            }
            _notificacoes = await res.json();
            renderizarLista(_notificacoes);
        } catch (err) {
            console.warn('[Kairos Notif] Falha ao buscar notificações:', err.message);
        }
    }

    function init() {
        injetarCSS();
        criarSino();
        verificarNotificacoes();
        setInterval(verificarNotificacoes, 5 * 60 * 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
