/**
 * admin-toast.js — Kairos Biblioteca
 * Sistema de notificações moderno para o painel administrativo.
 * Exibe toasts no canto inferior direito com suporte a dark mode,
 * animações suaves, ícones por tipo e fechamento manual/automático.
 * 
 * API pública:
 *   AdminToast.show(mensagem, tipo, duracao)
 *   AdminToast.success(mensagem)
 *   AdminToast.error(mensagem)
 *   AdminToast.warning(mensagem)
 *   AdminToast.info(mensagem)
 *   AdminToast.confirm(mensagem, opcoes) → Promise<boolean>
 *   AdminToast.prompt(mensagem, opcoes)  → Promise<string|null>
 *
 * Tipos: 'success' | 'error' | 'warning' | 'info'
 */

(function (global) {
    'use strict';

    const CONTAINER_ID = 'admin-toast-container';
    const Z_INDEX = 99999;

    const ICONS = {
        success: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        error:   `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        warning: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        info:    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };

    const COLORS = {
        success: { bg: '#16a34a', light: '#f0fdf4', border: '#bbf7d0', text: '#14532d', icon: '#16a34a' },
        error:   { bg: '#dc2626', light: '#fef2f2', border: '#fecaca', text: '#7f1d1d', icon: '#dc2626' },
        warning: { bg: '#d97706', light: '#fffbeb', border: '#fde68a', text: '#78350f', icon: '#d97706' },
        info:    { bg: '#2563eb', light: '#eff6ff', border: '#bfdbfe', text: '#1e3a8a', icon: '#2563eb' }
    };

    const CSS = `
        #admin-toast-container {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: ${Z_INDEX};
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            max-width: 380px;
            width: calc(100vw - 48px);
        }

        .admin-toast {
            pointer-events: all;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px 16px;
            border-radius: 12px;
            border: 1px solid transparent;
            box-shadow: 0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 0.875rem;
            line-height: 1.45;
            background: #fff;
            color: #1a1a2e;
            position: relative;
            transform: translateX(110%);
            opacity: 0;
            transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
                        opacity 0.3s ease;
            cursor: default;
            min-width: 0;
            overflow: hidden;
        }

        .admin-toast.at-entering {
            transform: translateX(0);
            opacity: 1;
        }

        .admin-toast.at-leaving {
            transform: translateX(110%);
            opacity: 0;
            transition: transform 0.28s cubic-bezier(0.55, 0, 1, 0.45),
                        opacity 0.25s ease;
        }

        .admin-toast-icon {
            flex-shrink: 0;
            width: 36px;
            height: 36px;
            border-radius: 9px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 1px;
        }

        .admin-toast-body {
            flex: 1;
            min-width: 0;
            padding-right: 8px;
        }

        .admin-toast-title {
            font-weight: 700;
            font-size: 0.80rem;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            margin-bottom: 2px;
            opacity: 0.75;
        }

        .admin-toast-msg {
            font-weight: 500;
            font-size: 0.875rem;
            word-break: break-word;
        }

        .admin-toast-close {
            position: absolute;
            top: 10px;
            right: 10px;
            background: none;
            border: none;
            cursor: pointer;
            padding: 3px;
            border-radius: 5px;
            color: inherit;
            opacity: 0.4;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.15s, background 0.15s;
            line-height: 1;
        }

        .admin-toast-close:hover {
            opacity: 0.9;
            background: rgba(0,0,0,0.07);
        }

        .admin-toast-progress {
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            border-radius: 0 0 12px 12px;
            width: 100%;
            transform-origin: left;
            animation: at-progress linear forwards;
        }

        @keyframes at-progress {
            from { transform: scaleX(1); }
            to   { transform: scaleX(0); }
        }

        /* Light mode colors por tipo */
        .admin-toast.at-success {
            background: #f0fdf4;
            border-color: #bbf7d0;
            color: #14532d;
        }
        .admin-toast.at-success .admin-toast-icon { background: #dcfce7; color: #16a34a; }
        .admin-toast.at-success .admin-toast-progress { background: #16a34a; }

        .admin-toast.at-error {
            background: #fef2f2;
            border-color: #fecaca;
            color: #7f1d1d;
        }
        .admin-toast.at-error .admin-toast-icon { background: #fee2e2; color: #dc2626; }
        .admin-toast.at-error .admin-toast-progress { background: #dc2626; }

        .admin-toast.at-warning {
            background: #fffbeb;
            border-color: #fde68a;
            color: #78350f;
        }
        .admin-toast.at-warning .admin-toast-icon { background: #fef3c7; color: #d97706; }
        .admin-toast.at-warning .admin-toast-progress { background: #d97706; }

        .admin-toast.at-info {
            background: #eff6ff;
            border-color: #bfdbfe;
            color: #1e3a8a;
        }
        .admin-toast.at-info .admin-toast-icon { background: #dbeafe; color: #2563eb; }
        .admin-toast.at-info .admin-toast-progress { background: #2563eb; }

        /* Dark mode */
        [data-theme="dark"] .admin-toast.at-success {
            background: #052e16;
            border-color: #166534;
            color: #bbf7d0;
        }
        [data-theme="dark"] .admin-toast.at-success .admin-toast-icon { background: #14532d; color: #4ade80; }

        [data-theme="dark"] .admin-toast.at-error {
            background: #2d0a0a;
            border-color: #991b1b;
            color: #fecaca;
        }
        [data-theme="dark"] .admin-toast.at-error .admin-toast-icon { background: #450a0a; color: #f87171; }

        [data-theme="dark"] .admin-toast.at-warning {
            background: #2d1b00;
            border-color: #92400e;
            color: #fde68a;
        }
        [data-theme="dark"] .admin-toast.at-warning .admin-toast-icon { background: #3d1a00; color: #fbbf24; }

        [data-theme="dark"] .admin-toast.at-info {
            background: #0c1a3d;
            border-color: #1e3a8a;
            color: #bfdbfe;
        }
        [data-theme="dark"] .admin-toast.at-info .admin-toast-icon { background: #1e3a8a; color: #93c5fd; }

        [data-theme="dark"] .admin-toast.at-success .admin-toast-close,
        [data-theme="dark"] .admin-toast.at-error .admin-toast-close,
        [data-theme="dark"] .admin-toast.at-warning .admin-toast-close,
        [data-theme="dark"] .admin-toast.at-info .admin-toast-close {
            color: inherit;
        }

        [data-theme="dark"] .admin-toast-close:hover {
            background: rgba(255,255,255,0.1);
        }

        /* Dialog (confirm / prompt) overlay */
        #admin-dialog-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.45);
            backdrop-filter: blur(2px);
            z-index: ${Z_INDEX + 10};
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            animation: at-overlay-in 0.2s ease;
        }

        @keyframes at-overlay-in {
            from { opacity: 0; }
            to   { opacity: 1; }
        }

        .admin-dialog-box {
            background: #fff;
            border-radius: 16px;
            padding: 28px 28px 24px;
            max-width: 420px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            animation: at-dialog-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes at-dialog-in {
            from { opacity: 0; transform: scale(0.9) translateY(10px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        [data-theme="dark"] .admin-dialog-box {
            background: #1a1a2e;
            color: #e8e8f0;
        }

        .admin-dialog-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 16px;
        }

        .admin-dialog-icon.at-warning { background: #fef3c7; color: #d97706; }
        .admin-dialog-icon.at-error   { background: #fee2e2; color: #dc2626; }
        .admin-dialog-icon.at-info    { background: #dbeafe; color: #2563eb; }
        .admin-dialog-icon.at-success { background: #dcfce7; color: #16a34a; }

        [data-theme="dark"] .admin-dialog-icon.at-warning { background: #3d1a00; color: #fbbf24; }
        [data-theme="dark"] .admin-dialog-icon.at-error   { background: #450a0a; color: #f87171; }
        [data-theme="dark"] .admin-dialog-icon.at-info    { background: #1e3a8a; color: #93c5fd; }
        [data-theme="dark"] .admin-dialog-icon.at-success { background: #14532d; color: #4ade80; }

        .admin-dialog-title {
            font-size: 1.05rem;
            font-weight: 700;
            color: #1a1a2e;
            margin-bottom: 8px;
        }

        [data-theme="dark"] .admin-dialog-title { color: #e8e8f0; }

        .admin-dialog-msg {
            font-size: 0.9rem;
            color: #6b7280;
            line-height: 1.55;
            margin-bottom: 20px;
        }

        [data-theme="dark"] .admin-dialog-msg { color: #9ca3af; }

        .admin-dialog-input {
            width: 100%;
            padding: 10px 14px;
            border: 1.5px solid #e4e4e4;
            border-radius: 9px;
            font-size: 0.9rem;
            font-family: inherit;
            background: #f9f9fb;
            color: #1a1a2e;
            margin-bottom: 20px;
            outline: none;
            box-sizing: border-box;
            transition: border-color 0.2s;
        }

        .admin-dialog-input:focus { border-color: #667eea; }

        [data-theme="dark"] .admin-dialog-input {
            background: #13131f;
            border-color: #2e2e42;
            color: #e8e8f0;
        }

        [data-theme="dark"] .admin-dialog-input:focus { border-color: #667eea; }

        .admin-dialog-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }

        .admin-dialog-btn {
            padding: 9px 20px;
            border-radius: 9px;
            font-size: 0.875rem;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            border: none;
            transition: opacity 0.15s, transform 0.1s;
        }

        .admin-dialog-btn:active { transform: scale(0.97); }

        .admin-dialog-btn-cancel {
            background: #f3f4f6;
            color: #374151;
        }

        .admin-dialog-btn-cancel:hover { background: #e5e7eb; }

        [data-theme="dark"] .admin-dialog-btn-cancel {
            background: #2e2e42;
            color: #d1d5db;
        }

        [data-theme="dark"] .admin-dialog-btn-cancel:hover { background: #3a3a54; }

        .admin-dialog-btn-confirm {
            background: #dc2626;
            color: #fff;
        }

        .admin-dialog-btn-confirm:hover { background: #b91c1c; }

        .admin-dialog-btn-confirm.at-primary {
            background: #667eea;
        }

        .admin-dialog-btn-confirm.at-primary:hover { background: #4f63d2; }

        /* Mobile responsivo */
        @media (max-width: 480px) {
            #admin-toast-container {
                bottom: 16px;
                right: 12px;
                left: 12px;
                width: auto;
                max-width: none;
            }

            .admin-toast {
                width: 100%;
            }
        }
    `;

    function _injectCSS() {
        if (document.getElementById('admin-toast-css')) return;
        const style = document.createElement('style');
        style.id = 'admin-toast-css';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    function _getContainer() {
        let c = document.getElementById(CONTAINER_ID);
        if (!c) {
            c = document.createElement('div');
            c.id = CONTAINER_ID;
            document.body.appendChild(c);
        }
        return c;
    }

    const TITLES = {
        success: 'Sucesso',
        error:   'Erro',
        warning: 'Atenção',
        info:    'Informação'
    };

    function show(mensagem, tipo = 'info', duracao = 5000) {
        _injectCSS();
        const container = _getContainer();

        const toast = document.createElement('div');
        toast.className = `admin-toast at-${tipo}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');

        toast.innerHTML = `
            <div class="admin-toast-icon">${ICONS[tipo] || ICONS.info}</div>
            <div class="admin-toast-body">
                <div class="admin-toast-title">${TITLES[tipo] || tipo}</div>
                <div class="admin-toast-msg">${mensagem}</div>
            </div>
            <button class="admin-toast-close" title="Fechar" aria-label="Fechar notificação">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="admin-toast-progress" style="animation-duration: ${duracao}ms"></div>
        `;

        container.appendChild(toast);

        // Trigger enter animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('at-entering');
            });
        });

        let dismissTimer = setTimeout(() => dismiss(toast), duracao);

        // Pause on hover
        toast.addEventListener('mouseenter', () => {
            clearTimeout(dismissTimer);
            const prog = toast.querySelector('.admin-toast-progress');
            if (prog) prog.style.animationPlayState = 'paused';
        });

        toast.addEventListener('mouseleave', () => {
            const prog = toast.querySelector('.admin-toast-progress');
            if (prog) prog.style.animationPlayState = 'running';
            dismissTimer = setTimeout(() => dismiss(toast), 2000);
        });

        toast.querySelector('.admin-toast-close').addEventListener('click', () => {
            clearTimeout(dismissTimer);
            dismiss(toast);
        });

        return toast;
    }

    function dismiss(toast) {
        toast.classList.remove('at-entering');
        toast.classList.add('at-leaving');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }

    // ── Dialog helpers (substituem confirm() e prompt()) ──────────

    function _createDialog(tipo, titulo, mensagem, extra) {
        _injectCSS();

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.id = 'admin-dialog-overlay';

            const isPrompt = extra && extra.type === 'prompt';
            const confirmLabel = (extra && extra.confirmLabel) || 'Confirmar';
            const cancelLabel  = (extra && extra.cancelLabel)  || 'Cancelar';
            const confirmClass = (extra && extra.danger) ? '' : 'at-primary';

            overlay.innerHTML = `
                <div class="admin-dialog-box" role="dialog" aria-modal="true">
                    <div class="admin-dialog-icon at-${tipo}">${ICONS[tipo] || ICONS.info}</div>
                    <div class="admin-dialog-title">${titulo}</div>
                    <div class="admin-dialog-msg">${mensagem}</div>
                    ${isPrompt ? `<input class="admin-dialog-input" type="text" placeholder="${extra.placeholder || ''}" id="admin-dialog-input-field" />` : ''}
                    <div class="admin-dialog-actions">
                        <button class="admin-dialog-btn admin-dialog-btn-cancel" id="admin-dlg-cancel">${cancelLabel}</button>
                        <button class="admin-dialog-btn admin-dialog-btn-confirm ${confirmClass}" id="admin-dlg-confirm">${confirmLabel}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const inputEl    = overlay.querySelector('#admin-dialog-input-field');
            const confirmBtn = overlay.querySelector('#admin-dlg-confirm');
            const cancelBtn  = overlay.querySelector('#admin-dlg-cancel');

            if (inputEl) {
                setTimeout(() => inputEl.focus(), 50);
                inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') confirmBtn.click();
                    if (e.key === 'Escape') cancelBtn.click();
                });
            }

            function close(result) {
                overlay.style.animation = 'none';
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.2s';
                setTimeout(() => overlay.remove(), 200);
                resolve(result);
            }

            confirmBtn.addEventListener('click', () => {
                close(isPrompt ? (inputEl ? inputEl.value : '') : true);
            });

            cancelBtn.addEventListener('click', () => close(isPrompt ? null : false));

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(isPrompt ? null : false);
            });

            document.addEventListener('keydown', function esc(e) {
                if (e.key === 'Escape') { close(isPrompt ? null : false); document.removeEventListener('keydown', esc); }
            });
        });
    }

    /**
     * Substitui confirm() nativo.
     * @param {string} mensagem
     * @param {object} opcoes { titulo, tipo, confirmLabel, cancelLabel, danger }
     * @returns {Promise<boolean>}
     */
    function confirm(mensagem, opcoes = {}) {
        const tipo   = opcoes.tipo   || 'warning';
        const titulo = opcoes.titulo || 'Confirmação';
        return _createDialog(tipo, titulo, mensagem, { ...opcoes, danger: opcoes.danger !== false });
    }

    /**
     * Substitui prompt() nativo.
     * @param {string} mensagem
     * @param {object} opcoes { titulo, tipo, placeholder, confirmLabel, cancelLabel }
     * @returns {Promise<string|null>}
     */
    function prompt(mensagem, opcoes = {}) {
        const tipo   = opcoes.tipo   || 'info';
        const titulo = opcoes.titulo || 'Entrada necessária';
        return _createDialog(tipo, titulo, mensagem, { ...opcoes, type: 'prompt' });
    }

    // Atalhos convenientes
    function success(msg, dur) { return show(msg, 'success', dur); }
    function error(msg, dur)   { return show(msg, 'error',   dur); }
    function warning(msg, dur) { return show(msg, 'warning', dur); }
    function info(msg, dur)    { return show(msg, 'info',    dur); }

    // Expõe como global AdminToast
    global.AdminToast = { show, success, error, warning, info, confirm, prompt };

    // Compatibilidade: aliases para funções legadas usadas no projeto
    // (showToast, mostrarToast, mostraNotificacao) – todos redirecionam pro AdminToast
    global._adminToastCompat = function(msg, tipo) {
        const map = { success: 'success', error: 'error', warning: 'warning', info: 'info' };
        AdminToast.show(msg, map[tipo] || 'info');
    };

})(window);
