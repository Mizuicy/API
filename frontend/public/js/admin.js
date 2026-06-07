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

    // Inicializar modal de edição
    inicializarModalEdicaoLivro();
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
                 onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'280\\' height=\\'250\\' viewBox=\\'0 0 280 250\\'%3E%3Crect width=\\'280\\' height=\\'250\\' fill=\\'%23f3f4f6\\'/%3E%3Ctext x=\\'50%25\\' y=\\'45%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%239ca3af\\' font-family=\\'sans-serif\\' font-size=\\'13\\'%3ESem Imagem%3C/text%3E%3Ctext x=\\'50%25\\' y=\\'60%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%23d1d5db\\' font-family=\\'sans-serif\\' font-size=\\'28\\'%3E📚%3C/text%3E%3C/svg%3E'">
            <div class="livro-corpo">
                <h3 class="livro-titulo">${livro.Nome || '—'}</h3>
                <p class="livro-autor">por ${livro.Autor || '—'}</p>
                <p class="livro-info">📖 ${livro.NumeroPaginas || '—'} páginas</p>
                <p class="livro-info">🌍 ${livro.Idioma || '—'}</p>
                ${renderGeneroBadges(livro)}
                ${livro.Resumo ? `<p class="livro-resumo-card" title="${(livro.Resumo||'').replace(/"/g,'&quot;')}">${livro.Resumo}</p>` : ''}
                <div class="livro-action">
                    <button class="btn-detalhes" onclick="mostrarDetalhes(${livro.Livro_id})">Detalhes</button>
                    <button class="btn-editar-livro" onclick="abrirEdicaoLivro(${livro.Livro_id})">✏️ Editar</button>
                    <button class="btn-deletar" onclick="deletarLivro(${livro.Livro_id})">Excluir</button>
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
             onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'600\\' height=\\'400\\' viewBox=\\'0 0 600 400\\'%3E%3Crect width=\\'600\\' height=\\'400\\' fill=\\'%23f3f4f6\\'/%3E%3Ctext x=\\'50%25\\' y=\\'45%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%239ca3af\\' font-family=\\'sans-serif\\' font-size=\\'16\\'%3ESem Imagem%3C/text%3E%3Ctext x=\\'50%25\\' y=\\'60%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%23d1d5db\\' font-family=\\'sans-serif\\' font-size=\\'40\\'%3E📚%3C/text%3E%3C/svg%3E'">
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
            <span class="detalhes-label">Descrição / Resumo:</span>
            <p class="detalhes-resumo">${livro.Resumo || '<em style="color:var(--muted)">Sem descrição cadastrada.</em>'}</p>
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

// ═══════════════════════════════════════════════════════════
//  EDIÇÃO DE LIVROS — Modal lateral (mesmo padrão do empréstimo)
// ═══════════════════════════════════════════════════════════

// Gêneros disponíveis para o seletor no modal de edição
const GENEROS_EDICAO = [
    'Ação','Autobiografia','Aventura','Biografia','Ciências','Conto',
    'Drama','Educativo','Fantasia','Ficção','Ficção Científica','Filosofia',
    'História','Infantil','Mangá','Mistério','Não-Ficção','Poesia',
    'Psicologia','Quadrinhos','Romance','Suspense','Tecnologia','Terror','Autoajuda','Outro'
];

let generosEdicaoSelecionados = [];
let generosEdicaoDisponiveis  = [...GENEROS_EDICAO];
let livroEditandoId = null;
let capaBase64Edicao = null; // nova capa selecionada

function inicializarModalEdicaoLivro() {
    // Carrega gêneros da API para mesclar com os padrão
    fetch(`${API_URL}/genero`)
        .then(r => r.ok ? r.json() : [])
        .then(lista => {
            const nomesAPI = lista.map(g => g.Nome);
            const set = new Set([...nomesAPI, ...GENEROS_EDICAO]);
            generosEdicaoDisponiveis = [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        })
        .catch(() => {});

    // Fechar com Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') fecharEdicaoLivro();
    });

    // Eventos do seletor de gêneros
    const sel = document.getElementById('editLivroGeneroSelector');
    if (sel) sel.addEventListener('click', abrirDropdownEdicaoGenero);

    const si = document.getElementById('editLivroGeneroSearch');
    if (si) si.addEventListener('input', () => renderizarOpcoesEdicaoGenero(si.value));

    document.addEventListener('click', e => {
        if (!e.target.closest('#editLivroGeneroSelector') && !e.target.closest('#editLivroGeneroDropdown')) {
            const d = document.getElementById('editLivroGeneroDropdown');
            const b = document.getElementById('editLivroGeneroToggle');
            const s = document.getElementById('editLivroGeneroSelector');
            if (d) d.style.display = 'none';
            if (b) { b.classList.remove('open'); b.setAttribute('aria-expanded','false'); }
            if (s) s.classList.remove('open');
        }
    });

    // Upload de nova capa
    const capaInput = document.getElementById('editLivroCapa');
    if (capaInput) {
        capaInput.addEventListener('change', function () {
            const file = this.files[0];
            if (!file) { capaBase64Edicao = null; return; }
            const reader = new FileReader();
            reader.onload = e => {
                capaBase64Edicao = e.target.result;
                const prev = document.getElementById('editLivroCapaPreview');
                if (prev) prev.innerHTML = `<img src="${capaBase64Edicao}" alt="Prévia" style="max-height:120px;border-radius:8px;margin-top:8px;">`;
            };
            reader.readAsDataURL(file);
        });
    }
}

