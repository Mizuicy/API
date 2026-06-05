// JS do catálogo — Kairos Biblioteca
// Suporte a múltiplos gêneros por livro

const API = 'http://localhost:3000';
let todosLivros    = [];
let categoriaAtiva = '';

// Avatar
const nome = sessionStorage.getItem('nomeUsuario') || '';
const iniciais = nome.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase() || 'US';
document.getElementById('avatarIniciais').textContent = iniciais;

// Busca pendente vinda da página Início
const buscaPendente = sessionStorage.getItem('buscaPendente');
if (buscaPendente) {
    document.getElementById('searchInput').value = buscaPendente;
    sessionStorage.removeItem('buscaPendente');
}

// ── Helper: retorna array de nomes dos gêneros de um livro ────
function getGeneroNomes(livro) {
    if (Array.isArray(livro.Generos) && livro.Generos.length > 0) {
        return livro.Generos.map(g => typeof g === 'string' ? g : g.Nome).filter(Boolean);
    }
    return (livro.Categoria || livro.genero) ? [livro.Categoria || livro.genero] : [];
}

async function carregarLivros() {
    try {
        const res = await fetch(`${API}/livro`);
        todosLivros = await res.json();
        construirPills();
        filtrar();
    } catch {
        document.getElementById('catalogGrid').innerHTML =
            '<p style="color:var(--muted);grid-column:1/-1">Não foi possível conectar ao servidor.</p>';
    }
}

function construirPills() {
    // Coleta todos os gêneros únicos de todos os livros
    const generosSet = new Set();
    todosLivros.forEach(l => getGeneroNomes(l).forEach(g => generosSet.add(g)));
    const generos = [...generosSet].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const bar = document.getElementById('filterBar');
    // Remove pills dinâmicas antigas (mantém o botão "Todos")
    bar.querySelectorAll('.pill:not([data-cat=""])').forEach(p => p.remove());

    generos.forEach(cat => {
        const btn = document.createElement('button');
        btn.className   = 'pill';
        btn.dataset.cat = cat;
        btn.textContent = cat;
        btn.onclick = () => selecionarCategoria(cat, btn);
        bar.appendChild(btn);
    });
}

function selecionarCategoria(cat, btn) {
    categoriaAtiva = cat;
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    filtrar();
}

document.querySelector('.pill[data-cat=""]').onclick = function() {
    categoriaAtiva = '';
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    this.classList.add('active');
    filtrar();
};

document.getElementById('searchInput').addEventListener('input', filtrar);

