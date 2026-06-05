/**
 * kairos-notificacoes-admin.js — Kairos Biblioteca
 * Sistema de notificações para o painel do administrador.
 * Inclui funcionalidade real de aprovar/reprovar solicitações de empréstimo.
 */

(function () {
    'use strict';

    const API = 'http://localhost:3000';
    let _notificacoes = [];

    const CSS = `
        #kna-bell-btn {
            position: relative; background: none; border: none; cursor: pointer;
            padding: 7px; border-radius: 9px; color: var(--muted, #888);
            display: flex; align-items: center; justify-content: center;
            transition: background .15s, color .15s; flex-shrink: 0;
        }
        #kna-bell-btn:hover { background: var(--bg, #f5f5f5); color: var(--text, #333); }
        #kna-bell-btn.kna-active { color: #d97706; animation: kna-ring 0.5s ease 0.2s 2; }
        @keyframes kna-ring {
            0%,100% { transform: rotate(0); }
            20%      { transform: rotate(-18deg); }
            60%      { transform: rotate(14deg); }
            80%      { transform: rotate(-8deg); }
        }
        #kna-badge {
            display: none; position: absolute; top: 3px; right: 3px;
            width: 17px; height: 17px; background: #ef4444; color: #fff;
            border-radius: 50%; font-size: 0.65rem; font-weight: 700;
            align-items: center; justify-content: center; line-height: 1;
            border: 2px solid var(--surface, #fff); font-family: 'DM Sans', sans-serif;
        }
        #kna-badge.kna-show { display: flex; }
        #kna-dropdown {
            display: none; position: absolute; top: calc(100% + 10px); right: 0;
            width: 360px; background: var(--surface, #fff); border: 1px solid var(--border, #e4e4e4);
            border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.14);
            z-index: 9999; overflow: hidden; animation: kna-drop .2s ease;
        }
        @keyframes kna-drop {
            from { opacity:0; transform: translateY(-8px) scale(.97); }
            to   { opacity:1; transform: none; }
        }
        #kna-dropdown.kna-open { display: block; }
        .kna-dd-header {
            padding: 14px 18px 10px; border-bottom: 1px solid var(--border, #e4e4e4);
            display: flex; align-items: center; justify-content: space-between;
        }
        .kna-dd-title { font-size: 0.88rem; font-weight: 700; color: var(--text, #333); font-family: 'DM Sans', sans-serif; }
        .kna-dd-clear { font-size: 0.75rem; color: var(--purple, #667eea); cursor: pointer; background: none; border: none; font-family: inherit; padding: 0; }
        .kna-dd-clear:hover { text-decoration: underline; }
        .kna-list { max-height: 420px; overflow-y: auto; }
        .kna-item {
            display: flex; gap: 10px; align-items: flex-start;
            padding: 12px 18px; border-bottom: 1px solid var(--border, #e4e4e4);
            transition: background .12s; color: inherit;
        }
        .kna-item:last-child { border-bottom: none; }
        .kna-item:hover { background: var(--bg, #f9f9f9); }
        .kna-item.kna-nao-lida { background: rgba(245,158,11,0.06); }
        .kna-item-icon {
            width: 36px; height: 36px; border-radius: 10px;
            background: #fef9ec; border: 1px solid #f59e0b;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.1rem; flex-shrink: 0; margin-top: 1px;
        }
        [data-theme="dark"] .kna-item-icon { background: #422006; border-color: #92400e; }
        .kna-item-body { flex: 1; min-width: 0; }
        .kna-item-titulo {
            font-size: 0.875rem; font-weight: 600; color: var(--text, #333);
            font-family: 'DM Sans', sans-serif;
        }
        .kna-item.kna-nao-lida .kna-item-titulo { color: #d97706; }
        .kna-item-msg { font-size: 0.78rem; color: var(--muted, #888); margin-top: 2px; font-family: 'DM Sans', sans-serif; line-height: 1.4; }
        .kna-item-date { font-size: 0.72rem; font-weight: 600; color: var(--muted, #888); margin-top: 4px; }
        .kna-item-actions { display: flex; gap: 6px; margin-top: 7px; flex-wrap: wrap; }
        .kna-btn-acao {
            font-size: 0.70rem; padding: 3px 10px; border-radius: 6px; cursor: pointer;
            border: 1px solid var(--border, #e4e4e4); background: var(--surface, #fff);
            color: var(--muted, #888); font-family: 'DM Sans', sans-serif; transition: all .15s;
        }
        .kna-btn-acao:hover { background: #fef9ec; color: #92400e; border-color: #fcd34d; }
        .kna-btn-aprovar {
            font-size: 0.70rem; padding: 3px 10px; border-radius: 6px; cursor: pointer;
            border: 1px solid #16a34a; background: #16a34a;
            color: #fff; font-family: 'DM Sans', sans-serif; font-weight: 600; transition: all .15s;
        }
        .kna-btn-aprovar:hover { background: #15803d; border-color: #15803d; }
        .kna-btn-reprovar {
            font-size: 0.70rem; padding: 3px 10px; border-radius: 6px; cursor: pointer;
            border: 1px solid #dc2626; background: #dc2626;
            color: #fff; font-family: 'DM Sans', sans-serif; font-weight: 600; transition: all .15s;
        }
        .kna-btn-reprovar:hover { background: #b91c1c; border-color: #b91c1c; }
        .kna-btn-aprovar:disabled, .kna-btn-reprovar:disabled { opacity: .5; cursor: not-allowed; }
        .kna-status-badge {
            display: inline-block; font-size: 0.68rem; padding: 1px 7px; border-radius: 12px;
            font-weight: 600; margin-top: 3px;
        }
        .kna-status-pendente  { background: #fef9ec; color: #92400e; border: 1px solid #fcd34d; }
        .kna-status-aprovado  { background: #f0fdf4; color: #15803d; border: 1px solid #86efac; }
        .kna-status-reprovado { background: #fef2f2; color: #b91c1c; border: 1px solid #fca5a5; }
        .kna-empty {
            padding: 28px 18px; text-align: center; color: var(--muted, #888);
            font-size: 0.88rem; font-family: 'DM Sans', sans-serif;
        }
        .kna-empty-icon { font-size: 2rem; display: block; margin-bottom: 8px; }
        .kna-dd-footer { border-top: 1px solid var(--border, #e4e4e4); padding: 10px 18px; text-align: center; }
        .kna-dd-footer a {
            font-size: 0.82rem; color: var(--purple, #667eea); font-weight: 600;
            text-decoration: none; font-family: 'DM Sans', sans-serif;
        }
        .kna-dd-footer a:hover { text-decoration: underline; }
        #kna-wrapper { position: relative; display: flex; align-items: center; }

        /* Dark mode */
        [data-theme="dark"] #kna-bell-btn { color: var(--muted); }
        [data-theme="dark"] #kna-bell-btn:hover { background: var(--bg); color: var(--text); }
        [data-theme="dark"] #kna-dropdown { background: var(--surface) !important; border-color: var(--border) !important; box-shadow: 0 12px 40px rgba(0,0,0,0.4) !important; }
        [data-theme="dark"] .kna-dd-title { color: var(--text) !important; }
        [data-theme="dark"] .kna-dd-clear { color: var(--purple) !important; }
        [data-theme="dark"] .kna-item { color: var(--text) !important; border-bottom-color: var(--border) !important; }
        [data-theme="dark"] .kna-item:hover { background: var(--bg) !important; }
        [data-theme="dark"] .kna-item.kna-nao-lida { background: rgba(245,158,11,0.08) !important; }
        [data-theme="dark"] .kna-item-titulo { color: var(--text) !important; }
        [data-theme="dark"] .kna-item.kna-nao-lida .kna-item-titulo { color: #d97706 !important; }
        [data-theme="dark"] .kna-item-msg { color: var(--muted) !important; }
        [data-theme="dark"] .kna-btn-acao { background: var(--surface) !important; border-color: var(--border) !important; color: var(--muted) !important; }
        [data-theme="dark"] .kna-btn-acao:hover { background: rgba(102,126,234,0.12) !important; color: var(--purple) !important; border-color: var(--purple) !important; }
        [data-theme="dark"] .kna-empty { color: var(--muted) !important; }
        [data-theme="dark"] #kna-badge { background: #ef4444 !important; color: #fff !important; }
        [data-theme="dark"] .kna-dd-footer { border-top-color: var(--border) !important; }
        [data-theme="dark"] .kna-dd-header { border-bottom-color: var(--border) !important; }
    `;

    function injetarCSS() {
        if (document.getElementById('kna-style')) return;
        const style = document.createElement('style');
        style.id = 'kna-style';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    function criarSino() {
        const wrapperExistente = document.getElementById('kna-wrapper');
        const wrapper = wrapperExistente || document.createElement('div');
        if (!wrapperExistente) wrapper.id = 'kna-wrapper';

        wrapper.innerHTML = `
            <button id="kna-bell-btn" title="Notificações" aria-label="Notificações" aria-haspopup="true" aria-expanded="false">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span id="kna-badge">0</span>
            </button>
            <div id="kna-dropdown" role="menu">
                <div class="kna-dd-header">
                    <span class="kna-dd-title">🔔 Notificações Admin</span>
                    <button class="kna-dd-clear" id="kna-mark-all">Marcar todas como lidas</button>
                </div>
                <div class="kna-list" id="kna-list"></div>
                <div class="kna-dd-footer">
                    <a href="/pages/gestao/solicitacoes.html">Ver todas as solicitações →</a>
                </div>
            </div>
        `;

        if (!wrapperExistente) {
            const navLinkPerfil = document.querySelector('.nav-link-perfil');
            const navEl         = document.querySelector('.nav');
            if (navLinkPerfil) {
                navLinkPerfil.parentNode.insertBefore(wrapper, navLinkPerfil);
            } else if (navEl) {
                navEl.appendChild(wrapper);
            }
        }

        document.getElementById('kna-bell-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const dd  = document.getElementById('kna-dropdown');
            const btn = document.getElementById('kna-bell-btn');
            const open = dd.classList.toggle('kna-open');
            btn.setAttribute('aria-expanded', open);
        });

        document.addEventListener('click', (e) => {
            // Ignora cliques dentro de dialogs do AdminToast/KairosToast
            if (e.target.closest('#admin-dialog-overlay, #kairos-dialog-overlay')) return;
            const w = document.getElementById('kna-wrapper');
            if (w && !w.contains(e.target)) {
                document.getElementById('kna-dropdown').classList.remove('kna-open');
                document.getElementById('kna-bell-btn').setAttribute('aria-expanded', 'false');
            }
        });

        document.getElementById('kna-mark-all').addEventListener('click', async () => {
            const adminId = sessionStorage.getItem('usuarioId');
            if (!adminId) return;
            try {
                await fetch(`${API}/admin/notificacoes/marcar-todas-lidas?admin=${adminId}`, { method: 'PATCH' });
            } catch (_) {}
            _notificacoes.forEach(n => n.Lida = 1);
            renderizarLista(_notificacoes);
            document.getElementById('kna-dropdown').classList.remove('kna-open');
        });
    }

    async function marcarLida(id) {
        try { await fetch(`${API}/admin/notificacoes/${id}/lida`, { method: 'PATCH' }); } catch (_) {}
        const n = _notificacoes.find(n => n.Notificacao_id === id);
        if (n) n.Lida = 1;
        renderizarLista(_notificacoes);
    }

    async function aprovarSolicitacao(solicitacaoId, notifId, btnAprovar, btnReprovar) {
        const adminId = sessionStorage.getItem('usuarioId');

        if (!window.AdminToast) {
            console.error('[KNA] AdminToast não está carregado. Adicione admin-toast.js antes de kairos-notificacoes-admin.js.');
            return;
        }

        btnAprovar.disabled = true;
        btnReprovar.disabled = true;
        btnAprovar.textContent = 'Aprovando...';
        try {
            const res = await fetch(`${API}/solicitacao/${solicitacaoId}/aprovar`, {
                method : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body   : JSON.stringify({ admin_id: parseInt(adminId) })
            });
            const data = await res.json();
            if (res.ok) {
                // Atualiza notificação como lida
                await marcarLida(notifId);
                // Atualiza status na UI
                const n = _notificacoes.find(n => n.Notificacao_id === notifId);
                if (n) n.StatusSolicitacao = 'aprovado';
                renderizarLista(_notificacoes);
                _mostrarToastAdmin('Solicitação aprovada! Empréstimo criado.', 'success');
                // Dispara evento para páginas que estejam ouvindo
                document.dispatchEvent(new CustomEvent('kna:solicitacao-decidida', { detail: { solicitacaoId, decisao: 'aprovado' } }));
            } else {
                btnAprovar.disabled = false;
                btnReprovar.disabled = false;
                btnAprovar.textContent = 'Aprovar';
                _mostrarToastAdmin(data.error || 'Erro ao aprovar.', 'error');
            }
        } catch (err) {
            btnAprovar.disabled = false;
            btnReprovar.disabled = false;
            btnAprovar.textContent = 'Aprovar';
            _mostrarToastAdmin('Erro de conexão.', 'error');
        }
    }

    async function reprovarSolicitacao(solicitacaoId, notifId, btnAprovar, btnReprovar) {
        const adminId = sessionStorage.getItem('usuarioId');

        if (!window.AdminToast) {
            console.error('[KNA] AdminToast não está carregado. Adicione admin-toast.js antes de kairos-notificacoes-admin.js.');
            return;
        }

        const obs = await AdminToast.prompt(
            'Informe o motivo da reprovação (opcional):',
            {
                titulo: 'Reprovar solicitação',
                tipo: 'warning',
                placeholder: 'Ex: exemplar indisponível, prazo excedido...',
                confirmLabel: 'Reprovar',
                cancelLabel: 'Cancelar'
            }
        );
        if (obs === null) return; // cancelou

        const _disable = (btn, text) => { if (btn) { btn.disabled = true; if (text) btn.textContent = text; } };
        const _enable  = (btn, text) => { if (btn) { btn.disabled = false; if (text) btn.textContent = text; } };

        _disable(btnAprovar);
        _disable(btnReprovar, 'Reprovando...');
        try {
            const res = await fetch(`${API}/solicitacao/${solicitacaoId}/reprovar`, {
                method : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body   : JSON.stringify({ admin_id: parseInt(adminId), observacao: obs || null })
            });
            const data = await res.json();
            if (res.ok) {
                await marcarLida(notifId);
                const n = _notificacoes.find(n => n.Notificacao_id === notifId);
                if (n) n.StatusSolicitacao = 'reprovado';
                renderizarLista(_notificacoes);
                _mostrarToastAdmin('Solicitação reprovada com sucesso.', 'info');
                document.dispatchEvent(new CustomEvent('kna:solicitacao-decidida', { detail: { solicitacaoId, decisao: 'reprovado' } }));
            } else {
                _enable(btnAprovar);
                _enable(btnReprovar, 'Reprovar');
                _mostrarToastAdmin(data.error || 'Erro ao reprovar.', 'error');
            }
        } catch {
            _enable(btnAprovar);
            _enable(btnReprovar, 'Reprovar');
            _mostrarToastAdmin('Erro de conexão.', 'error');
        }
    }

    function _statusBadgeHtml(status) {
        if (!status) return '';
        const map = {
            pendente : ['kna-status-pendente',  '⏳ Pendente'],
            aprovado : ['kna-status-aprovado',  '✅ Aprovado'],
            reprovado: ['kna-status-reprovado', '❌ Reprovado'],
        };
        const [cls, label] = map[status] || ['kna-status-pendente', status];
        return `<span class="kna-status-badge ${cls}">${label}</span>`;
    }

    function renderizarLista(notificacoes) {
        const list  = document.getElementById('kna-list');
        const badge = document.getElementById('kna-badge');
        const btn   = document.getElementById('kna-bell-btn');
        if (!list) return;

        const naoLidas = notificacoes.filter(n => !n.Lida);

        if (!notificacoes || notificacoes.length === 0) {
            list.innerHTML = `<div class="kna-empty"><span class="kna-empty-icon">✅</span>Nenhuma notificação.</div>`;
            badge.classList.remove('kna-show');
            btn.classList.remove('kna-active');
            return;
        }

        list.innerHTML = notificacoes.map(n => {
            const dataFmt = n.CriadaEm
                ? new Date(n.CriadaEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '';
            const lida = n.Lida ? 1 : 0;
            const isSolicitacao = n.Tipo === 'admin_solicitacao';
            const icone = isSolicitacao ? '📋' : '🔔';
            const statusSolic = n.StatusSolicitacao || null;

            // Monta botões de ação
            let acoesHtml = '';
            if (isSolicitacao && n.Solicitacao_id) {
                if (!statusSolic || statusSolic === 'pendente') {
                    acoesHtml = `
                        <button class="kna-btn-aprovar"
                                data-action="aprovar"
                                data-solic="${n.Solicitacao_id}"
                                data-notif="${n.Notificacao_id}">Aprovar</button>
                        <button class="kna-btn-reprovar"
                                data-action="reprovar"
                                data-solic="${n.Solicitacao_id}"
                                data-notif="${n.Notificacao_id}">Reprovar</button>
                    `;
                } else {
                    acoesHtml = `${_statusBadgeHtml(statusSolic)}`;
                }
            } else {
                acoesHtml = lida
                    ? `<button class="kna-btn-acao" data-action="nao-lida" data-id="${n.Notificacao_id}">Marcar como não lida</button>`
                    : `<button class="kna-btn-acao" data-action="lida"     data-id="${n.Notificacao_id}">Marcar como lida</button>`;
            }

            // Info do solicitante
            let infoExtra = '';
            if (isSolicitacao && n.NomeSolicitante) {
                infoExtra = `<div class="kna-item-msg" style="font-size:0.74rem; margin-top:1px">
                    👤 ${n.NomeSolicitante}${n.NomeLivro ? ` &nbsp;📚 ${n.NomeLivro}` : ''}
                </div>`;
            }

            return `
                <div class="kna-item ${lida ? '' : 'kna-nao-lida'}" data-id="${n.Notificacao_id}">
                    <span class="kna-item-icon">${icone}</span>
                    <div class="kna-item-body">
                        <div class="kna-item-titulo">${isSolicitacao ? 'Nova Solicitação de Empréstimo' : 'Notificação'}</div>
                        ${infoExtra}
                        <div class="kna-item-msg">${n.Mensagem || ''}</div>
                        ${dataFmt ? `<div class="kna-item-date">🕒 ${dataFmt}</div>` : ''}
                        <div class="kna-item-actions">${acoesHtml}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Bind dos botões de ação
        list.querySelectorAll('[data-action="aprovar"]').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                const solic = parseInt(b.dataset.solic, 10);
                const notif = parseInt(b.dataset.notif, 10);
                const row   = b.closest('.kna-item');
                const btnR  = row.querySelector('[data-action="reprovar"]');
                aprovarSolicitacao(solic, notif, b, btnR);
            });
        });

        list.querySelectorAll('[data-action="reprovar"]').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                const solic = parseInt(b.dataset.solic, 10);
                const notif = parseInt(b.dataset.notif, 10);
                const row   = b.closest('.kna-item');
                const btnA  = row.querySelector('[data-action="aprovar"]');
                reprovarSolicitacao(solic, notif, btnA, b);
            });
        });

        list.querySelectorAll('[data-action="lida"]').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                marcarLida(parseInt(b.dataset.id, 10));
            });
        });

        list.querySelectorAll('[data-action="nao-lida"]').forEach(b => {
            b.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(b.dataset.id, 10);
                try { await fetch(`${API}/admin/notificacoes/${id}/nao-lida`, { method: 'PATCH' }); } catch (_) {}
                const n = _notificacoes.find(n => n.Notificacao_id === id);
                if (n) n.Lida = 0;
                renderizarLista(_notificacoes);
            });
        });

        if (naoLidas.length > 0) {
            badge.textContent = naoLidas.length;
            badge.classList.add('kna-show');
            btn.classList.add('kna-active');
        } else {
            badge.classList.remove('kna-show');
            btn.classList.remove('kna-active');
        }
    }

    // ── Dados mockados para demonstração visual (sem backend) ────
    const MOCK_NOTIFICACOES = [
        {
            Notificacao_id: 101,
            Tipo: 'admin_solicitacao',
            Mensagem: 'Solicitação de empréstimo recebida e aguardando análise.',
            Lida: 0,
            CriadaEm: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
            Solicitacao_id: 1,
            NomeSolicitante: 'João Silva',
            NomeLivro: '1984 — George Orwell',
            StatusSolicitacao: 'pendente'
        },
        {
            Notificacao_id: 102,
            Tipo: 'admin_solicitacao',
            Mensagem: 'Solicitação de empréstimo recebida e aguardando análise.',
            Lida: 0,
            CriadaEm: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
            Solicitacao_id: 2,
            NomeSolicitante: 'Maria Oliveira',
            NomeLivro: 'O Senhor dos Anéis — J.R.R. Tolkien',
            StatusSolicitacao: 'pendente'
        },
        {
            Notificacao_id: 103,
            Tipo: 'admin_solicitacao',
            Mensagem: 'Solicitação de empréstimo recebida e aguardando análise.',
            Lida: 0,
            CriadaEm: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
            Solicitacao_id: 3,
            NomeSolicitante: 'Carlos Mendes',
            NomeLivro: 'A Arte da Guerra — Sun Tzu',
            StatusSolicitacao: 'pendente'
        },
        {
            Notificacao_id: 104,
            Tipo: 'admin_solicitacao',
            Mensagem: 'Solicitação de empréstimo recebida e aprovada anteriormente.',
            Lida: 1,
            CriadaEm: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
            Solicitacao_id: 4,
            NomeSolicitante: 'Ana Santos',
            NomeLivro: 'Dom Casmurro — Machado de Assis',
            StatusSolicitacao: 'aprovado'
        }
    ];

    async function verificarNotificacoes() {
        const adminId = sessionStorage.getItem('usuarioId');
        try {
            // Tenta buscar do backend real
            if (adminId) {
                const res = await fetch(`${API}/admin/notificacoes?admin=${adminId}`);
                if (res.ok) {
                    _notificacoes = await res.json();
                    renderizarLista(_notificacoes);
                    return;
                }
            }
            // Fallback visual: usa dados mockados quando backend não está disponível
            // (modo demonstração — remover quando backend estiver pronto)
            if (_notificacoes.length === 0) {
                _notificacoes = MOCK_NOTIFICACOES;
                renderizarLista(_notificacoes);
                console.info('[Kairos Admin Notif] Usando dados mockados para demonstração visual.');
            }
        } catch (err) {
            // Backend indisponível — exibe mock para demonstração
            if (_notificacoes.length === 0) {
                _notificacoes = MOCK_NOTIFICACOES;
                renderizarLista(_notificacoes);
                console.info('[Kairos Admin Notif] Backend indisponível — usando dados de demonstração.');
            }
        }
    }

    // Toast interno — delegado ao AdminToast global (admin-toast.js)
    function _mostrarToastAdmin(msg, tipo = 'info') {
        if (window.AdminToast) {
            window.AdminToast.show(msg, tipo);
        } else {
            // fallback simples caso admin-toast.js não esteja carregado
            console.info('[KNA Toast]', tipo, msg);
        }
    }

    function init() {
        injetarCSS();
        criarSino();
        verificarNotificacoes();
        setInterval(verificarNotificacoes, 2 * 60 * 1000); // atualiza a cada 2 min
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();