async function abrirEdicaoLivro(id) {
    // Busca dados atuais do livro (usa cache ou API)
    let livro = livros.find(l => l.Livro_id === id);
    if (!livro) {
        try {
            const r = await fetch(`${API_URL}/livro/${id}`);
            if (!r.ok) throw new Error('Livro não encontrado.');
            livro = await r.json();
        } catch (e) {
            AdminToast.error('Erro ao carregar dados do livro.');
            return;
        }
    }

    livroEditandoId = id;
    capaBase64Edicao = null;

    // Preenche os campos
    document.getElementById('editLivroId').value           = id;
    document.getElementById('editLivroTitulo').value       = livro.Nome || '';
    document.getElementById('editLivroAutor').value        = livro.Autor || '';
    document.getElementById('editLivroEditora').value      = livro.Editora || '';
    document.getElementById('editLivroAno').value          = livro.AnoPublicacao || '';
    document.getElementById('editLivroIdioma').value       = livro.Idioma || '';
    document.getElementById('editLivroPaginas').value      = livro.NumeroPaginas || '';
    document.getElementById('editLivroClassEtaria').value  = livro.ClassEtaria || '';
    document.getElementById('editLivroResumo').value       = livro.Resumo || '';
    document.getElementById('editLivroNumeroChamada').value = livro.NumeroChamada || '';

    // Capa atual
    const prevEl = document.getElementById('editLivroCapaPreview');
    if (prevEl) {
        if (livro.Imagem) {
            prevEl.innerHTML = `<img src="${livro.Imagem}" alt="Capa atual" style="max-height:120px;border-radius:8px;margin-top:8px;"><br><small style="color:var(--muted)">Capa atual (escolha um arquivo para substituir)</small>`;
        } else {
            prevEl.innerHTML = '<small style="color:var(--muted)">Nenhuma capa cadastrada</small>';
        }
    }
    const capaInput = document.getElementById('editLivroCapa');
    if (capaInput) capaInput.value = '';

    // Gêneros
    generosEdicaoSelecionados = getGeneroNomes(livro);
    atualizarTagsEdicaoGenero();
    renderizarOpcoesEdicaoGenero('');
    const si = document.getElementById('editLivroGeneroSearch');
    if (si) si.value = '';

    // Limpa erro
    const erroEl = document.getElementById('editLivroErro');
    if (erroEl) erroEl.style.display = 'none';

    // Abre painel
    document.getElementById('overlayEdicaoLivro').classList.add('open');
    document.getElementById('painelEdicaoLivro').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function fecharEdicaoLivro() {
    document.getElementById('overlayEdicaoLivro').classList.remove('open');
    document.getElementById('painelEdicaoLivro').classList.remove('open');
    document.body.style.overflow = '';
    livroEditandoId = null;
    capaBase64Edicao = null;
}

async function salvarEdicaoLivro() {
    const id = document.getElementById('editLivroId').value;
    if (!id) return;

    const Nome          = document.getElementById('editLivroTitulo').value.trim();
    const Autor         = document.getElementById('editLivroAutor').value.trim();
    const Editora       = document.getElementById('editLivroEditora').value.trim();
    const AnoPublicacao = document.getElementById('editLivroAno').value.trim();
    const Idioma        = document.getElementById('editLivroIdioma').value;
    const NumeroPaginas = document.getElementById('editLivroPaginas').value.trim();
    const ClassEtaria   = document.getElementById('editLivroClassEtaria').value;
    const Resumo        = document.getElementById('editLivroResumo').value.trim();
    const NumeroChamada = document.getElementById('editLivroNumeroChamada').value.trim();
    const Generos       = [...generosEdicaoSelecionados];
    const erroEl        = document.getElementById('editLivroErro');

    // Validações básicas
    if (!Nome) return mostrarErroEdicao(erroEl, 'O título do livro é obrigatório.');
    if (!Autor) return mostrarErroEdicao(erroEl, 'O autor é obrigatório.');
    if (!Editora) return mostrarErroEdicao(erroEl, 'A editora é obrigatória.');
    if (!AnoPublicacao) return mostrarErroEdicao(erroEl, 'O ano de publicação é obrigatório.');
    if (!Idioma) return mostrarErroEdicao(erroEl, 'O idioma é obrigatório.');
    if (!NumeroPaginas) return mostrarErroEdicao(erroEl, 'O número de páginas é obrigatório.');
    if (!ClassEtaria) return mostrarErroEdicao(erroEl, 'A classificação etária é obrigatória.');
    if (!Resumo) return mostrarErroEdicao(erroEl, 'O resumo é obrigatório.');
    if (Generos.length === 0) return mostrarErroEdicao(erroEl, 'Selecione pelo menos um gênero.');

    const btn = document.getElementById('btnSalvarEdicaoLivro');
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner-edicao"></span>Salvando…';
    if (erroEl) erroEl.style.display = 'none';

    // Imagem: usa nova se foi selecionada, senão mantém a atual (null = sem alteração → backend preserva)
    // Precisamos enviar a imagem atual para não apagá-la
    let Imagem = capaBase64Edicao;
    if (!Imagem) {
        // mantém a imagem do cache local
        const livroCache = livros.find(l => l.Livro_id === parseInt(id));
        Imagem = livroCache ? (livroCache.Imagem || null) : null;
    }

    const body = {
        Nome,
        Autor,
        Editora,
        AnoPublicacao: parseInt(AnoPublicacao) || null,
        Idioma,
        NumeroPaginas: parseInt(NumeroPaginas) || null,
        ClassEtaria,
        Resumo,
        Imagem,
        NumeroChamada: NumeroChamada || null,
        Generos,
        Categoria: Generos[0] || null
    };

    try {
        const resp = await fetch(`${API_URL}/livro/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Erro ao salvar livro.');

        AdminToast.success('Livro atualizado com sucesso!');
        fecharEdicaoLivro();
        await carregarLivros();
    } catch (e) {
        mostrarErroEdicao(erroEl, e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = textoOriginal;
    }
}

function mostrarErroEdicao(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Seletor de gêneros no modal de edição ────────────────────

function abrirDropdownEdicaoGenero(e) {
    if (e.target.closest('.genero-tag-remove')) return;
    const d = document.getElementById('editLivroGeneroDropdown');
    const b = document.getElementById('editLivroGeneroToggle');
    const s = document.getElementById('editLivroGeneroSelector');
    if (!d) return;
    const isOpen = d.style.display !== 'none';
    d.style.display = isOpen ? 'none' : 'flex';
    b.classList.toggle('open', !isOpen);
    s.classList.toggle('open', !isOpen);
    b.setAttribute('aria-expanded', String(!isOpen));
    if (!isOpen) {
        const si = document.getElementById('editLivroGeneroSearch');
        if (si) si.focus();
        renderizarOpcoesEdicaoGenero('');
    }
}

function renderizarOpcoesEdicaoGenero(filtro) {
    const lista = document.getElementById('editLivroGeneroOpcoes');
    if (!lista) return;
    const f = filtro.toLowerCase();
    const opcoes = generosEdicaoDisponiveis.filter(g => g.toLowerCase().includes(f));
    lista.innerHTML = opcoes.map(nome => {
        const sel = generosEdicaoSelecionados.includes(nome);
        return `<div class="genero-option${sel ? ' selected' : ''}" onclick="toggleEdicaoGenero('${nome.replace(/'/g, "\\'")}')">
            <span class="genero-option-check"></span>
            <span>${nome}</span>
        </div>`;
    }).join('') || '<div style="padding:12px 16px;color:var(--muted);font-size:.85rem">Nenhum gênero encontrado</div>';
}

function toggleEdicaoGenero(nome) {
    const idx = generosEdicaoSelecionados.indexOf(nome);
    if (idx === -1) generosEdicaoSelecionados.push(nome);
    else generosEdicaoSelecionados.splice(idx, 1);
    atualizarTagsEdicaoGenero();
    const si = document.getElementById('editLivroGeneroSearch');
    renderizarOpcoesEdicaoGenero(si ? si.value : '');
}

function removerEdicaoGenero(nome, e) {
    e.stopPropagation();
    generosEdicaoSelecionados = generosEdicaoSelecionados.filter(g => g !== nome);
    atualizarTagsEdicaoGenero();
    const si = document.getElementById('editLivroGeneroSearch');
    renderizarOpcoesEdicaoGenero(si ? si.value : '');
}

function atualizarTagsEdicaoGenero() {
    const tags = document.getElementById('editLivroGeneroTags');
    const ph   = document.getElementById('editLivroGeneroPH');
    if (!tags) return;

    if (generosEdicaoSelecionados.length === 0) {
        tags.innerHTML = '';
        if (ph) { ph.style.display = ''; tags.appendChild(ph); } else {
            const span = document.createElement('span');
            span.id = 'editLivroGeneroPH';
            span.className = 'genero-placeholder';
            span.textContent = 'Selecione um ou mais gêneros...';
            tags.appendChild(span);
        }
        return;
    }

    tags.innerHTML = generosEdicaoSelecionados.map(g => `
        <span class="genero-tag">
            ${g}
            <button type="button" class="genero-tag-remove"
                    onclick="removerEdicaoGenero('${g.replace(/'/g, "\\'")}', event)" title="Remover">×</button>
        </span>`).join('');
}

/** @deprecated use AdminToast directly */
function mostraNotificacao(mensagem, tipo) {
    AdminToast.show(mensagem, tipo || 'info');
}
