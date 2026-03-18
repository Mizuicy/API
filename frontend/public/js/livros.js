const API_URL = 'http://localhost:3000'; // Ajuste conforme necessário

// Estado da aplicação
let livros = [];
let livrosFiltrados = [];

// Elementos do DOM
const form = document.getElementById('livroForm');
const livrosGrid = document.getElementById('livrosGrid');
const searchInput = document.getElementById('searchInput');
const generoFilter = document.getElementById('generoFilter');
const modal = document.getElementById('modalDetalhes');
const closeBtn = document.querySelector('.close');

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    carregarLivros();
    setupEventListeners();
});

// Setup de eventos
function setupEventListeners() {
    form.addEventListener('submit', adicionarLivro);
    searchInput.addEventListener('input', filtrarLivros);
    generoFilter.addEventListener('change', filtrarLivros);
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
}

// Carregar livros do servidor
async function carregarLivros() {
    try {
        livrosGrid.innerHTML = '<div class="loading">Carregando livros...</div>';
        const response = await fetch(`${API_URL}/livros`);
        
        if (!response.ok) {
            throw new Error(`Erro: ${response.statusText}`);
        }
        
        livros = await response.json();
        livrosFiltrados = [...livros];
        renderizarLivros(livrosFiltrados);
    } catch (error) {
        console.error('Erro ao carregar livros:', error);
        livrosGrid.innerHTML = '<div class="loading" style="color: #ff6b6b;">Erro ao carregar livros. Verifique a conexão com o servidor.</div>';
    }
}

// Adicionar novo livro
async function adicionarLivro(e) {
    e.preventDefault();

    const dados = {
        titulo: document.getElementById('titulo').value,
        autor: document.getElementById('autor').value,
        editora: document.getElementById('editora').value,
        ano_publicacao: parseInt(document.getElementById('ano_publicacao').value),
        idioma: document.getElementById('idioma').value,
        numero_paginas: parseInt(document.getElementById('numero_paginas').value),
        classificacao_etaria: document.getElementById('classificacao_etaria').value,
        genero: document.getElementById('genero').value,
        resumo: document.getElementById('resumo').value,
        capa: document.getElementById('capa').value
    };

    try {
        const response = await fetch(`${API_URL}/livros`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });

        if (!response.ok) {
            throw new Error(`Erro: ${response.statusText}`);
        }

        mostraNotificacao('Livro adicionado com sucesso!', 'success');
        form.reset();
        carregarLivros();
    } catch (error) {
        console.error('Erro ao adicionar livro:', error);
        mostraNotificacao('Erro ao adicionar livro. Tente novamente.', 'error');
    }
}

// Deletar livro
async function deletarLivro(id) {
    if (!confirm('Tem certeza que deseja deletar este livro?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/livros/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`Erro: ${response.statusText}`);
        }

        mostraNotificacao('Livro deletado com sucesso!', 'success');
        carregarLivros();
    } catch (error) {
        console.error('Erro ao deletar livro:', error);
        mostraNotificacao('Erro ao deletar livro. Tente novamente.', 'error');
    }
}

// Renderizar livros no grid
function renderizarLivros(livrosParaRender) {
    if (livrosParaRender.length === 0) {
        livrosGrid.innerHTML = '<div class="loading">Nenhum livro encontrado.</div>';
        return;
    }

    livrosGrid.innerHTML = livrosParaRender.map(livro => `
        <div class="livro-card">
            <img src="${livro.capa}" alt="${livro.titulo}" class="livro-imagem" onerror="this.src='https://via.placeholder.com/280x250?text=Sem+Imagem'">
            <div class="livro-corpo">
                <h3 class="livro-titulo">${livro.titulo}</h3>
                <p class="livro-autor">por ${livro.autor}</p>
                <p class="livro-info">📖 ${livro.numero_paginas} páginas</p>
                <p class="livro-info">🌍 ${livro.idioma}</p>
                <span class="livro-genero">${livro.genero}</span>
                <div class="livro-action">
                    <button class="btn-detalhes" onclick="mostrarDetalhes(${livro.id})">Detalhes</button>
                    <button class="btn-deletar" onclick="deletarLivro(${livro.id})">Deletar</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Mostrar detalhes do livro
function mostrarDetalhes(id) {
    const livro = livros.find(l => l.id === id);
    
    if (!livro) return;

    const conteudo = `
        <h2 class="detalhes-titulo">${livro.titulo}</h2>
        <img src="${livro.capa}" alt="${livro.titulo}" onerror="this.src='https://via.placeholder.com/600x400?text=Sem+Imagem'">
        
        <div class="detalhes-item">
            <span class="detalhes-label">Autor:</span>
            <span class="detalhes-valor">${livro.autor}</span>
        </div>
        
        <div class="detalhes-item">
            <span class="detalhes-label">Editora:</span>
            <span class="detalhes-valor">${livro.editora}</span>
        </div>
        
        <div class="detalhes-item">
            <span class="detalhes-label">Ano de Publicação:</span>
            <span class="detalhes-valor">${livro.ano_publicacao}</span>
        </div>
        
        <div class="detalhes-item">
            <span class="detalhes-label">Idioma:</span>
            <span class="detalhes-valor">${livro.idioma}</span>
        </div>
        
        <div class="detalhes-item">
            <span class="detalhes-label">Número de Páginas:</span>
            <span class="detalhes-valor">${livro.numero_paginas}</span>
        </div>
        
        <div class="detalhes-item">
            <span class="detalhes-label">Classificação Etária:</span>
            <span class="detalhes-valor">${livro.classificacao_etaria}</span>
        </div>
        
        <div class="detalhes-item">
            <span class="detalhes-label">Gênero:</span>
            <span class="detalhes-valor">${livro.genero}</span>
        </div>
        
        <div>
            <span class="detalhes-label">Resumo:</span>
            <p class="detalhes-resumo">${livro.resumo}</p>
        </div>
    `;

    document.getElementById('detalhesConteudo').innerHTML = conteudo;
    modal.classList.add('show');
}

// Filtrar livros
function filtrarLivros() {
    const textoBusca = searchInput.value.toLowerCase();
    const generoSelecionado = generoFilter.value;

    livrosFiltrados = livros.filter(livro => {
        const correspondeTexto = 
            livro.titulo.toLowerCase().includes(textoBusca) ||
            livro.autor.toLowerCase().includes(textoBusca) ||
            livro.editora.toLowerCase().includes(textoBusca) ||
            livro.resumo.toLowerCase().includes(textoBusca);

        const correspondeGenero = generoSelecionado === '' || livro.genero === generoSelecionado;

        return correspondeTexto && correspondeGenero;
    });

    renderizarLivros(livrosFiltrados);
}

// Mostrar notificação
function mostraNotificacao(mensagem, tipo) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${tipo} show`;
    alert.textContent = mensagem;
    
    const container = document.querySelector('main');
    container.insertBefore(alert, container.firstChild);

    setTimeout(() => {
        alert.remove();
    }, 5000);
}
