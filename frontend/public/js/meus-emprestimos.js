// JS extraído de meus-emprestimos.html

const API = 'http://localhost:3000';
let todosEmprestimos = [];
let livrosCache      = {};
let tabAtiva         = 'todos';

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
    return new Date(data).toLocaleDateString('pt-BR');
}

function statusBadge(status) {
    const map = {
        'ativo':      'badge-pendente',
        'devolvido':  'badge-devolvido',
        'atrasado':   'badge-atrasado',
        'Pendente':   'badge-pendente',
        'Devolvido':  'badge-devolvido',
        'Atrasado':   'badge-atrasado',
    };
    const labels = {
        'ativo':     'Ativo',
        'devolvido': 'Devolvido',
        'atrasado':  'Atrasado',
    };
    const label = labels[status] || status || 'Ativo';
    return `<span class="badge ${map[status] || 'badge-pendente'}">${label}</span>`;
}

function renderizar() {
    const filtrados = tabAtiva === 'todos'
        ? todosEmprestimos
        : todosEmprestimos.filter(e => {
            const s = (e.Status || '').toLowerCase();
            return s === tabAtiva.toLowerCase();
        });

    const lista = document.getElementById('listaEmprestimos');

    if (!filtrados.length) {
        lista.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h3>Nenhum livro emprestado no momento</h3>
                <p>Visite o <a href="../biblioteca/catalogo.html" style="color:var(--purple)">catálogo</a> para solicitar um empréstimo.</p>
            </div>`;
        return;
    }

    lista.innerHTML = filtrados.map(emp => {
        const titulo   = emp.NomeLivro  || `Livro #${emp.Livro_id}`;
        const autor    = emp.AutorLivro || '';
        const capa     = emp.CapaLivro  || '';
        const status   = emp.Status || 'ativo';
        const statusLow = status.toLowerCase();
        const cssClass = statusLow === 'atrasado' ? 'atrasado' : statusLow === 'devolvido' ? 'devolvido' : '';

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
                    <span class="emp-data">Emprestado em: <strong>${formatarData(emp.DataEmprestimo)}</strong></span>
                    <span class="emp-data">Devolução prevista: <strong>${formatarData(emp.DataPrevista)}</strong></span>
                    ${emp.DataDevolucao
                        ? `<span class="emp-data">Devolvido em: <strong>${formatarData(emp.DataDevolucao)}</strong></span>`
                        : ''}
                </div>
            </div>
            ${statusBadge(status)}
        </div>`;
    }).join('');
}

async function carregarDados() {
    // Pega o ID do usuário da sessão (se disponível)
    const usuarioId = sessionStorage.getItem('usuarioId');

    try {
        // Carregar empréstimos (o backend já retorna NomeLivro, AutorLivro, CapaLivro via JOIN)
        const url = usuarioId
            ? `${API}/emprestimo?usuario=${usuarioId}`
            : `${API}/emprestimo`;

        const res = await fetch(url);
        if (!res.ok) throw new Error();
        todosEmprestimos = await res.json();

        // Subtítulo
        const total = todosEmprestimos.length;
        document.getElementById('pageSubtitle').textContent = total > 0
            ? `${total} empréstimo${total > 1 ? 's' : ''} registrado${total > 1 ? 's' : ''}`
            : 'Nenhum livro emprestado no momento';

        renderizar();
    } catch {
        document.getElementById('pageSubtitle').textContent = 'Nenhum livro emprestado no momento';
        document.getElementById('listaEmprestimos').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h3>Nenhum livro emprestado no momento</h3>
                <p>Visite o <a href="../biblioteca/catalogo.html" style="color:var(--purple)">catálogo</a> para solicitar um empréstimo.</p>
            </div>`;
    }
}

carregarDados();