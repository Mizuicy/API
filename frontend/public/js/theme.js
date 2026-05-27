// theme.js — Kairos · Persistência e controle do tema claro/escuro
// Incluir em todas as páginas antes do </body>

(function () {
    function getTheme() {
        return localStorage.getItem('kairos-theme') || 'light';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('kairos-theme', theme);
        document.querySelectorAll('.theme-toggle').forEach(btn => {
            const sun = btn.querySelector('.tt-sun');
            const moon = btn.querySelector('.tt-moon');
            if (sun) sun.style.opacity = theme === 'dark' ? '0.45' : '1';
            if (moon) moon.style.opacity = theme === 'dark' ? '1' : '0.45';
        });
    }

    function toggleTheme() {
        const current = getTheme();
        applyTheme(current === 'dark' ? 'light' : 'dark');
    }

    // Aplica o tema imediatamente ao carregar
    applyTheme(getTheme());

    // Expõe globalmente
    window.kairosTema = { toggle: toggleTheme, apply: applyTheme, get: getTheme };

    // Inicializa botões após DOM estar pronto
    document.addEventListener('DOMContentLoaded', function () {
        applyTheme(getTheme());
        document.querySelectorAll('.theme-toggle').forEach(btn => {
            btn.addEventListener('click', toggleTheme);
        });
    });
})();
