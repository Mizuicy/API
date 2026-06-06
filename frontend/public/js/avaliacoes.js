/* ============================================================
   avaliacoes.js — Sistema de Avaliação Visual · Biblioteca Kairos
   Apenas interface — sem backend, sem persistência real.
   Integra-se ao modal existente (abrirModal) em catalogo.html
   ============================================================ */

'use strict';

/* ── Dados fictícios para demonstração visual ─────────────── */
const AVALIACOES_DEMO = {
    /* livros "muito bem avaliados" — nota ≥ 4.5 */
    alto: {
        media: 4.7,
        total: 128,
        distribuicao: [4, 6, 10, 32, 76], /* 1★ → 5★ */
        lista: [
            {
                nome: 'Mariana Cavalcante',
                nota: 5,
                comentario: 'Uma obra absolutamente impactante. A prosa é densa mas recompensadora — cada parágrafo carrega camadas de significado que só se revelam numa segunda leitura. Recomendo muito!',
                data: '12 mai. 2025',
                cor: '#7c6ff7'
            },
            {
                nome: 'Ricardo Fontes',
                nota: 5,
                comentario: 'Inesquecível. A narrativa me prendeu do primeiro ao último capítulo, e ainda penso nos personagens semanas depois de terminar.',
                data: '3 abr. 2025',
                cor: '#059669'
            },
            {
                nome: 'Beatriz Lemos',
                nota: 4,
                comentario: 'Muito bom. Apenas o terceiro ato ficou um pouco arrastado, mas o final compensa tudo.',
                data: '19 mar. 2025',
                cor: '#f97316'
            },
            {
                nome: 'Henrique Azevedo',
                nota: 5,
                comentario: null,
                data: '2 fev. 2025',
                cor: '#e11d48'
            },
        ]
    },
    /* livros com poucas avaliações — total ≤ 5 */
    poucas: {
        media: 3.8,
        total: 3,
        distribuicao: [0, 0, 1, 1, 1], /* 1★ → 5★ */
        lista: [
            {
                nome: 'Fernanda Rocha',
                nota: 4,
                comentario: 'Leitura tranquila e agradável. Esperava um pouco mais de profundidade nos personagens secundários, mas gostei do ritmo.',
                data: '28 mai. 2025',
                cor: '#7c6ff7'
            },
            {
                nome: 'Carlos Drummond Jr.',
                nota: 3,
                comentario: 'Mediano. Tem boas ideias mas a execução deixa a desejar em alguns pontos.',
                data: '14 mai. 2025',
                cor: '#0ea5e9'
            },
            {
                nome: 'Ana Luiza Martins',
                nota: 5,
                comentario: null,
                data: '1 mai. 2025',
                cor: '#8b5cf6'
            },
        ]
    },
    /* livros sem nenhuma avaliação */
    vazio: {
        media: 0,
        total: 0,
        distribuicao: [0, 0, 0, 0, 0],
        lista: []
    }
};

/* ── Helpers ──────────────────────────────────────────────── */
function gerarEstrelasMedia(nota) {
    const cheia   = Math.floor(nota);
    const meia    = nota - cheia >= 0.3 && nota - cheia < 0.8 ? 1 : 0;
    const vazia   = 5 - cheia - meia;
    return '★'.repeat(cheia) +
           (meia ? '½' : '') +
           '☆'.repeat(vazia);
}

function renderEstrelasMedia(nota) {
    const cheia = Math.floor(nota);
    const meia  = nota - cheia >= 0.3 && nota - cheia < 0.8 ? 1 : 0;
    const vazia = 5 - cheia - meia;
    let html = '';
    for (let i = 0; i < cheia; i++) html += '<span class="star-filled">★</span>';
    if (meia)                        html += '<span class="star-half">★</span>';
    for (let i = 0; i < vazia; i++) html += '<span class="star-empty">☆</span>';
    return html;
}

