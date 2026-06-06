// meus-emprestimos.js — Kairos Biblioteca
// Mostra empréstimos ativos/devolvidos + solicitações pendentes/reprovadas
// ATUALIZADO: exibe botão "Avaliar" nos devolvidos elegíveis + tab de avaliações pendentes

const API = 'http://localhost:3000';
let todosEmprestimos   = [];
let todasSolicitacoes  = [];
let todosAvalPendentes = [];
let tabAtiva           = 'todos';

// Avatar
const nome = sessionStorage.getItem('nomeUsuario') || '';
const iniciais = nome.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase() || 'US';
document.getElementById('avatarIniciais').textContent = iniciais;

function mudarTab(tab, btn) {
    tabAtiva = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderizar();
}

function formatarData(data) {
    if (!data) return '—';
    const dt = new Date(data);
    const local = new Date(dt.getTime() + dt.getTimezoneOffset() * 60000);
    return local.toLocaleDateString('pt-BR');
}

function statusBadge(status) {
    const map = {
        'ativo':      ['badge-pendente',  'Ativo'],
        'devolvido':  ['badge-devolvido', 'Devolvido'],
        'atrasado':   ['badge-atrasado',  'Atrasado'],
        'pendente':   ['badge-pendente',  '⏳ Aguardando aprovação'],
        'aprovado':   ['badge-devolvido', '✅ Aprovado'],
        'reprovado':  ['badge-atrasado',  '❌ Reprovado'],
    };
    const [cls, label] = map[status] || ['badge-pendente', status];
    return `<span class="badge ${cls}">${label}</span>`;
}

function emprestimoElegivelAvaliacao(emprestimoId) {
    return todosAvalPendentes.some(p => p.Emprestimo_id === emprestimoId);
}

function itensParaExibir() {
    const items = [];

    todosEmprestimos.forEach(e => {
        items.push({ tipo: 'emprestimo', ...e, _status: (e.Status || 'ativo').toLowerCase() });
    });

    todasSolicitacoes
        .filter(s => s.Status === 'pendente' || s.Status === 'reprovado')
        .forEach(s => {
            items.push({
                tipo: 'solicitacao',
                _status: s.Status,
                Solicitacao_id   : s.Solicitacao_id,
                NomeLivro        : s.NomeLivro,
                AutorLivro       : s.AutorLivro,
                CapaLivro        : s.CapaLivro,
                DataEmprestimo   : s.DataSolicitacao,
                DataPrevista     : null,
                DataDevolucao    : null,
                ObservacaoAdmin  : s.ObservacaoAdmin || null,
                Status           : s.Status
            });
        });

    items.sort((a, b) => new Date(b.DataEmprestimo || 0) - new Date(a.DataEmprestimo || 0));
    return items;
}

