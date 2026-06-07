// meus-emprestimos.js — Kairos Biblioteca
// Mostra empréstimos ativos/devolvidos + solicitações pendentes
// Tab "Solicitados" mostra todas as solicitações com status atualizado

const API = 'http://localhost:3000';
let todosEmprestimos   = [];
let todasSolicitacoes  = [];
let todosAvalPendentes = [];
let tabAtiva           = 'todos';

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

function statusBadgeEmprestimo(status) {
    const map = {
        'ativo':     ['badge-pendente',  '📖 Ativo'],
        'devolvido': ['badge-devolvido', '✅ Devolvido'],
        'atrasado':  ['badge-atrasado',  '⚠️ Atrasado'],
    };
    const [cls, label] = map[(status||'').toLowerCase()] || ['badge-pendente', status || 'Ativo'];
    return `<span class="badge ${cls}">${label}</span>`;
}

function statusBadgeSolicitacao(status) {
    const map = {
        'pendente':  ['badge-pendente',    '⏳ Solicitado'],
        'aprovado':  ['badge-devolvido',   '✅ Aprovado'],
        'reprovado': ['badge-atrasado',    '❌ Reprovado'],
        'em_analise':['badge-em-analise',  '🔍 Em análise'],
        'retirado':  ['badge-devolvido',   '📗 Retirado'],
    };
    const [cls, label] = map[(status||'').toLowerCase()] || ['badge-pendente', status || 'Pendente'];
    return `<span class="badge ${cls}">${label}</span>`;
}

function emprestimoElegivelAvaliacao(emprestimoId) {
    return todosAvalPendentes.some(p => p.Emprestimo_id === emprestimoId);
}

