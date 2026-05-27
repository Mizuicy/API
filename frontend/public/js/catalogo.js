// JS extraído de catalogo.html

const API = 'http://localhost:3000';
let todosLivros    = [];
let categoriaAtiva = '';

// Avatar
const nome = sessionStorage.getItem('nomeUsuario') || '';
const iniciais = nome.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase() || 'US';
document.getElementById('avatarIniciais').textContent = iniciais;

// Aplicar busca pendente vinda da página Início
const buscaPendente = sessionStorage.getItem('buscaPendente');
if (buscaPendente) {
    document.getElementById('searchInput').value = buscaPendente;
    sessionStorage.removeItem('buscaPendente');
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
    const cats = [...new Set(todosLivros.map(l => l.Categoria || l.genero).filter(Boolean))];
    const bar  = document.getElementById('filterBar');

    cats.forEach(cat => {
        const btn = document.createElement('button');
        btn.className  = 'pill';
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

// Pill "Início" reseta
document.querySelector('.pill[data-cat=""]').onclick = function() {
    categoriaAtiva = '';
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    this.classList.add('active');
    filtrar();
};

function filtrar() {
    const busca = document.getElementById('searchInput').value.toLowerCase().trim();

    const resultado = todosLivros.filter(l => {
        const titulo    = (l.Nome || l.titulo || '').toLowerCase();
        const autor     = (l.Autor || l.autor  || '').toLowerCase();
        const categoria = l.Categoria || l.genero || '';

        const matchTexto = !busca || titulo.includes(busca) || autor.includes(busca);
        const matchCat   = !categoriaAtiva || categoria === categoriaAtiva;

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
        const capa     = livro.Imagem || livro.capa || '';
        const titulo   = livro.Nome || livro.titulo || '—';
        const autor    = livro.Autor || livro.autor || '';
        const categoria= livro.Categoria || livro.genero || 'Geral';
        const id       = livro.Livro_id || livro.id;

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
                <div class="book-category">${categoria}</div>
                <div class="book-title">${titulo}</div>
                <div class="book-author">${autor}</div>
            </div>
        </div>`;
    }).join('');
}

function abrirModal(id) {
    const livro = todosLivros.find(l => (l.Livro_id || l.id) === id);
    if (!livro) return;

    const titulo    = livro.Nome || livro.titulo || '—';
    const autor     = livro.Autor || livro.autor || '—';
    const categoria = livro.Categoria || livro.genero || 'Geral';
    const desc      = livro.Descricao || livro.resumo || 'Sem descrição disponível.';
    const ano       = livro.DataPublicacao || livro.ano_publicacao || '';
    const capa      = livro.Imagem || livro.capa || '';

    document.getElementById('modalConteudo').innerHTML = `
        <div class="modal-book-header">
            ${capa
                ? `<img class="modal-cover" src="${capa}" alt="${titulo}">`
                : `<div class="modal-cover" style="background:var(--border);border-radius:8px"></div>`}
            <div class="modal-meta">
                <span class="modal-category">${categoria}</span>
                <h2 class="modal-title">${titulo}</h2>
                <p class="modal-author">${autor}</p>
                <div class="modal-row">
                    ${ano ? `<span class="modal-tag">📅 ${ano}</span>` : ''}
                    ${livro.idioma ? `<span class="modal-tag">🌍 ${livro.idioma}</span>` : ''}
                    ${livro.numero_paginas ? `<span class="modal-tag">📄 ${livro.numero_paginas} pág.</span>` : ''}
                </div>
            </div>
        </div>
        <p class="modal-desc">${desc}</p>
        <button class="btn-emprestimo" onclick="solicitarEmprestimo(${livro.Livro_id || livro.id}, '${titulo.replace(/'/g,"\\'")}')">
            Solicitar Empréstimo
        </button>`;

    document.getElementById('modal').classList.add('open');
}

function fecharModal() { document.getElementById('modal').classList.remove('open'); }

function solicitarEmprestimo(id, titulo) {
    const usuarioId = sessionStorage.getItem('usuarioId');
    if (!usuarioId) {
        mostrarToast('Faça login para solicitar um empréstimo.', 'error');
        return;
    }

    const btn = document.querySelector('.btn-emprestimo');
    if (btn) { btn.disabled = true; btn.textContent = 'Solicitando...'; }

    fetch('http://localhost:3000/emprestimo', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ Usuario_id: parseInt(usuarioId), Livro_id: id })
    })
    .then(async res => {
        const data = await res.json();
        fecharModal();
        if (res.ok) {
            mostrarToast(`✅ Empréstimo de "${titulo}" realizado! Você tem 14 dias para devolver.`, 'success');
        } else {
            mostrarToast(data.error || 'Não foi possível realizar o empréstimo.', 'error');
        }
    })
    .catch(() => {
        fecharModal();
        mostrarToast('Erro de conexão com o servidor.', 'error');
    });
}

// ── Toast de feedback ─────────────────────────────────────────
(function() {
    const style = document.createElement('style');
    style.textContent = `
        .catalogo-toast {
            position: fixed; bottom: 24px; right: 24px; z-index: 9999;
            padding: 13px 20px; border-radius: 10px;
            font-size: 0.875rem; font-weight: 500;
            box-shadow: 0 4px 20px rgba(0,0,0,.2);
            color: white; max-width: 360px;
            opacity: 0; transform: translateY(12px);
            transition: opacity .25s, transform .25s;
        }
        .catalogo-toast.show { opacity: 1; transform: translateY(0); }
        .catalogo-toast.success { background: #16a34a; }
        .catalogo-toast.error   { background: #dc2626; }
        .catalogo-toast.info    { background: #1d4ed8; }
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
    _toastTimer = setTimeout(() => { t.className = 'catalogo-toast'; }, 4000);
}

document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) fecharModal();
});

carregarLivros();