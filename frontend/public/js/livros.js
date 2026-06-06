const API_URL = 'http://localhost:3000';

const form = document.getElementById('livroForm');

document.addEventListener('DOMContentLoaded', () => {
    form.addEventListener('submit', adicionarLivro);
    inicializarAutocompleteAutor();

    // Se veio de edição (query param ?editar=ID), carrega dados do livro
    const params = new URLSearchParams(window.location.search);
    const editarId = params.get('editar');
    if (editarId) carregarLivroParaEditar(parseInt(editarId, 10));
});

// ══════════════════════════════════════════════════════════
//  AUTOCOMPLETE DE AUTOR
// ══════════════════════════════════════════════════════════

let timeoutAutocomplete = null;

function inicializarAutocompleteAutor() {
    const input       = document.getElementById('autorInput');
    const sugestoes   = document.getElementById('autorSuggestions');
    const autorIdEl   = document.getElementById('autorId');
    const hintEl      = document.getElementById('autorHint');

    if (!input) return;

    input.addEventListener('input', () => {
        const valor = input.value.trim();
        autorIdEl.value = '';
        hintEl.textContent = '';

        clearTimeout(timeoutAutocomplete);

        if (valor.length < 2) {
            sugestoes.style.display = 'none';
            return;
        }

        timeoutAutocomplete = setTimeout(() => buscarAutores(valor), 250);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#autorInput') && !e.target.closest('#autorSuggestions')) {
            sugestoes.style.display = 'none';
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') sugestoes.style.display = 'none';
    });
}

async function buscarAutores(termo) {
    const sugestoes = document.getElementById('autorSuggestions');
    const hintEl    = document.getElementById('autorHint');

    try {
        const res      = await fetch(`${API_URL}/autor/busca?q=${encodeURIComponent(termo)}`);
        const autores  = await res.json();

        if (!autores.length) {
            sugestoes.style.display = 'none';
            hintEl.textContent      = '✨ Novo autor será cadastrado ao salvar o livro.';
            hintEl.style.color      = 'var(--purple, #667eea)';
            return;
        }

        sugestoes.innerHTML = autores.map(a => `
            <div class="autor-suggestion-item"
                 data-id="${a.Autor_id}"
                 data-nome="${a.Nome.replace(/"/g, '&quot;')}"
                 onclick="selecionarAutor(${a.Autor_id}, '${a.Nome.replace(/'/g, "\\'")}')">
                ${a.Foto
                    ? `<img src="${a.Foto}" class="sug-avatar" alt="${a.Nome}" onerror="this.style.display='none'">`
                    : `<span class="sug-avatar sug-avatar-inicial">${a.Nome[0].toUpperCase()}</span>`}
                <span>${a.Nome}</span>
            </div>`).join('');

        sugestoes.style.display = 'block';
        hintEl.textContent      = '';
    } catch (erro) {
        console.error('Erro ao buscar autores:', erro);
        sugestoes.style.display = 'none';
    }
}

function selecionarAutor(id, nome) {
    document.getElementById('autorInput').value = nome;
    document.getElementById('autorId').value    = id;
    document.getElementById('autorSuggestions').style.display = 'none';
    document.getElementById('autorHint').textContent = `✅ Autor selecionado da base de dados.`;
    document.getElementById('autorHint').style.color = 'var(--muted, #888)';
}

// ══════════════════════════════════════════════════════════
//  CARREGAMENTO PARA EDIÇÃO
// ══════════════════════════════════════════════════════════

async function carregarLivroParaEditar(id) {
    try {
        const r = await fetch(`${API_URL}/livro/${id}`);
        if (!r.ok) return;
        const livro = await r.json();

        document.getElementById('titulo').value               = livro.Nome || '';
        document.getElementById('autorInput').value           = livro.Autor || '';
        document.getElementById('editora').value              = livro.Editora || '';
        document.getElementById('ano_publicacao').value       = livro.AnoPublicacao || '';
        document.getElementById('idioma').value               = livro.Idioma || '';
        document.getElementById('numero_paginas').value       = livro.NumeroPaginas || '';
        document.getElementById('classificacao_etaria').value = livro.ClassEtaria || '';
        document.getElementById('resumo').value               = livro.Resumo || '';

        // Carrega gêneros salvos
        const generosSalvos = Array.isArray(livro.Generos)
            ? livro.Generos.map(g => (typeof g === 'string' ? g : g.Nome)).filter(Boolean)
            : (livro.Categoria ? [livro.Categoria] : []);

        if (typeof generosSelecionados !== 'undefined') {
            generosSelecionados.length = 0;
            generosSalvos.forEach(g => { if (!generosSelecionados.includes(g)) generosSelecionados.push(g); });
            if (typeof atualizarTagsGenero === 'function') atualizarTagsGenero();
        }

        // Botão de submit muda para "Atualizar"
        const btn = form.querySelector('.btn-submit');
        if (btn) btn.textContent = 'Atualizar Livro';
        form.dataset.editarId = id;

        // Capa: ao editar, exibe a imagem atual como preview (somente base64 ou caminho já salvo)
        if (livro.Imagem) {
            const preview = document.getElementById('capaPreview');
            if (preview) {
                preview.innerHTML = `
                    <div class="capa-preview-container">
                        <img src="${livro.Imagem}" class="capa-preview-img" alt="Prévia da capa" onerror="this.parentElement.innerHTML=''">
                        <button type="button" class="capa-preview-remove" onclick="removeCapa()" title="Remover imagem">×</button>
                    </div>`;
            }
            // Guarda a imagem atual no dataset para manter se não trocar o arquivo
            form.dataset.imagemAtual = livro.Imagem;
        }
    } catch(e) {
        console.error('Erro ao carregar livro para edição:', e);
    }
}