function filtrar() {
    const busca = document.getElementById('searchInput').value.toLowerCase().trim();

    const resultado = todosLivros.filter(l => {
        const titulo = (l.Nome || l.titulo || '').toLowerCase();
        const autor  = (l.Autor || l.autor  || '').toLowerCase();

        const matchTexto = !busca || titulo.includes(busca) || autor.includes(busca);
        // Verifica se qualquer gênero do livro corresponde à categoria ativa
        const matchCat = !categoriaAtiva || getGeneroNomes(l).includes(categoriaAtiva);

        return matchTexto && matchCat;
    });

    const count = document.getElementById('resultsCount');
    count.textContent = resultado.length > 0
        ? `${resultado.length} livro${resultado.length > 1 ? 's' : ''} encontrado${resultado.length > 1 ? 's' : ''}`
        : '';

    const grid = document.getElementById('catalogGrid');

    if (!resultado.length) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <div class="empty-icon">🔍</div>
                <h3>Nenhum livro encontrado</h3>
                <p>Tente outros termos ou remova o filtro de categoria.</p>
            </div>`;
        return;
    }

    grid.innerHTML = resultado.map(livro => {
        const capa   = livro.Imagem || livro.capa || '';
        const titulo = livro.Nome   || livro.titulo || '—';
        const autor  = livro.Autor  || livro.autor  || '';
        const id     = livro.Livro_id || livro.id;
        const nomes  = getGeneroNomes(livro);

        const generosHtml = nomes.length
            ? `<div class="book-generos">${nomes.map(n => `<span class="book-genero-pill">${n}</span>`).join('')}</div>`
            : '<div class="book-category">—</div>';

        return `
        <div class="book-card" onclick="abrirModal(${id})">
            ${capa
                ? `<img class="book-cover" src="${capa}" alt="${titulo}"
                       onerror="this.parentElement.querySelector('.book-cover-placeholder').style.display='flex';this.style.display='none'">`
                : ''}
            <div class="book-cover-placeholder" ${capa ? 'style="display:none"' : ''}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
            </div>
            <div class="book-info">
                ${generosHtml}
                <div class="book-title">${titulo}</div>
                <div class="book-author">${autor}</div>
            </div>
        </div>`;
    }).join('');
}

function abrirModal(id) {
    const livro = todosLivros.find(l => (l.Livro_id || l.id) === id);
    if (!livro) return;

    const titulo  = livro.Nome  || livro.titulo || '—';
    const autor   = livro.Autor || livro.autor  || '—';
    const desc    = livro.Resumo || livro.Descricao || livro.resumo || 'Sem descrição disponível.';
    const ano     = livro.DataPublicacao || livro.AnoPublicacao || livro.ano_publicacao || '';
    const capa    = livro.Imagem || livro.capa || '';
    const livroId = livro.Livro_id || livro.id;
    const nomes   = getGeneroNomes(livro);

    const generosModalHtml = nomes.length
        ? `<div class="modal-generos">${nomes.map(n => `<span class="modal-genero-pill">${n}</span>`).join('')}</div>`
        : '<span class="modal-category">—</span>';

    document.getElementById('modalConteudo').innerHTML = `
        <div class="modal-book-header">
            ${capa
                ? `<img class="modal-cover" src="${capa}" alt="${titulo}">`
                : `<div class="modal-cover" style="background:var(--border);border-radius:8px"></div>`}
            <div class="modal-meta">
                ${generosModalHtml}
                <h2 class="modal-title">${titulo}</h2>
                <p class="modal-author">${autor}</p>
                <div class="modal-row">
                    ${ano     ? `<span class="modal-tag">📅 ${ano}</span>` : ''}
                    ${livro.Idioma || livro.idioma ? `<span class="modal-tag">🌍 ${livro.Idioma || livro.idioma}</span>` : ''}
                    ${livro.NumeroPaginas || livro.numero_paginas ? `<span class="modal-tag">📄 ${livro.NumeroPaginas || livro.numero_paginas} pág.</span>` : ''}
                </div>
            </div>
        </div>
        <p class="modal-desc">${desc}</p>
        <button class="btn-emprestimo" id="btnSolicitar"
                onclick="solicitarEmprestimo(${livroId}, '${titulo.replace(/'/g,"\\'")}')">
            Solicitar Empréstimo
        </button>`;

    document.getElementById('modal').classList.add('open');
}

function fecharModal() { document.getElementById('modal').classList.remove('open'); }

async function solicitarEmprestimo(id, titulo) {
    const usuarioId = sessionStorage.getItem('usuarioId');
    if (!usuarioId) {
        mostrarToast('Faça login para solicitar um empréstimo.', 'error');
        return;
    }

    const btn = document.getElementById('btnSolicitar');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando solicitação...'; }

    try {
        const res = await fetch(`${API}/solicitacao`, {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({ Usuario_id: parseInt(usuarioId), Livro_id: id })
        });
        const data = await res.json();
        fecharModal();
        if (res.ok) {
            mostrarToast(`📋 Solicitação de "${titulo}" enviada! Aguarde a aprovação.`, 'success');
        } else {
            mostrarToast(data.error || 'Não foi possível enviar a solicitação.', 'error');
        }
    } catch {
        fecharModal();
        mostrarToast('Erro de conexão com o servidor.', 'error');
    }
}

// ── Toast ─────────────────────────────────────────────────────
(function() {
    const style = document.createElement('style');
    style.textContent = `
        .catalogo-toast {
            position:fixed; bottom:24px; right:24px; z-index:9999;
            padding:13px 20px; border-radius:10px;
            font-size:.875rem; font-weight:500;
            box-shadow:0 4px 20px rgba(0,0,0,.2);
            color:white; max-width:360px;
            opacity:0; transform:translateY(12px);
            transition:opacity .25s, transform .25s;
        }
        .catalogo-toast.show { opacity:1; transform:translateY(0); }
        .catalogo-toast.success { background:#16a34a; }
        .catalogo-toast.error   { background:#dc2626; }
        .catalogo-toast.info    { background:#1d4ed8; }
    `;
    document.head.appendChild(style);
})();

let _toastTimer = null;
function mostrarToast(msg, type = 'info') {
    let t = document.getElementById('catalogToast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'catalogToast';
        t.className = 'catalogo-toast';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = `catalogo-toast show ${type}`;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { t.className = 'catalogo-toast'; }, 5000);
}

document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) fecharModal();
});

carregarLivros();
