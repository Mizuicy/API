// JS extraído de inicio.html

const API = 'http://localhost:3000';
let todosLivros = [];

// Avatar com iniciais
const nome = sessionStorage.getItem('nomeUsuario') || '';
const iniciais = nome ? nome.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase() : 'US';
document.getElementById('avatarIniciais').textContent = iniciais;

// Redirecionar busca para catálogo
function buscarGlobal(valor) {
    if (valor.trim()) {
        sessionStorage.setItem('buscaPendente', valor.trim());
        window.location.href = 'catalogo.html';
    }
}
document.getElementById('globalSearch').addEventListener('keydown', e => {
    if (e.key === 'Enter') buscarGlobal(e.target.value);
});

// Carregar livros
async function carregarLivros() {
    try {
        const res  = await fetch(`${API}/livro`);
        todosLivros = await res.json();
        renderizarDestaque();
        renderizarMais();
    } catch {
        document.getElementById('featuredGrid').innerHTML =
            '<p style="color:var(--muted);grid-column:1/-1">Não foi possível conectar ao servidor.</p>';
    }
}

function cardHTML(livro) {
    const capa = livro.Imagem || livro.capa || '';
    const img  = capa
        ? `<img class="book-cover" src="${capa}" alt="${livro.titulo || livro.Nome}"
               onerror="this.outerHTML=this.nextElementSibling.outerHTML">`
        : '';
    return `
    <div class="book-card" onclick="abrirModal(${livro.Livro_id || livro.id})">
        ${img}
        <div class="book-cover-placeholder" ${capa ? 'style="display:none"' : ''}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
        </div>
        <div class="book-info">
            <div class="book-category">${livro.Categoria || livro.genero || 'Geral'}</div>
            <div class="book-title">${livro.Nome || livro.titulo}</div>
            <div class="book-author">${livro.Autor || livro.autor || ''}</div>
        </div>
    </div>`;
}

function renderizarDestaque() {
    const destaques = todosLivros.slice(0, 3);
    document.getElementById('featuredGrid').innerHTML =
        destaques.length ? destaques.map(cardHTML).join('') :
        '<p style="color:var(--muted);grid-column:1/-1">Nenhum livro cadastrado ainda.</p>';
}

function renderizarMais() {
    const mais = todosLivros.slice(3, 9);
    document.getElementById('moreGrid').innerHTML =
        mais.length ? mais.map(cardHTML).join('') :
        '<p style="color:var(--muted)">Sem mais livros no momento.</p>';
}

function abrirModal(id) {
    const livro = todosLivros.find(l => (l.Livro_id || l.id) === id);
    if (!livro) return;

    const titulo   = livro.Nome || livro.titulo || '—';
    const autor    = livro.Autor || livro.autor || '—';
    const categoria= livro.Categoria || livro.genero || 'Geral';
    const desc     = livro.Descricao || livro.resumo || 'Sem descrição disponível.';
    const ano      = livro.DataPublicacao || livro.ano_publicacao || '';
    const capa     = livro.Imagem || livro.capa || '';

    document.getElementById('modalConteudo').innerHTML = `
        <div class="modal-book-header">
            ${capa
                ? `<img class="modal-cover" src="${capa}" alt="${titulo}" onerror="this.style.background='var(--border)'">`
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

function fecharModal() {
    document.getElementById('modal').classList.remove('open');
}

async function solicitarEmprestimo(id, titulo) {
    const usuarioId = sessionStorage.getItem('usuarioId');
    if (!usuarioId) {
        mostrarNotif('Faça login para solicitar um empréstimo.', 'error');
        return;
    }

    const btn = document.querySelector('.btn-emprestimo');
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
            mostrarNotif(`📋 Solicitação de "${titulo}" enviada! Aguarde a aprovação do administrador.`, 'success');
        } else {
            mostrarNotif(data.error || 'Não foi possível enviar a solicitação.', 'error');
        }
    } catch {
        fecharModal();
        mostrarNotif('Erro de conexão com o servidor.', 'error');
    }
}

// ── Painel de notificação lateral ─────────────────────────────
(function() {
    const style = document.createElement('style');
    style.textContent = `
        #notifPanel {
            position: fixed; bottom: 28px; right: 28px; z-index: 9999;
            display: flex; flex-direction: column; gap: 10px;
            pointer-events: none;
        }
        .notif-card {
            background: var(--surface, #fff);
            border-radius: 14px;
            box-shadow: 0 8px 32px rgba(0,0,0,.13), 0 1.5px 6px rgba(0,0,0,.07);
            padding: 14px 18px 14px 16px;
            display: flex; align-items: flex-start; gap: 12px;
            min-width: 300px; max-width: 370px;
            pointer-events: all;
            opacity: 0; transform: translateX(30px);
            transition: opacity .28s ease, transform .28s ease;
            border-left: 4px solid #667eea;
        }
        .notif-card.show { opacity: 1; transform: translateX(0); }
        .notif-card.success { border-left-color: #16a34a; }
        .notif-card.error   { border-left-color: #dc2626; }
        .notif-card.info    { border-left-color: #667eea; }
        .notif-icon { font-size: 1.2rem; flex-shrink: 0; margin-top: 1px; }
        .notif-body { flex: 1; min-width: 0; }
        .notif-title {
            font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
            letter-spacing: .05em; color: var(--muted, #888); margin-bottom: 3px;
        }
        .notif-msg { font-size: 0.875rem; color: var(--text, #1a1a2e); line-height: 1.45; }
        .notif-close {
            background: none; border: none; cursor: pointer; padding: 0 0 0 6px;
            color: var(--muted, #aaa); font-size: 1rem; flex-shrink: 0;
            transition: color .15s;
        }
        .notif-close:hover { color: var(--text, #333); }
        @media (max-width: 480px) {
            #notifPanel { bottom: 16px; right: 12px; left: 12px; }
            .notif-card { min-width: unset; max-width: 100%; }
        }
    `;
    document.head.appendChild(style);
    const panel = document.createElement('div');
    panel.id = 'notifPanel';
    document.body.appendChild(panel);
})();

function mostrarNotif(msg, type = 'info') {
    const icons  = { success: '✅', error: '❌', info: 'ℹ️' };
    const titles = { success: 'Sucesso', error: 'Atenção', info: 'Informação' };
    const card = document.createElement('div');
    card.className = `notif-card ${type}`;
    card.innerHTML = `
        <span class="notif-icon">${icons[type] || 'ℹ️'}</span>
        <div class="notif-body">
            <div class="notif-title">${titles[type] || 'Aviso'}</div>
            <div class="notif-msg">${msg}</div>
        </div>
        <button class="notif-close" onclick="this.closest('.notif-card').remove()">✕</button>`;
    document.getElementById('notifPanel').appendChild(card);
    requestAnimationFrame(() => card.classList.add('show'));
    setTimeout(() => {
        card.classList.remove('show');
        setTimeout(() => card.remove(), 300);
    }, 5000);
}

document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) fecharModal();
});

carregarLivros();