function renderizar() {
    const lista = document.getElementById('listaEmprestimos');
    const todos = itensParaExibir();

    let filtrados;
    if (tabAtiva === 'todos') {
        filtrados = todos;
    } else if (tabAtiva === 'pendente') {
        filtrados = todos.filter(i => i._status === 'pendente');
    } else if (tabAtiva === 'avaliacoes') {
        filtrados = todos.filter(i =>
            i.tipo === 'emprestimo' &&
            i._status === 'devolvido' &&
            emprestimoElegivelAvaliacao(i.Emprestimo_id)
        );
        if (filtrados.length === 0) {
            lista.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⭐</div>
                    <h3>Nenhuma avaliação pendente</h3>
                    <p>Quando você devolver um livro, poderá avaliá-lo aqui.</p>
                </div>`;
            return;
        }
    } else {
        filtrados = todos.filter(i => i._status === tabAtiva);
    }

    if (!filtrados.length) {
        lista.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h3>Nenhum item encontrado</h3>
                <p>Visite o <a href="../biblioteca/catalogo.html" style="color:var(--purple)">catálogo</a> para solicitar um empréstimo.</p>
            </div>`;
        return;
    }

    lista.innerHTML = filtrados.map(item => {
        const titulo  = item.NomeLivro  || 'Livro';
        const autor   = item.AutorLivro || '';
        const capa    = item.CapaLivro  || '';
        const st      = item._status;
        const cssClass = st === 'atrasado' ? 'atrasado'
                       : st === 'devolvido' ? 'devolvido'
                       : st === 'reprovado' ? 'atrasado' : '';

        const isSolicitacao = item.tipo === 'solicitacao';
        const labelData = isSolicitacao ? 'Solicitado em:' : 'Emprestado em:';

        const obsHtml = isSolicitacao && item.ObservacaoAdmin
            ? `<span class="emp-data" style="color:#b91c1c">Motivo: <strong>${item.ObservacaoAdmin}</strong></span>`
            : '';

        const elegivelAval = !isSolicitacao && st === 'devolvido' && emprestimoElegivelAvaliacao(item.Emprestimo_id);
        const btnAvaliar = elegivelAval
            ? `<button
                   class="btn-avaliar-emprestimo"
                   onclick="abrirAvaliacaoCatalogo(${item.Livro_id}, ${item.Emprestimo_id})"
                   title="Avaliar este livro">
                   ⭐ Avaliar
               </button>`
            : '';

        return `
        <div class="emp-card ${cssClass}">
            ${capa
                ? `<img class="emp-cover" src="${capa}" alt="${titulo}"
                       onerror="this.outerHTML='<div class=emp-cover-placeholder><svg width=24 height=24 viewBox=\\'0 0 24 24\\' fill=none stroke=currentColor stroke-width=1.5><path d=\\'M4 19.5A2.5 2.5 0 0 1 6.5 17H20\\'/><path d=\\'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z\\'/></svg></div>'">`
                : `<div class="emp-cover-placeholder">
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                           <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                       </svg>
                   </div>`}
            <div class="emp-info">
                <div class="emp-titulo">${titulo}</div>
                <div class="emp-autor">${autor}</div>
                <div class="emp-datas">
                    <span class="emp-data">${labelData} <strong>${formatarData(item.DataEmprestimo)}</strong></span>
                    ${item.DataPrevista
                        ? `<span class="emp-data">Devolução prevista: <strong>${formatarData(item.DataPrevista)}</strong></span>`
                        : ''}
                    ${item.DataDevolucao
                        ? `<span class="emp-data">Devolvido em: <strong>${formatarData(item.DataDevolucao)}</strong></span>`
                        : ''}
                    ${obsHtml}
                </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;">
                ${statusBadge(st)}
                ${btnAvaliar}
            </div>
        </div>`;
    }).join('');
}

function abrirAvaliacaoCatalogo(livroId, emprestimoId) {
    window.location.href = `../biblioteca/catalogo.html?avaliar=${livroId}&emprestimo=${emprestimoId}`;
}

async function carregarDados() {
    const usuarioId = sessionStorage.getItem('usuarioId');

    try {
        const [resEmp, resSolic, resAval] = await Promise.all([
            fetch(usuarioId ? `${API}/emprestimo?usuario=${usuarioId}` : `${API}/emprestimo`),
            usuarioId ? fetch(`${API}/solicitacao?usuario=${usuarioId}`) : Promise.resolve({ ok: true, json: async () => [] }),
            usuarioId ? fetch(`${API}/avaliacao/pendentes?usuario=${usuarioId}`) : Promise.resolve({ ok: true, json: async () => [] })
        ]);

        todosEmprestimos   = resEmp.ok   ? await resEmp.json()   : [];
        todasSolicitacoes  = resSolic.ok ? await resSolic.json() : [];
        todosAvalPendentes = resAval.ok  ? await resAval.json()  : [];

        const total = itensParaExibir().length;
        document.getElementById('pageSubtitle').textContent = total > 0
            ? `${total} registro${total > 1 ? 's' : ''}`
            : 'Nenhum empréstimo ou solicitação no momento';

        const pendentes = todasSolicitacoes.filter(s => s.Status === 'pendente').length;
        _injetarTabPendente(pendentes);
        _injetarTabAvaliacoes(todosAvalPendentes.length);

        renderizar();
    } catch(e) {
        console.error('[meus-emprestimos] Erro:', e);
        document.getElementById('pageSubtitle').textContent = 'Nenhum empréstimo no momento';
        document.getElementById('listaEmprestimos').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h3>Nenhum livro emprestado no momento</h3>
                <p>Visite o <a href="../biblioteca/catalogo.html" style="color:var(--purple)">catálogo</a> para solicitar um empréstimo.</p>
            </div>`;
    }
}

function _injetarTabPendente(count) {
    let existente = document.querySelector('.tab-btn[data-tab="pendente"]');
    if (!existente) {
        const tabBar = document.querySelector('.tabs-bar, .tab-bar, .tabs');
        if (tabBar) {
            const btn = document.createElement('button');
            btn.className = 'tab-btn';
            btn.dataset.tab = 'pendente';
            btn.onclick = function() { mudarTab('pendente', this); };
            btn.textContent = `Pendentes${count ? ` (${count})` : ''}`;
            tabBar.appendChild(btn);
        }
    } else if (count) {
        existente.textContent = `Pendentes (${count})`;
    }
}

function _injetarTabAvaliacoes(count) {
    let existente = document.querySelector('.tab-btn[data-tab="avaliacoes"]');
    if (!existente && count > 0) {
        const tabBar = document.querySelector('.tabs-bar, .tab-bar, .tabs');
        if (tabBar) {
            const btn = document.createElement('button');
            btn.className = 'tab-btn tab-btn-aval-pendente';
            btn.dataset.tab = 'avaliacoes';
            btn.onclick = function() { mudarTab('avaliacoes', this); };
            btn.innerHTML = `⭐ Avaliar (${count})`;
            tabBar.appendChild(btn);
        }
    } else if (existente) {
        existente.innerHTML = count > 0 ? `⭐ Avaliar (${count})` : '⭐ Avaliar';
        existente.style.display = count > 0 ? '' : 'none';
    }
}

// CSS do botão avaliar injetado dinamicamente
(function injetarCssAvaliar() {
    if (document.getElementById('emp-aval-css')) return;
    const s = document.createElement('style');
    s.id = 'emp-aval-css';
    s.textContent = `
    .btn-avaliar-emprestimo {
        padding: 7px 14px;
        background: linear-gradient(135deg, #f59e0b, #f97316);
        color: white;
        border: none;
        border-radius: 8px;
        font-family: inherit;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity .2s, transform .15s;
        white-space: nowrap;
    }
    .btn-avaliar-emprestimo:hover {
        opacity: .88;
        transform: translateY(-1px);
    }
    .tab-btn-aval-pendente { color: #d97706 !important; font-weight: 600; }
    .tab-btn-aval-pendente.active { color: #d97706 !important; border-bottom-color: #d97706 !important; }`;
    document.head.appendChild(s);
})();

carregarDados();