// ══════════════════════════════════════════════════════════
//  ENVIO DO FORMULÁRIO (CRIAR / ATUALIZAR)
// ══════════════════════════════════════════════════════════

async function adicionarLivro(e) {
    e.preventDefault();

    const autorNome = document.getElementById('autorInput').value.trim();
    let   autorId   = document.getElementById('autorId').value;

    if (!autorNome) {
        AdminToast.error('O nome do autor é obrigatório.');
        return;
    }

    // Gêneros selecionados (do seletor múltiplo)
    const generosArr = (typeof generosSelecionados !== 'undefined' && generosSelecionados.length > 0)
        ? [...generosSelecionados]
        : [];

    if (generosArr.length === 0) {
        AdminToast.error('Selecione pelo menos um gênero.');
        return;
    }

    // Cria autor se novo
    if (!autorId) {
        try {
            const resAutor  = await fetch(`${API_URL}/autor`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ Nome: autorNome })
            });
            const jsonAutor = await resAutor.json();

            if (resAutor.status === 409) {
                const resBusca   = await fetch(`${API_URL}/autor/busca?q=${encodeURIComponent(autorNome)}`);
                const listaBusca = await resBusca.json();
                const encontrado = listaBusca.find(a => a.Nome.toLowerCase() === autorNome.toLowerCase());
                if (encontrado) autorId = encontrado.Autor_id;
            } else if (resAutor.ok) {
                autorId = jsonAutor.Autor_id;
            } else {
                AdminToast.error(jsonAutor.error || 'Erro ao cadastrar autor.');
                return;
            }
        } catch (erro) {
            console.error('Erro ao criar autor:', erro);
            AdminToast.error('Erro de conexão ao verificar autor.');
            return;
        }
    }

    // Resolve capa: apenas arquivo local
    let imagem = form.dataset.imagemAtual || null; // mantém imagem existente se não trocar
    const capaFile = document.getElementById('capaFile');
    if (capaFile && capaFile.files && capaFile.files[0]) {
        imagem = await new Promise((res) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result);
            reader.readAsDataURL(capaFile.files[0]);
        });
    }

    const dados = {
        Nome:          document.getElementById('titulo').value.trim(),
        Autor:         autorNome,
        Autor_id:      autorId ? parseInt(autorId) : null,
        Editora:       document.getElementById('editora').value.trim(),
        AnoPublicacao: parseInt(document.getElementById('ano_publicacao').value) || null,
        Idioma:        document.getElementById('idioma').value,
        NumeroPaginas: parseInt(document.getElementById('numero_paginas').value) || null,
        ClassEtaria:   document.getElementById('classificacao_etaria').value,
        Categoria:     generosArr[0],   // compatibilidade
        Generos:       generosArr,       // novo campo N:N
        Resumo:        document.getElementById('resumo').value.trim(),
        Imagem:        imagem
    };

    if (!dados.Nome) {
        AdminToast.error('O título do livro é obrigatório.');
        return;
    }

    try {
        const editarId = form.dataset.editarId;
        const isEdicao = !!editarId;
        const url    = isEdicao ? `${API_URL}/livro/${editarId}` : `${API_URL}/livro`;
        const method = isEdicao ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(dados)
        });

        const json = await response.json();

        if (!response.ok) {
            AdminToast.error(json.error || 'Erro ao salvar livro.');
            return;
        }

        AdminToast.success(isEdicao ? 'Livro atualizado com sucesso!' : 'Livro adicionado com sucesso!');
        form.reset();
        delete form.dataset.editarId;
        delete form.dataset.imagemAtual;

        // Limpa gêneros
        if (typeof generosSelecionados !== 'undefined') {
            generosSelecionados.length = 0;
            if (typeof atualizarTagsGenero === 'function') atualizarTagsGenero();
        }

        document.getElementById('autorId').value  = '';
        document.getElementById('autorHint').textContent = '';
        if (typeof removeCapa === 'function') removeCapa();

    } catch (error) {
        console.error('Erro ao salvar livro:', error);
        AdminToast.error('Erro de conexão. Verifique se o servidor está rodando.');
    }
}

/** @deprecated use AdminToast directly */
function mostraNotificacao(mensagem, tipo) {
    AdminToast.show(mensagem, tipo || 'info');
}

// ── Imagem da Capa: apenas arquivo ───────────────────────────
function atualizarPreviewCapa() {
    const preview  = document.getElementById('capaPreview');
    const capaFile = document.getElementById('capaFile');
    if (!preview) return;

    if (capaFile && capaFile.files && capaFile.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            preview.innerHTML = `
                <div class="capa-preview-container">
                    <img src="${e.target.result}" class="capa-preview-img" alt="Prévia da capa">
                    <button type="button" class="capa-preview-remove" onclick="removeCapa()" title="Remover imagem">×</button>
                </div>`;
        };
        reader.readAsDataURL(capaFile.files[0]);
    } else {
        preview.innerHTML = '';
    }
}

function removeCapa() {
    const capaFile = document.getElementById('capaFile');
    const preview  = document.getElementById('capaPreview');
    if (capaFile) capaFile.value = '';
    if (preview)  preview.innerHTML = '';
    if (form.dataset.imagemAtual) delete form.dataset.imagemAtual;
}

// Atualiza prévia ao selecionar arquivo
document.addEventListener('DOMContentLoaded', () => {
    const capaFile = document.getElementById('capaFile');
    if (capaFile) capaFile.addEventListener('change', atualizarPreviewCapa);
});
