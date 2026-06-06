const API_URL = 'http://localhost:3000';

let livros = [];
let livrosFiltrados = [];

const livrosGrid   = document.getElementById('livrosGrid');
const searchInput  = document.getElementById('searchInput');
const generoFilter = document.getElementById('generoFilter');
const modal        = document.getElementById('modalDetalhes');
const closeBtn     = document.querySelector('.close');

document.addEventListener('DOMContentLoaded', () => {
    carregarLivros();
    searchInput.addEventListener('input', filtrarLivros);
    generoFilter.addEventListener('change', filtrarLivros);
    closeBtn.addEventListener('click', () => modal.classList.remove('show'));
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
    });
});

// ── Helper: retorna array de nomes de gêneros de um livro ────
function getGeneroNomes(livro) {
    if (Array.isArray(livro.Generos) && livro.Generos.length > 0) {
        return livro.Generos.map(g => typeof g === 'string' ? g : g.Nome).filter(Boolean);
    }
    return livro.Categoria ? [livro.Categoria] : [];
}

// ── Helper: renderiza badges de gênero ───────────────────────
function renderGeneroBadges(livro) {
    const nomes = getGeneroNomes(livro);
    if (!nomes.length) return '<span class="livro-genero">—</span>';
    return `<div class="livro-generos-badges">${
        nomes.map(n => `<span class="livro-genero-badge">${n}</span>`).join('')
    }</div>`;
}

async function carregarLivros() {
    try {
        livrosGrid.innerHTML = '<div class="loading">Carregando livros...</div>';
        const response = await fetch(`${API_URL}/livro`);
        if (!response.ok) throw new Error(`Erro: ${response.statusText}`);
        livros = await response.json();
        livrosFiltrados = [...livros];
        popularFiltroGeneros();
        renderizarLivros(livrosFiltrados);
    } catch (error) {
        console.error('Erro ao carregar livros:', error);
        livrosGrid.innerHTML = '<div class="loading" style="color:#ff6b6b">Erro ao carregar livros. Verifique a conexão com o servidor.</div>';
    }
}

// ── Popula o <select> de gêneros com todas as opções únicas ──
function popularFiltroGeneros() {
    if (!generoFilter) return;
    const todosGeneros = new Set();
    livros.forEach(l => getGeneroNomes(l).forEach(g => todosGeneros.add(g)));

    const opcoesSalvas = generoFilter.value;
    generoFilter.innerHTML = '<option value="">Todos os gêneros</option>' +
        [...todosGeneros].sort((a, b) => a.localeCompare(b, 'pt-BR'))
            .map(g => `<option value="${g}">${g}</option>`).join('');
    if (opcoesSalvas) generoFilter.value = opcoesSalvas;
}

