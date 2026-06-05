const API_URL = 'http://localhost:3000';

const form = document.getElementById('livroForm');

document.addEventListener('DOMContentLoaded', () => {
    form.addEventListener('submit', adicionarLivro);
    inicializarAutocompleteAutor();
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
        autorIdEl.value = '';          // limpa seleção prévia
        hintEl.textContent = '';

        clearTimeout(timeoutAutocomplete);

        if (valor.length < 2) {
            sugestoes.style.display = 'none';
            return;
        }

        timeoutAutocomplete = setTimeout(() => buscarAutores(valor), 250);
    });

    // Fecha sugestões ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#autorInput') && !e.target.closest('#autorSuggestions')) {
            sugestoes.style.display = 'none';
        }
    });

    // Fecha sugestões ao pressionar Escape
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
//  ENVIO DO FORMULÁRIO
// ══════════════════════════════════════════════════════════

async function adicionarLivro(e) {
    e.preventDefault();

    const autorNome = document.getElementById('autorInput').value.trim();
    let   autorId   = document.getElementById('autorId').value;

    if (!autorNome) {
        AdminToast.error('O nome do autor é obrigatório.');
        return;
    }

    // Se o autor digitado não está na lista, cria automaticamente antes do livro
    if (!autorId) {
        try {
            const resAutor  = await fetch(`${API_URL}/autor`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ Nome: autorNome })
            });
            const jsonAutor = await resAutor.json();

            // 201 = criado, 409 = já existe (pega o ID via nova busca)
            if (resAutor.status === 409) {
                // Autor já existe: busca o ID
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

    const dados = {
        Nome:          document.getElementById('titulo').value.trim(),
        Autor:         autorNome,
        Autor_id:      autorId ? parseInt(autorId) : null,
        Editora:       document.getElementById('editora').value.trim(),
        AnoPublicacao: parseInt(document.getElementById('ano_publicacao').value) || null,
        Idioma:        document.getElementById('idioma').value,
        NumeroPaginas: parseInt(document.getElementById('numero_paginas').value) || null,
        ClassEtaria:   document.getElementById('classificacao_etaria').value,
        Categoria:     document.getElementById('genero').value,
        Resumo:        document.getElementById('resumo').value.trim(),
        Imagem:        document.getElementById('capa').value || null
    };

    if (!dados.Nome) {
        AdminToast.error('O título do livro é obrigatório.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/livro`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(dados)
        });

        const json = await response.json();

        if (!response.ok) {
            AdminToast.error(json.error || 'Erro ao adicionar livro.');
            return;
        }

        AdminToast.success('Livro adicionado com sucesso!');
        form.reset();
        document.getElementById('autorId').value  = '';
        document.getElementById('autorHint').textContent = '';
        if (typeof removeCapa === 'function') removeCapa();

    } catch (error) {
        console.error('Erro ao adicionar livro:', error);
        AdminToast.error('Erro de conexão. Verifique se o servidor está rodando.');
    }
}

/** @deprecated use AdminToast directly */
function mostraNotificacao(mensagem, tipo) {
    AdminToast.show(mensagem, tipo || 'info');
}