function renderEstrelasCard(nota) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<span class="${i <= nota ? 's-on' : 's-off'}">${i <= nota ? '★' : '☆'}</span>`;
    }
    return html;
}

function inicialAvatar(nome) {
    return nome.trim().split(' ').slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

/* ── Escolhe dataset de demo conforme "hash" do id do livro ── */
function escolherDataset(livroId) {
    if (!livroId) return AVALIACOES_DEMO.poucas;
    const n = typeof livroId === 'number' ? livroId : parseInt(livroId) || 1;
    if (n % 3 === 0) return AVALIACOES_DEMO.vazio;
    if (n % 3 === 1) return AVALIACOES_DEMO.alto;
    return AVALIACOES_DEMO.poucas;
}

/* ── Textos de nota ───────────────────────────────────────── */
const NOTAS_TEXTO = {
    0: '',
    1: '1 de 5 estrelas — Não gostei',
    2: '2 de 5 estrelas — Regular',
    3: '3 de 5 estrelas — Bom',
    4: '4 de 5 estrelas — Muito bom',
    5: '5 de 5 estrelas — Excelente!'
};

/* ── Renderiza a seção completa de avaliações ─────────────── */
function renderAvaliacoes(livroId) {
    const ds = escolherDataset(livroId);
    const { media, total, distribuicao, lista } = ds;

    const maxDist = Math.max(...distribuicao, 1);

    /* ─── Resumo com barra de distribuição ─── */
    let resumoHtml = '';
    if (total > 0) {
        const barrasHtml = distribuicao.map((qtd, i) => {
            const pct = Math.round((qtd / maxDist) * 100);
            return `
            <div class="avaliacao-barra-linha">
                <span>${5 - i}</span>
                <div class="avaliacao-barra-track">
                    <div class="avaliacao-barra-fill" style="width:${pct}%"></div>
                </div>
                <span>${qtd}</span>
            </div>`;
        }).join('');

        resumoHtml = `
        <div class="avaliacao-resumo">
            <div>
                <div class="avaliacao-resumo-nota">${media.toFixed(1)}</div>
                <div class="avaliacao-estrelas-media">${renderEstrelasMedia(media)}</div>
                <div class="avaliacao-resumo-label">${total} avaliação${total !== 1 ? 'ões' : ''}</div>
            </div>
            <div class="avaliacao-barras">
                ${barrasHtml}
            </div>
        </div>`;
    }

    /* ─── Banner de estado especial ─── */
    let bannerHtml = '';
    if (total === 0) {
        bannerHtml = ''; /* estado vazio é mostrado na lista */
    } else if (total <= 5) {
        bannerHtml = `
        <div class="avaliacao-alerta-poucas">
            ⚠️ Este livro ainda tem poucas avaliações. Seja um dos primeiros a avaliar!
        </div>`;
    } else if (media >= 4.5) {
        bannerHtml = `
        <div class="avaliacao-destaque-banner">
            <span class="destaque-icone">🏆</span>
            <div>
                <strong style="color:var(--text);display:block;margin-bottom:2px;">Livro muito bem avaliado!</strong>
                Este título é altamente recomendado pela nossa comunidade de leitores.
            </div>
        </div>`;
    }

    /* ─── Formulário de avaliação ─── */
    const formHtml = `
    <div class="avaliacao-form-card" id="avaliacaoFormCard">
        <div class="avaliacao-form-titulo">✍️ Sua avaliação</div>
        <div class="star-selector" id="starSelector" role="group" aria-label="Selecione uma nota de 1 a 5 estrelas">
            ${[1,2,3,4,5].map(n =>
                `<button class="star-btn" data-val="${n}" aria-label="${n} estrela${n>1?'s':''}" title="${NOTAS_TEXTO[n]}">★</button>`
            ).join('')}
        </div>
        <div class="star-nota-texto vazio" id="starNotaTexto">Selecione uma nota</div>
        <div class="avaliacao-textarea-wrap">
            <textarea
                class="avaliacao-textarea"
                id="avaliacaoComentario"
                maxlength="500"
                rows="3"
                placeholder="Conte o que achou deste livro (opcional)"
            ></textarea>
            <span class="avaliacao-char-count" id="charCount">0 / 500</span>
        </div>
        <button class="btn-enviar-avaliacao" id="btnEnviarAvaliacao" onclick="enviarAvaliacaoDemo()">
            <span class="btn-icon">⭐</span> Enviar Avaliação
        </button>
    </div>`;

    /* ─── Lista de avaliações ─── */
    let listaHtml = '';
    if (lista.length === 0) {
        listaHtml = `
        <div class="avaliacoes-estado-vazio">
            <div class="estado-icone">📖</div>
            <strong>Nenhuma avaliação ainda</strong>
            <p>Seja o primeiro leitor a avaliar este livro<br>e ajude outros a descobri-lo!</p>
        </div>`;
    } else {
        listaHtml = `<div class="avaliacoes-lista">` +
            lista.map((av, idx) => {
                const destaque = av.nota >= 5 ? 'destaque' : '';
                const badge    = av.nota === 5 ? '<span class="avaliacao-badge">★ Top review</span>' : '';
                const comentarioHtml = av.comentario
                    ? `<p class="avaliacao-card-comentario">${av.comentario}</p>`
                    : `<p class="avaliacao-card-sem-comentario">Sem comentário.</p>`;
                return `
                <div class="avaliacao-card ${destaque}" style="animation-delay:${idx * .07}s">
                    <div class="avaliacao-card-header">
                        <div class="avaliacao-card-user">
                            <div class="avaliacao-avatar" style="background:${av.cor}">${inicialAvatar(av.nome)}</div>
                            <div class="avaliacao-user-info">
                                <div class="avaliacao-user-nome">${av.nome}</div>
                                <div class="avaliacao-user-data">${av.data}</div>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                            <div class="avaliacao-card-estrelas">${renderEstrelasCard(av.nota)}</div>
                            ${badge}
                        </div>
                    </div>
                    ${comentarioHtml}
                </div>`;
            }).join('') +
        `</div>`;
    }

    /* ─── Montar seção completa ─── */
    const secao = `
    <div class="avaliacoes-secao" id="avaliacoesSecao">
        <h3 class="avaliacoes-titulo">Avaliações dos Leitores</h3>
        ${resumoHtml}
        ${bannerHtml}
        ${formHtml}
        ${listaHtml}
    </div>`;

    return secao;
}

/* ── Interatividade do seletor de estrelas ─────────────────── */
function inicializarStarSelector() {
    const selector = document.getElementById('starSelector');
    if (!selector) return;

    const btns   = selector.querySelectorAll('.star-btn');
    const texto  = document.getElementById('starNotaTexto');
    let notaSel  = 0;

    function pintar(ate, classe) {
        btns.forEach((b, i) => {
            b.classList.remove('hovered', 'selected');
            if (i < ate) b.classList.add(classe);
        });
    }

    btns.forEach((btn, idx) => {
        btn.addEventListener('mouseenter', () => {
            if (notaSel === 0) pintar(idx + 1, 'hovered');
        });
        btn.addEventListener('mouseleave', () => {
            if (notaSel === 0) pintar(0, '');
        });
        btn.addEventListener('click', () => {
            notaSel = idx + 1;
            pintar(notaSel, 'selected');
            texto.textContent = NOTAS_TEXTO[notaSel];
            texto.classList.remove('vazio');
            btn.setAttribute('data-selected', 'true');
        });
    });

    /* Contador de caracteres */
    const textarea  = document.getElementById('avaliacaoComentario');
    const charCount = document.getElementById('charCount');
    if (textarea && charCount) {
        textarea.addEventListener('input', () => {
            const len = textarea.value.length;
            charCount.textContent = `${len} / 500`;
            charCount.className = 'avaliacao-char-count' +
                (len >= 500 ? ' cheio' : len >= 430 ? ' quase' : '');
        });
    }
}

/* ── Handler do botão "Enviar Avaliação" (visual demo) ─────── */
function enviarAvaliacaoDemo() {
    const btn    = document.getElementById('btnEnviarAvaliacao');
    const selector = document.getElementById('starSelector');
    const notaSel  = selector
        ? parseInt([...selector.querySelectorAll('.star-btn.selected')].length)
        : 0;

    if (notaSel === 0) {
        /* Shake visual no seletor de estrelas */
        if (selector) {
            selector.style.animation = 'none';
            selector.offsetHeight; /* reflow */
            selector.style.animation = 'shakeStars .35s ease';
        }
        const texto = document.getElementById('starNotaTexto');
        if (texto) {
            texto.textContent = '⚠️ Por favor, selecione uma nota antes de enviar.';
            texto.classList.remove('vazio');
            texto.style.color = 'var(--error, #e74c3c)';
            setTimeout(() => {
                texto.style.color = '';
                if (!selector.querySelector('.star-btn.selected')) {
                    texto.textContent = 'Selecione uma nota';
                    texto.classList.add('vazio');
                }
            }, 2500);
        }
        return;
    }

    /* Feedback visual de sucesso */
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="btn-icon">⏳</span> Enviando...';
        setTimeout(() => {
            btn.innerHTML = '<span class="btn-icon">✅</span> Avaliação enviada!';
            btn.style.background = 'var(--success, #28a745)';
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = '<span class="btn-icon">⭐</span> Enviar Avaliação';
                btn.style.background = '';
            }, 2500);
        }, 800);
    }
}

/* ── Injeção de keyframes extras (shake) ──────────────────── */
(function injetarKeyframes() {
    if (document.getElementById('avaliacoes-keyframes')) return;
    const style = document.createElement('style');
    style.id = 'avaliacoes-keyframes';
    style.textContent = `
    @keyframes shakeStars {
        0%, 100% { transform: translateX(0); }
        20%       { transform: translateX(-5px); }
        40%       { transform: translateX(5px); }
        60%       { transform: translateX(-4px); }
        80%       { transform: translateX(4px); }
    }`;
    document.head.appendChild(style);
})();

/* ── Patch do abrirModal existente ────────────────────────── */
/*
 * Esta função estende o comportamento ORIGINAL de abrirModal()
 * sem modificar o arquivo catalogo.html.
 * Aguarda o modal renderizar e depois injeta a seção de avaliações.
 */
(function patchAbrirModal() {
    /* Garante que o patch só é aplicado uma vez e após o DOM estar pronto */
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof abrirModal !== 'function') return;

        const _original = abrirModal;
        window.abrirModal = function(id) {
            _original(id); /* chama o original */

            /* Aguarda o innerHTML ser populado */
            requestAnimationFrame(() => {
                const conteudo = document.getElementById('modalConteudo');
                if (!conteudo) return;

                /* Injeta a seção de avaliações */
                conteudo.insertAdjacentHTML('beforeend', renderAvaliacoes(id));

                /* Inicializa interatividade */
                inicializarStarSelector();
            });
        };
    });
})();