async function deletarLivro(id) {
    const confirmado = await AdminToast.confirm(
        'Esta ação não pode ser desfeita. O livro será removido permanentemente do catálogo.',
        { titulo: 'Excluir livro?', tipo: 'error', confirmLabel: 'Sim, excluir', cancelLabel: 'Cancelar', danger: true }
    );
    if (!confirmado) return;

    try {
        const response = await fetch(`${API_URL}/livro/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`Erro: ${response.statusText}`);
        AdminToast.success('Livro excluído com sucesso!');
        carregarLivros();
    } catch (error) {
        console.error('Erro ao deletar livro:', error);
        AdminToast.error('Erro ao excluir livro. Tente novamente.');
    }
}

function renderizarLivros(livrosParaRender) {
    if (livrosParaRender.length === 0) {
        livrosGrid.innerHTML = '<div class="loading">Nenhum livro encontrado.</div>';
        return;
    }

    livrosGrid.innerHTML = livrosParaRender.map(livro => `
        <div class="livro-card">
            <img src="${livro.Imagem || ''}" alt="${livro.Nome}" class="livro-imagem"
                 onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'280\' height=\'250\' viewBox=\'0 0 280 250\'%3E%3Crect width=\'280\' height=\'250\' fill=\'%23f3f4f6\'/%3E%3Ctext x=\'50%25\' y=\'45%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%239ca3af\' font-family=\'sans-serif\' font-size=\'13\'%3ESem Imagem%3C/text%3E%3Ctext x=\'50%25\' y=\'60%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%23d1d5db\' font-family=\'sans-serif\' font-size=\'28\'%3E📚%3C/text%3E%3C/svg%3E'">
            <div class="livro-corpo">
                <h3 class="livro-titulo">${livro.Nome || '—'}</h3>
                <p class="livro-autor">por ${livro.Autor || '—'}</p>
                <p class="livro-info">📖 ${livro.NumeroPaginas || '—'} páginas</p>
                <p class="livro-info">🌍 ${livro.Idioma || '—'}</p>
                ${renderGeneroBadges(livro)}
                <div class="livro-action">
                    <button class="btn-detalhes" onclick="mostrarDetalhes(${livro.Livro_id})">Detalhes</button>
                    <button class="btn-deletar" onclick="deletarLivro(${livro.Livro_id})">Deletar</button>
                </div>
            </div>
        </div>
    `).join('');
}

function mostrarDetalhes(id) {
    const livro = livros.find(l => l.Livro_id === id);
    if (!livro) return;

    const nomes = getGeneroNomes(livro);
    const generosHtml = nomes.length
        ? `<div class="detalhes-generos">${nomes.map(n => `<span class="livro-genero-badge">${n}</span>`).join('')}</div>`
        : '—';

    document.getElementById('detalhesConteudo').innerHTML = `
        <h2 class="detalhes-titulo">${livro.Nome || '—'}</h2>
        <img src="${livro.Imagem || ''}" alt="${livro.Nome}"
             onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'600\' height=\'400\' viewBox=\'0 0 600 400\'%3E%3Crect width=\'600\' height=\'400\' fill=\'%23f3f4f6\'/%3E%3Ctext x=\'50%25\' y=\'45%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%239ca3af\' font-family=\'sans-serif\' font-size=\'16\'%3ESem Imagem%3C/text%3E%3Ctext x=\'50%25\' y=\'60%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%23d1d5db\' font-family=\'sans-serif\' font-size=\'40\'%3E📚%3C/text%3E%3C/svg%3E'">
        <div class="detalhes-item">
            <span class="detalhes-label">Autor:</span>
            <span class="detalhes-valor">${livro.Autor || '—'}</span>
        </div>
        <div class="detalhes-item">
            <span class="detalhes-label">Editora:</span>
            <span class="detalhes-valor">${livro.Editora || '—'}</span>
        </div>
        <div class="detalhes-item">
            <span class="detalhes-label">Ano de Publicação:</span>
            <span class="detalhes-valor">${livro.AnoPublicacao || '—'}</span>
        </div>
        <div class="detalhes-item">
            <span class="detalhes-label">Idioma:</span>
            <span class="detalhes-valor">${livro.Idioma || '—'}</span>
        </div>
        <div class="detalhes-item">
            <span class="detalhes-label">Número de Páginas:</span>
            <span class="detalhes-valor">${livro.NumeroPaginas || '—'}</span>
        </div>
        <div class="detalhes-item">
            <span class="detalhes-label">Classificação Etária:</span>
            <span class="detalhes-valor">${livro.ClassEtaria || '—'}</span>
        </div>
        <div class="detalhes-item">
            <span class="detalhes-label">Gênero(s):</span>
            <span class="detalhes-valor">${generosHtml}</span>
        </div>
        <div>
            <span class="detalhes-label">Resumo:</span>
            <p class="detalhes-resumo">${livro.Resumo || '—'}</p>
        </div>
    `;
    modal.classList.add('show');
}

function filtrarLivros() {
    const textoBusca       = searchInput.value.toLowerCase();
    const generoSelecionado = generoFilter.value;

    livrosFiltrados = livros.filter(livro => {
        const correspondeTexto =
            (livro.Nome    || '').toLowerCase().includes(textoBusca) ||
            (livro.Autor   || '').toLowerCase().includes(textoBusca) ||
            (livro.Editora || '').toLowerCase().includes(textoBusca) ||
            (livro.Resumo  || '').toLowerCase().includes(textoBusca);

        // Verifica se qualquer gênero do livro bate com o filtro
        const correspondeGenero = generoSelecionado === '' ||
            getGeneroNomes(livro).includes(generoSelecionado);

        return correspondeTexto && correspondeGenero;
    });

    renderizarLivros(livrosFiltrados);
}

/** @deprecated use AdminToast directly */
function mostraNotificacao(mensagem, tipo) {
    AdminToast.show(mensagem, tipo || 'info');
}
