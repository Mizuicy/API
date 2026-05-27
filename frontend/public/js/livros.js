const API_URL = 'http://localhost:3000';

const form = document.getElementById('livroForm');

document.addEventListener('DOMContentLoaded', () => {
    form.addEventListener('submit', adicionarLivro);
});

async function adicionarLivro(e) {
    e.preventDefault();

    const dados = {
        Nome:           document.getElementById('titulo').value.trim(),
        Autor:          document.getElementById('autor').value.trim(),
        Editora:        document.getElementById('editora').value.trim(),
        AnoPublicacao:  parseInt(document.getElementById('ano_publicacao').value) || null,
        Idioma:         document.getElementById('idioma').value,
        NumeroPaginas:  parseInt(document.getElementById('numero_paginas').value) || null,
        ClassEtaria:    document.getElementById('classificacao_etaria').value,
        Categoria:      document.getElementById('genero').value,
        Resumo:         document.getElementById('resumo').value.trim(),
        Imagem:         document.getElementById('capa').value || null
    };

    if (!dados.Nome) {
        mostraNotificacao('O título do livro é obrigatório.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/livro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        const json = await response.json();

        if (!response.ok) {
            mostraNotificacao(json.error || 'Erro ao adicionar livro.', 'error');
            return;
        }

        mostraNotificacao('Livro adicionado com sucesso!', 'success');
        form.reset();
        if (typeof removeCapa === 'function') removeCapa();

    } catch (error) {
        console.error('Erro ao adicionar livro:', error);
        mostraNotificacao('Erro de conexão. Verifique se o servidor está rodando.', 'error');
    }
}

function mostraNotificacao(mensagem, tipo) {
    document.querySelectorAll('.alert').forEach(a => a.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${tipo} show`;
    alert.textContent = mensagem;

    const container = document.querySelector('main');
    container.insertBefore(alert, container.firstChild);

    setTimeout(() => alert.remove(), 5000);
}
