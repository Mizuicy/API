/**
 * kairos-avatar.js
 * Utilitário de avatar compartilhado por todas as páginas do Kairos.
 *
 * - Renderiza o avatar (#avatarIniciais) com FotoPerfil (background-image)
 *   se existir em sessionStorage, caso contrário exibe as iniciais do nome.
 * - Escuta 'kairos:avatarUpdated' para atualizar sem recarregar a página.
 * - Expõe window.kairosAvatar.render() para re-renderização manual.
 */
(function () {
    'use strict';

    function getInitials(name) {
        if (!name || !name.trim()) return 'US';
        var parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return parts[0].slice(0, 2).toUpperCase();
    }

    function renderAvatar() {
        var el = document.getElementById('avatarIniciais');
        if (!el) return;

        var foto = sessionStorage.getItem('avatarDataUrl');
        var nome = sessionStorage.getItem('nomeUsuario') || '';

        if (foto) {
            el.style.backgroundImage  = 'url(' + foto + ')';
            el.style.backgroundSize   = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.backgroundRepeat = 'no-repeat';
            el.textContent = '';
        } else {
            el.style.backgroundImage  = '';
            el.style.backgroundSize   = '';
            el.style.backgroundPosition = '';
            el.style.backgroundRepeat = '';
            el.textContent = getInitials(nome);
        }
    }

    renderAvatar();

    window.addEventListener('kairos:avatarUpdated', function () {
        renderAvatar();
    });

    window.kairosAvatar = { render: renderAvatar };
})();
