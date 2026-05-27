// Fecha o dropdown ao clicar fora
document.addEventListener('click', (e) => {
    const dropdown = document.querySelector('.nav-dropdown');
    if (!dropdown) return;
    if (!dropdown.contains(e.target)) {
        dropdown.querySelector('.nav-dropdown-menu').style.display = '';
    }
});

// Toggle no clique do botão (mobile)
const btn = document.querySelector('.nav-dropdown-btn');
if (btn) {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.querySelector('.nav-dropdown-menu');
        menu.style.display = menu.style.display === 'block' ? '' : 'block';
    });
}