function renderizar() {
    const lista = document.getElementById('listaEmprestimos');

    if (tabAtiva === 'solicitados') {
        // Mostra TODAS as solicitações, ordenadas por data decrescente
        const solicitacoes = [...todasSolicitacoes].sort(
            (a, b) => new Date(b.DataSolicitacao || 0) - new Date(a.DataSolicitacao || 0)
        );

        if (!solicitacoes.length) {
            lista.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h3>Nenhuma solicitação encontrada</h3>
                    <p>Visite o <a href="../biblioteca/catalogo.html" style="color:var(--purple)">catálogo</a> para solicitar um empréstimo.</p>
                </div>`;
            return;
        }

        lista.innerHTML = solicitacoes.map(s => {
            const titulo  = s.NomeLivro  || 'Livro';
            const autor   = s.AutorLivro || '';
            const capa    = s.CapaLivro  || '';
            const st      = (s.Status || 'pendente').toLowerCase();
            const cssCard = st === 'reprovado' ? 'atrasado' : st === 'aprovado' ? 'devolvido' : '';

            const obsHtml = s.ObservacaoAdmin
                ? `<span class="emp-data" style="color:#b91c1c">Motivo: <strong>${s.ObservacaoAdmin}</strong></span>`
                : '';

            return `
            <div class="emp-card ${cssCard}">
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
                        <span class="emp-data">Solicitado em: <strong>${formatarData(s.DataSolicitacao)}</strong></span>
                        ${s.DataDecisao ? `<span class="emp-data">Decisão em: <strong>${formatarData(s.DataDecisao)}</strong></span>` : ''}
                        ${obsHtml}
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;">
                    ${statusBadgeSolicitacao(s.Status)}
                </div>
            </div>`;
        }).join('');
        return;
    }

    // Aba todos/ativo/atrasado/devolvido/avaliacoes
    let filtrados = todosEmprestimos;
    if (tabAtiva === 'avaliacoes') {
        filtrados = todosEmprestimos.filter(e =>
            (e.Status || '').toLowerCase() === 'devolvido' &&
            emprestimoElegivelAvaliacao(e.Emprestimo_id)
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
    } else if (tabAtiva !== 'todos') {
        filtrados = todosEmprestimos.filter(e =>
            (e.Status || '').toLowerCase() === tabAtiva
        );
    }

    if (!filtrados.length) {
        const msgs = {
            todos:     ['Nenhum empréstimo registrado', 'Visite o catálogo para solicitar seu primeiro livro.'],
            ativo:     ['Nenhum empréstimo ativo',      'Visite o catálogo para solicitar um livro.'],
            atrasado:  ['Nenhum empréstimo atrasado',   'Tudo em dia! Continue assim. 🎉'],
            devolvido: ['Nenhum livro devolvido ainda',  'Suas devoluções aparecerão aqui.'],
        };
        const [titulo, sub] = msgs[tabAtiva] || msgs.todos;
        lista.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h3>${titulo}</h3>
                <p>${sub}</p>
            </div>`;
        return;
    }

    lista.innerHTML = filtrados.map(emp => {
        const titulo   = emp.NomeLivro  || `Livro #${emp.Livro_id || '—'}`;
        const autor    = emp.AutorLivro || '';
        const capa     = emp.CapaLivro  || '';
        const status   = (emp.Status    || 'ativo').toLowerCase();
        const cssClass = status === 'atrasado' ? 'atrasado' : status === 'devolvido' ? 'devolvido' : '';

        const elegivelAval = status === 'devolvido' && emprestimoElegivelAvaliacao(emp.Emprestimo_id);
        const btnAvaliar = elegivelAval
            ? `<button
                   class="btn-avaliar-emprestimo"
                   onclick="abrirAvaliacaoCatalogo(${emp.Livro_id}, ${emp.Emprestimo_id})"
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
                    <span class="emp-data">Emprestado em: <strong>${formatarData(emp.DataEmprestimo)}</strong></span>
                    ${emp.DataPrevista
                        ? `<span class="emp-data">Devolver até: <strong>${formatarData(emp.DataPrevista)}</strong></span>`
                        : ''}
                    ${emp.DataDevolucao
                        ? `<span class="emp-data">Devolvido em: <strong>${formatarData(emp.DataDevolucao)}</strong></span>`
                        : ''}
                </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;">
                ${statusBadgeEmprestimo(status)}
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

        // Atualiza contador no subtítulo
        const total = todosEmprestimos.length + todasSolicitacoes.length;
        document.getElementById('pageSubtitle').textContent = total > 0
            ? `${total} registro${total > 1 ? 's' : ''}`
            : 'Nenhum empréstimo ou solicitação no momento';

        // Atualiza badge da aba Solicitados
        const tabSolic = document.querySelector('.tab-btn[data-tab="solicitados"]');
        if (tabSolic) {
            const pendentes = todasSolicitacoes.filter(s => s.Status === 'pendente').length;
            tabSolic.innerHTML = pendentes
                ? `Solicitados <span style="background:#667eea;color:#fff;border-radius:99px;padding:1px 7px;font-size:.75rem;margin-left:4px">${pendentes}</span>`
                : 'Solicitados';
        }

        // Aba avaliações
        _injetarTabAvaliacoes(todosAvalPendentes.length);

        renderizar();
    } catch(e) {
        console.error('[meus-emprestimos] Erro:', e);
        document.getElementById('pageSubtitle').textContent = 'Erro ao carregar dados';
        document.getElementById('listaEmprestimos').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h3>Não foi possível conectar ao servidor</h3>
                <p>Verifique se o servidor está rodando e tente novamente.</p>
            </div>`;
    }
}

function _injetarTabAvaliacoes(count) {
    let existente = document.querySelector('.tab-btn[data-tab="avaliacoes"]');
    if (!existente && count > 0) {
        const tabBar = document.querySelector('.tabs');
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

// CSS extra injetado dinamicamente
(function injetarCss() {
    const s = document.createElement('style');
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
    .btn-avaliar-emprestimo:hover { opacity: .88; transform: translateY(-1px); }
    .tab-btn-aval-pendente { color: #d97706 !important; font-weight: 600; }
    .tab-btn-aval-pendente.active { color: #d97706 !important; border-bottom-color: #d97706 !important; }
    .badge-em-analise { background: #dbeafe; color: #1d4ed8; }
    `;
    document.head.appendChild(s);
})();

carregarDados();
