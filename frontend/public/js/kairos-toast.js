/**
 * kairos-toast.js — Kairos Biblioteca
 * Sistema universal de notificações visuais.
 * Funciona em TODAS as páginas do sistema (usuário e admin).
 * Exportado como window.KairosToast — compatível com dark/light mode.
 *
 * API:
 *   KairosToast.success(msg)
 *   KairosToast.error(msg)
 *   KairosToast.warning(msg)
 *   KairosToast.info(msg)
 *   KairosToast.show(msg, tipo, duracao)
 *   KairosToast.confirm(msg, opcoes) → Promise<boolean>
 *   KairosToast.prompt(msg, opcoes)  → Promise<string|null>
 */

(function (global) {
    'use strict';

    // Se AdminToast já está carregado, KairosToast redireciona para ele
    // (evita duplicidade em páginas admin que já carregam admin-toast.js)
    if (global.AdminToast) {
        global.KairosToast = global.AdminToast;
        return;
    }

    const CONTAINER_ID = 'kairos-toast-container';
    const Z_INDEX      = 99999;

    const ICONS = {
        success: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        error:   `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        warning: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        info:    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };

    const TITLES = {
        success: 'Sucesso',
        error:   'Erro',
        warning: 'Atenção',
        info:    'Informação'
    };

    const CSS = `
        #kairos-toast-container {
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

        .kairos-toast {
            pointer-events: all;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px 16px;
            border-radius: 12px;
            border-left: 4px solid transparent;
            box-shadow: 0 8px 30px rgba(0,0,0,.13), 0 2px 8px rgba(0,0,0,.08);
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 0.875rem;
            line-height: 1.5;
            background: var(--surface, #ffffff);
            color: var(--text, #1a1a1a);
            position: relative;
            transform: translateX(110%);
            opacity: 0;
            transition:
                transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
                opacity 0.3s ease,
                background-color 0.25s ease;
            cursor: default;
            min-width: 0;
            overflow: hidden;
            border: 1px solid var(--border, #e4e4e4);
        }

        .kairos-toast.kt-entering { transform: translateX(0); opacity: 1; }
        .kairos-toast.kt-leaving  {
            transform: translateX(110%); opacity: 0;
            transition: transform 0.28s cubic-bezier(0.55,0,1,.45), opacity 0.25s ease;
        }

        .kairos-toast.kt-success { border-left-color: var(--success, #16a34a); }
        .kairos-toast.kt-error   { border-left-color: var(--error,   #dc2626); }
        .kairos-toast.kt-warning { border-left-color: var(--warning,  #d97706); }
        .kairos-toast.kt-info    { border-left-color: var(--purple,   #5b4cf5); }

        .kairos-toast-icon {
            flex-shrink: 0;
            width: 36px; height: 36px;
            border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            margin-top: 1px;
        }

        .kairos-toast.kt-success .kairos-toast-icon { background: var(--success-bg, #f0fdf4); color: var(--success, #16a34a); }
        .kairos-toast.kt-error   .kairos-toast-icon { background: var(--error-bg,   #fef2f2); color: var(--error,   #dc2626); }
        .kairos-toast.kt-warning .kairos-toast-icon { background: var(--warning-bg, #fffbeb); color: var(--warning,  #d97706); }
        .kairos-toast.kt-info    .kairos-toast-icon { background: var(--purple-soft,#ede9fe); color: var(--purple,   #5b4cf5); }

        .kairos-toast-body { flex: 1; min-width: 0; }

        .kairos-toast-title {
            font-weight: 700;
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 2px;
        }

        .kairos-toast.kt-success .kairos-toast-title { color: var(--success, #16a34a); }
        .kairos-toast.kt-error   .kairos-toast-title { color: var(--error,   #dc2626); }
        .kairos-toast.kt-warning .kairos-toast-title { color: var(--warning,  #d97706); }
        .kairos-toast.kt-info    .kairos-toast-title { color: var(--purple,   #5b4cf5); }

        .kairos-toast-msg { color: var(--text-mid, #333); word-break: break-word; }

        .kairos-toast-close {
            flex-shrink: 0;
            background: none; border: none; cursor: pointer;
            color: var(--muted, #6b6b6b);
            padding: 2px; border-radius: 4px;
            display: flex; align-items: center; justify-content: center;
            transition: color 0.15s, background 0.15s;
            margin-top: 2px;
        }

        .kairos-toast-close:hover {
            color: var(--text, #1a1a1a);
            background: var(--border, #e4e4e4);
        }

        .kairos-toast-progress {
            position: absolute; bottom: 0; left: 0;
            height: 3px; width: 100%;
            border-radius: 0 0 12px 12px;
            animation: kt-progress linear forwards;
            opacity: 0.55;
        }

        .kairos-toast.kt-success .kairos-toast-progress { background: var(--success, #16a34a); }
        .kairos-toast.kt-error   .kairos-toast-progress { background: var(--error,   #dc2626); }
        .kairos-toast.kt-warning .kairos-toast-progress { background: var(--warning,  #d97706); }
        .kairos-toast.kt-info    .kairos-toast-progress { background: var(--purple,   #5b4cf5); }

        @keyframes kt-progress {
            from { transform: scaleX(1); transform-origin: left; }
            to   { transform: scaleX(0); transform-origin: left; }
        }

        /* ── Dialog ── */
        #kairos-dialog-overlay {
            position: fixed; inset: 0;
            z-index: ${Z_INDEX + 1};
            background: rgba(0,0,0,.52);
            display: flex; align-items: center; justify-content: center;
            padding: 16px;
            animation: kt-fade-in 0.18s ease;
            backdrop-filter: blur(2px);
        }

        @keyframes kt-fade-in { from { opacity: 0; } to { opacity: 1; } }

        .kairos-dialog-box {
            background: var(--surface, #ffffff);
            border-radius: 14px;
            padding: 32px 28px 24px;
            max-width: 420px; width: 100%;
            box-shadow: 0 10px 30px rgba(0,0,0,.2);
            text-align: center;
            animation: kt-pop-in 0.22s cubic-bezier(0.34,1.56,0.64,1);
            border: 1px solid var(--border, #e4e4e4);
        }

        @keyframes kt-pop-in {
            from { transform: scale(0.88); opacity: 0; }
            to   { transform: scale(1);    opacity: 1; }
        }

        .kairos-dialog-icon {
            width: 52px; height: 52px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 16px;
        }

        .kairos-dialog-icon.kt-success { background: var(--success-bg, #f0fdf4); color: var(--success, #16a34a); }
        .kairos-dialog-icon.kt-error   { background: var(--error-bg,   #fef2f2); color: var(--error,   #dc2626); }
        .kairos-dialog-icon.kt-warning { background: var(--warning-bg, #fffbeb); color: var(--warning,  #d97706); }
        .kairos-dialog-icon.kt-info    { background: var(--purple-soft,#ede9fe); color: var(--purple,   #5b4cf5); }
        .kairos-dialog-icon svg { width: 26px; height: 26px; }

        .kairos-dialog-title {
            font-size: 1.1rem; font-weight: 700;
            color: var(--text, #1a1a1a); margin-bottom: 8px;
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .kairos-dialog-msg {
            font-size: 0.9rem; color: var(--text-mid, #333);
            margin-bottom: 20px; line-height: 1.55;
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .kairos-dialog-input {
            width: 100%; padding: 10px 14px;
            border: 1.5px solid var(--border, #e4e4e4);
            border-radius: 8px;
            background: var(--bg, #f0f0f0);
            color: var(--text, #1a1a1a);
            font-size: 0.9rem;
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            outline: none; margin-bottom: 20px;
            transition: border-color 0.2s; box-sizing: border-box;
        }

        .kairos-dialog-input:focus {
            border-color: var(--purple, #5b4cf5);
            box-shadow: 0 0 0 3px var(--purple-soft, #ede9fe);
        }

        .kairos-dialog-actions { display: flex; gap: 10px; justify-content: center; }

        .kairos-dialog-btn {
            flex: 1; padding: 10px 20px;
            border-radius: 8px; font-size: 0.9rem; font-weight: 600;
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            cursor: pointer; border: 1.5px solid transparent;
            transition: all 0.18s ease; max-width: 180px;
        }

        .kairos-dialog-btn-cancel {
            background: var(--bg, #f0f0f0);
            color: var(--text-mid, #333);
            border-color: var(--border, #e4e4e4);
        }

        .kairos-dialog-btn-cancel:hover { background: var(--border, #e4e4e4); }

        .kairos-dialog-btn-confirm {
            background: var(--purple, #5b4cf5);
            color: #fff;
            border-color: var(--purple, #5b4cf5);
        }

        .kairos-dialog-btn-confirm:hover {
            background: var(--purple-dark, #4b19e6);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(91,76,245,.35);
        }

        .kairos-dialog-btn-confirm.kt-danger {
            background: var(--error, #dc2626);
            border-color: var(--error, #dc2626);
        }

        .kairos-dialog-btn-confirm.kt-danger:hover {
            background: #b91c1c; border-color: #b91c1c;
            box-shadow: 0 4px 12px rgba(220,38,38,.35);
        }

        @media (max-width: 480px) {
            #kairos-toast-container {
                bottom: 16px; right: 16px; left: 16px;
                width: auto; max-width: none;
            }
            .kairos-toast { width: 100%; }
            .kairos-dialog-box { padding: 24px 18px 18px; }
            .kairos-dialog-actions { flex-direction: column; }
            .kairos-dialog-btn { max-width: none; }
        }
    `;

    function _injectCSS() {
        if (document.getElementById('kairos-toast-css')) return;
        const s = document.createElement('style');
        s.id = 'kairos-toast-css';
        s.textContent = CSS;
        document.head.appendChild(s);
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

    function show(mensagem, tipo = 'info', duracao = 5000) {
        _injectCSS();
        const validTypes = ['success', 'error', 'warning', 'info'];
        if (!validTypes.includes(tipo)) tipo = 'info';

        const container = _getContainer();
        const toast = document.createElement('div');
        toast.className = `kairos-toast kt-${tipo}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');

        toast.innerHTML = `
            <div class="kairos-toast-icon">${ICONS[tipo]}</div>
            <div class="kairos-toast-body">
                <div class="kairos-toast-title">${TITLES[tipo]}</div>
                <div class="kairos-toast-msg">${mensagem}</div>
            </div>
            <button class="kairos-toast-close" title="Fechar" aria-label="Fechar notificação">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="kairos-toast-progress" style="animation-duration:${duracao}ms"></div>
        `;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('kt-entering'));
        });

        let timer = setTimeout(() => _dismiss(toast), duracao);

        toast.addEventListener('mouseenter', () => {
            clearTimeout(timer);
            const p = toast.querySelector('.kairos-toast-progress');
            if (p) p.style.animationPlayState = 'paused';
        });

        toast.addEventListener('mouseleave', () => {
            const p = toast.querySelector('.kairos-toast-progress');
            if (p) p.style.animationPlayState = 'running';
            timer = setTimeout(() => _dismiss(toast), 2000);
        });

        toast.querySelector('.kairos-toast-close').addEventListener('click', () => {
            clearTimeout(timer);
            _dismiss(toast);
        });

        return toast;
    }

    function _dismiss(toast) {
        toast.classList.remove('kt-entering');
        toast.classList.add('kt-leaving');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }

    function _createDialog(tipo, titulo, mensagem, extra) {
        _injectCSS();

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.id = 'kairos-dialog-overlay';

            const isPrompt     = extra && extra.type === 'prompt';
            const confirmLabel = (extra && extra.confirmLabel) || 'Confirmar';
            const cancelLabel  = (extra && extra.cancelLabel)  || 'Cancelar';
            const isDanger     = extra && extra.danger;
            const confirmCls   = isDanger ? 'kt-danger' : '';

            overlay.innerHTML = `
                <div class="kairos-dialog-box" role="dialog" aria-modal="true">
                    <div class="kairos-dialog-icon kt-${tipo}">${ICONS[tipo] || ICONS.info}</div>
                    <div class="kairos-dialog-title">${titulo}</div>
                    <div class="kairos-dialog-msg">${mensagem}</div>
                    ${isPrompt ? `<input class="kairos-dialog-input" type="text" placeholder="${(extra && extra.placeholder) || ''}" id="kairos-dlg-input" autocomplete="off"/>` : ''}
                    <div class="kairos-dialog-actions">
                        <button class="kairos-dialog-btn kairos-dialog-btn-cancel" id="kairos-dlg-cancel">${cancelLabel}</button>
                        <button class="kairos-dialog-btn kairos-dialog-btn-confirm ${confirmCls}" id="kairos-dlg-confirm">${confirmLabel}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const inputEl    = overlay.querySelector('#kairos-dlg-input');
            const confirmBtn = overlay.querySelector('#kairos-dlg-confirm');
            const cancelBtn  = overlay.querySelector('#kairos-dlg-cancel');

            if (inputEl) {
                setTimeout(() => inputEl.focus(), 50);
                inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter')  confirmBtn.click();
                    if (e.key === 'Escape') cancelBtn.click();
                });
            } else {
                setTimeout(() => confirmBtn.focus(), 50);
            }

            function close(result) {
                overlay.style.transition = 'opacity 0.18s ease';
                overlay.style.opacity = '0';
                setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 200);
                resolve(result);
            }

            confirmBtn.addEventListener('click', () => close(isPrompt ? (inputEl ? inputEl.value : '') : true));
            cancelBtn.addEventListener('click',  () => close(isPrompt ? null : false));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(isPrompt ? null : false); });

            function escHandler(e) {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escHandler);
                    close(isPrompt ? null : false);
                }
            }
            document.addEventListener('keydown', escHandler);
        });
    }

    function confirm(mensagem, opcoes = {}) {
        const tipo   = opcoes.tipo   || 'warning';
        const titulo = opcoes.titulo || 'Confirmação';
        return _createDialog(tipo, titulo, mensagem, { ...opcoes, danger: opcoes.danger !== false });
    }

    function prompt(mensagem, opcoes = {}) {
        const tipo   = opcoes.tipo   || 'info';
        const titulo = opcoes.titulo || 'Entrada necessária';
        return _createDialog(tipo, titulo, mensagem, { ...opcoes, type: 'prompt', danger: false });
    }

    function success(msg, dur) { return show(msg, 'success', dur); }
    function error(msg, dur)   { return show(msg, 'error',   dur); }
    function warning(msg, dur) { return show(msg, 'warning', dur); }
    function info(msg, dur)    { return show(msg, 'info',    dur); }

    global.KairosToast = { show, success, error, warning, info, confirm, prompt };

    // Também expõe como AdminToast para compatibilidade se não estiver carregado
    if (!global.AdminToast) {
        global.AdminToast = global.KairosToast;
    }

})(window);
