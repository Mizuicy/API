/* ============================================================
   avaliacoes.js — Sistema de Avaliação Real · Biblioteca Kairos
   Conecta ao backend real. Substitui a versão demo anterior.
   ============================================================ */

'use strict';

const _AV_API = 'http://localhost:3000';

/* ── Textos de nota ───────────────────────────────────────── */
const _NOTAS_TEXTO = {
    0: '',
    1: '1 de 5 estrelas — Não gostei',
    2: '2 de 5 estrelas — Regular',
    3: '3 de 5 estrelas — Bom',
    4: '4 de 5 estrelas — Muito bom',
    5: '5 de 5 estrelas — Excelente!'
};

/* ── Helpers visuais ──────────────────────────────────────── */
function _avRenderEstrelasMedia(nota) {
    const cheia = Math.floor(nota);
    const meia  = nota - cheia >= 0.3 && nota - cheia < 0.8 ? 1 : 0;
    const vazia = 5 - cheia - meia;
    let html = '';
    for (let i = 0; i < cheia; i++) html += '<span class="star-filled">★</span>';
    if (meia)                        html += '<span class="star-half">★</span>';
    for (let i = 0; i < vazia; i++) html += '<span class="star-empty">☆</span>';
    return html;
}

function _avRenderEstrelasCard(nota) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<span class="${i <= nota ? 's-on' : 's-off'}">${i <= nota ? '★' : '☆'}</span>`;
    }
    return html;
}

function _avInicialAvatar(nome) {
    return (nome || '?').trim().split(' ').slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

function _avCoresAvatar(idx) {
    const cores = ['#7c6ff7', '#059669', '#f97316', '#e11d48', '#0ea5e9', '#8b5cf6'];
    return cores[idx % cores.length];
}

function _avRenderAvatar(av, idx) {
    if (av.FotoPerfilUsuario) {
        return `<div class="avaliacao-avatar avaliacao-avatar-foto" style="background:${_avCoresAvatar(idx)}"><img src="${av.FotoPerfilUsuario}" alt="${av.NomeUsuario}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"></div>`;
    }
    return `<div class="avaliacao-avatar" style="background:${_avCoresAvatar(idx)}">${_avInicialAvatar(av.NomeUsuario)}</div>`;
}

function _avFormatarData(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── Busca dados reais do backend ─────────────────────────── */
async function _avCarregarDados(livroId) {
    try {
        const r = await fetch(`${_AV_API}/avaliacao/livro/${livroId}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
    } catch (e) {
        console.error('[avaliacoes] Erro ao carregar dados:', e);
        return { total: 0, media: 0, distribuicao: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, avaliacoes: [] };
    }
}

/* ── Verifica se o usuário logado tem empréstimo elegível ─── */
async function _avVerificarElegibilidade(livroId) {
    const usuarioId = sessionStorage.getItem('usuarioId');
    if (!usuarioId) return { elegivel: false, emprestimoId: null, jaAvaliou: false };

    try {
        const r = await fetch(`${_AV_API}/avaliacao/pendentes?usuario=${usuarioId}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const pendentes = await r.json();

        const pendente = pendentes.find(p => p.Livro_id === parseInt(livroId, 10));
        if (pendente) return { elegivel: true, emprestimoId: pendente.Emprestimo_id, jaAvaliou: false };

        const rH = await fetch(`${_AV_API}/avaliacao/historico?usuario=${usuarioId}`);
        if (!rH.ok) throw new Error(`HTTP ${rH.status}`);
        const historico = await rH.json();

        const jaAvaliou = historico.find(a => a.Livro_id === parseInt(livroId, 10));
        if (jaAvaliou) return { elegivel: false, emprestimoId: jaAvaliou.Emprestimo_id, jaAvaliou: true, avaliacao: jaAvaliou };

        return { elegivel: false, emprestimoId: null, jaAvaliou: false };
    } catch (e) {
        console.error('[avaliacoes] Erro ao verificar elegibilidade:', e);
        return { elegivel: false, emprestimoId: null, jaAvaliou: false };
    }
}

/* ── Renderiza seção de avaliações com dados reais ─────────── */
async function renderAvaliacoes(livroId) {
    const secaoId = 'avaliacoesSecao';

    const placeholder = `
    <div class="avaliacoes-secao" id="${secaoId}">
        <h3 class="avaliacoes-titulo">Avaliações dos Leitores</h3>
        <div style="text-align:center;padding:32px;color:var(--muted);font-size:0.88rem;">Carregando avaliações…</div>
    </div>`;

    const existing = document.getElementById(secaoId);
    if (existing) {
        existing.outerHTML = placeholder;
    } else {
        const conteudo = document.getElementById('modalConteudo');
        if (conteudo) conteudo.insertAdjacentHTML('beforeend', placeholder);
    }

    const [dados, eleg] = await Promise.all([
        _avCarregarDados(livroId),
        _avVerificarElegibilidade(livroId)
    ]);

    const { total, media, distribuicao, avaliacoes } = dados;
    const { elegivel, emprestimoId, jaAvaliou, avaliacao: avaliacaoExistente } = eleg;
    const usuarioId = sessionStorage.getItem('usuarioId');

    /* ─── Resumo com barra de distribuição ─── */
    let resumoHtml = '';
    if (total > 0) {
        const maxDist = Math.max(...Object.values(distribuicao), 1);
        const barrasHtml = [5, 4, 3, 2, 1].map(n => {
            const qtd = distribuicao[n] || 0;
            const pct = Math.round((qtd / maxDist) * 100);
            return `
            <div class="avaliacao-barra-linha">
                <span>${n}</span>
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
                <div class="avaliacao-estrelas-media">${_avRenderEstrelasMedia(media)}</div>
                <div class="avaliacao-resumo-label">${total} avaliação${total !== 1 ? 'ões' : ''}</div>
            </div>
            <div class="avaliacao-barras">${barrasHtml}</div>
        </div>`;
    }

    /* ─── Banner de estado especial ─── */
    let bannerHtml = '';
    if (total > 5 && media >= 4.5) {
        bannerHtml = `
        <div class="avaliacao-destaque-banner">
            <span class="destaque-icone">🏆</span>
            <div>
                <strong style="color:var(--text);display:block;margin-bottom:2px;">Livro muito bem avaliado!</strong>
                Este título é altamente recomendado pela nossa comunidade de leitores.
            </div>
        </div>`;
    } else if (total > 0 && total <= 5) {
        bannerHtml = `
        <div class="avaliacao-alerta-poucas">
            ⚠️ Este livro ainda tem poucas avaliações. Seja um dos primeiros a avaliar!
        </div>`;
    }

    /* ─── Formulário de avaliação ─── */
    let formHtml = '';
    if (!usuarioId) {
        formHtml = `
        <div class="avaliacao-form-card" style="text-align:center;color:var(--muted);">
            <p style="margin-bottom:10px;">Faça login para avaliar este livro.</p>
        </div>`;
    } else if (jaAvaliou && avaliacaoExistente) {
        const podEditar = !avaliacaoExistente.EditadaUmaVez;
        formHtml = `
        <div class="avaliacao-form-card" id="avaliacaoFormCard"
             data-avaliacao-id="${avaliacaoExistente.Avaliacao_id}"
             data-emprestimo-id="${avaliacaoExistente.Emprestimo_id}"
             data-modo="visualizar">
            <div class="avaliacao-form-titulo">✅ Sua avaliação</div>
            <div class="star-selector" id="starSelector" role="group" aria-label="Nota selecionada">
                ${[1,2,3,4,5].map(n =>
                    `<button class="star-btn${n <= avaliacaoExistente.Nota ? ' selected' : ''}" data-val="${n}" aria-label="${n} estrela${n>1?'s':''}" title="${_NOTAS_TEXTO[n]}" disabled>★</button>`
                ).join('')}
            </div>
            <div class="star-nota-texto" id="starNotaTexto">${_NOTAS_TEXTO[avaliacaoExistente.Nota] || ''}</div>
            <div class="avaliacao-textarea-wrap">
                <textarea class="avaliacao-textarea" id="avaliacaoComentario" maxlength="500" rows="3" placeholder="Sem comentário" disabled>${avaliacaoExistente.Comentario || ''}</textarea>
                <span class="avaliacao-char-count" id="charCount">${(avaliacaoExistente.Comentario || '').length} / 500</span>
            </div>
            ${podEditar
                ? `<button class="btn-enviar-avaliacao" id="btnEnviarAvaliacao" onclick="habilitarEdicaoAvaliacao()" style="background:var(--purple-mid);">
                        <span class="btn-icon">✏️</span> Editar Avaliação
                   </button>
                   <p style="font-size:0.75rem;color:var(--muted);text-align:center;margin-top:8px;">Você pode editar sua avaliação uma única vez.</p>`
                : `<div style="text-align:center;font-size:0.82rem;color:var(--muted);padding:8px 0;">Avaliação já enviada. Obrigado pela sua opinião!</div>`
            }
        </div>`;
    } else if (elegivel) {
        formHtml = `
        <div class="avaliacao-form-card" id="avaliacaoFormCard"
             data-emprestimo-id="${emprestimoId}"
             data-modo="criar">
            <div class="avaliacao-form-titulo">✍️ Sua avaliação</div>
            <div class="star-selector" id="starSelector" role="group" aria-label="Selecione uma nota de 1 a 5 estrelas">
                ${[1,2,3,4,5].map(n =>
                    `<button class="star-btn" data-val="${n}" aria-label="${n} estrela${n>1?'s':''}" title="${_NOTAS_TEXTO[n]}">★</button>`
                ).join('')}
            </div>
            <div class="star-nota-texto vazio" id="starNotaTexto">Selecione uma nota</div>
            <div class="avaliacao-textarea-wrap">
                <textarea class="avaliacao-textarea" id="avaliacaoComentario" maxlength="500" rows="3" placeholder="Conte o que achou deste livro (opcional)"></textarea>
                <span class="avaliacao-char-count" id="charCount">0 / 500</span>
            </div>
            <button class="btn-enviar-avaliacao" id="btnEnviarAvaliacao" onclick="enviarAvaliacao()">
                <span class="btn-icon">⭐</span> Enviar Avaliação
            </button>
        </div>`;
    } else {
        formHtml = `
        <div class="avaliacao-form-card" style="text-align:center;color:var(--muted);font-size:0.88rem;padding:18px;">
            <span style="font-size:1.4rem;display:block;margin-bottom:8px;">📖</span>
            Você ainda não pode avaliar este livro.<br>
            <span style="font-size:0.8rem;">Avalie após devolver um exemplar emprestado.</span>
        </div>`;
    }

    /* ─── Lista de avaliações ─── */
    let listaHtml = '';
    if (avaliacoes.length === 0) {
        listaHtml = `
        <div class="avaliacoes-estado-vazio">
            <div class="estado-icone">📖</div>
            <strong>Nenhuma avaliação ainda</strong>
            <p>Seja o primeiro leitor a avaliar este livro<br>e ajude outros a descobri-lo!</p>
        </div>`;
    } else {
        listaHtml = `<div class="avaliacoes-lista">` +
            avaliacoes.map((av, idx) => {
                const destaque = av.Nota >= 5 ? 'destaque' : '';
                const badge    = av.Nota === 5 ? '<span class="avaliacao-badge">★ Top review</span>' : '';
                const comentarioHtml = av.Comentario
                    ? `<p class="avaliacao-card-comentario">${av.Comentario}</p>`
                    : `<p class="avaliacao-card-sem-comentario">Sem comentário.</p>`;
                const dataLabel = av.AtualizadaEm
                    ? `${_avFormatarData(av.AtualizadaEm)} (editada)`
                    : _avFormatarData(av.CriadaEm);
                return `
                <div class="avaliacao-card ${destaque}" style="animation-delay:${idx * .07}s">
                    <div class="avaliacao-card-header">
                        <div class="avaliacao-card-user">
                            ${_avRenderAvatar(av, idx)}
                            <div class="avaliacao-user-info">
                                <div class="avaliacao-user-nome">${av.NomeUsuario}</div>
                                <div class="avaliacao-user-data">${dataLabel}</div>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                            <div class="avaliacao-card-estrelas">${_avRenderEstrelasCard(av.Nota)}</div>
                            ${badge}
                        </div>
                    </div>
                    ${comentarioHtml}
                </div>`;
            }).join('') +
        `</div>`;
    }

    /* ─── Montar seção completa ─── */
    const secaoHtml = `
    <div class="avaliacoes-secao" id="${secaoId}">
        <h3 class="avaliacoes-titulo">Avaliações dos Leitores</h3>
        ${resumoHtml}
        ${bannerHtml}
        ${formHtml}
        ${listaHtml}
    </div>`;

    const alvo = document.getElementById(secaoId);
    if (alvo) {
        alvo.outerHTML = secaoHtml;
    } else {
        const conteudo = document.getElementById('modalConteudo');
        if (conteudo) conteudo.insertAdjacentHTML('beforeend', secaoHtml);
    }

    inicializarStarSelector();
}

/* ── Interatividade do seletor de estrelas ─────────────────── */
function inicializarStarSelector() {
    const selector = document.getElementById('starSelector');
    if (!selector) return;

    const btns  = selector.querySelectorAll('.star-btn:not([disabled])');
    const texto = document.getElementById('starNotaTexto');
    let notaSel = 0;

    function pintar(ate, classe) {
        selector.querySelectorAll('.star-btn').forEach((b, i) => {
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
            if (texto) {
                texto.textContent = _NOTAS_TEXTO[notaSel];
                texto.classList.remove('vazio');
            }
        });
    });

    const textarea  = document.getElementById('avaliacaoComentario');
    const charCount = document.getElementById('charCount');
    if (textarea && charCount && !textarea.disabled) {
        textarea.addEventListener('input', () => {
            const len = textarea.value.length;
            charCount.textContent = `${len} / 500`;
            charCount.className = 'avaliacao-char-count' +
                (len >= 500 ? ' cheio' : len >= 430 ? ' quase' : '');
        });
    }
}

/* ── Habilitar edição da avaliação já feita ─────────────────── */
function habilitarEdicaoAvaliacao() {
    const form = document.getElementById('avaliacaoFormCard');
    if (!form) return;

    const btns      = form.querySelectorAll('.star-btn');
    const textarea  = document.getElementById('avaliacaoComentario');
    const charCount = document.getElementById('charCount');
    const btnEnviar = document.getElementById('btnEnviarAvaliacao');

    btns.forEach(b => b.removeAttribute('disabled'));
    if (textarea) textarea.removeAttribute('disabled');

    inicializarStarSelector();

    if (btnEnviar) {
        btnEnviar.innerHTML = '<span class="btn-icon">✅</span> Salvar Edição';
        btnEnviar.style.background = '';
        btnEnviar.onclick = enviarEdicaoAvaliacao;
    }

    if (textarea && charCount) {
        charCount.textContent = `${textarea.value.length} / 500`;
        textarea.addEventListener('input', () => {
            const len = textarea.value.length;
            charCount.textContent = `${len} / 500`;
            charCount.className = 'avaliacao-char-count' +
                (len >= 500 ? ' cheio' : len >= 430 ? ' quase' : '');
        });
    }
}

/* ── Enviar nova avaliação ──────────────────────────────────── */
async function enviarAvaliacao() {
    const usuarioId = sessionStorage.getItem('usuarioId');
    if (!usuarioId) {
        _avMostrarMensagem('Faça login para avaliar.', 'error');
        return;
    }

    const form = document.getElementById('avaliacaoFormCard');
    if (!form) return;

    const emprestimoId = form.dataset.emprestimoId;
    const selecionadas = form.querySelectorAll('.star-btn.selected').length;

    if (selecionadas === 0) {
        _avShakeStars();
        _avMostrarTextoNota('⚠️ Por favor, selecione uma nota antes de enviar.');
        return;
    }

    const comentario = document.getElementById('avaliacaoComentario')?.value?.trim() || '';
    const btn = document.getElementById('btnEnviarAvaliacao');

    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-icon">⏳</span> Enviando…'; }

    try {
        const r = await fetch(`${_AV_API}/avaliacao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Usuario_id    : parseInt(usuarioId, 10),
                Emprestimo_id : parseInt(emprestimoId, 10),
                Nota          : selecionadas,
                Comentario    : comentario || null
            })
        });

        const data = await r.json();

        if (!r.ok) {
            _avMostrarMensagem(data.error || 'Erro ao salvar avaliação.', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<span class="btn-icon">⭐</span> Enviar Avaliação'; }
            return;
        }

        if (btn) {
            btn.innerHTML = '<span class="btn-icon">✅</span> Avaliação enviada!';
            btn.style.background = 'var(--success, #28a745)';
        }
        _avMostrarMensagem('Avaliação enviada com sucesso!', 'success');

        setTimeout(() => renderAvaliacoes(_avLivroIdAtual), 1000);

    } catch (e) {
        console.error('[avaliacoes] Erro ao enviar:', e);
        _avMostrarMensagem('Erro ao salvar avaliação.', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<span class="btn-icon">⭐</span> Enviar Avaliação'; }
    }
}

/* ── Enviar edição de avaliação ─────────────────────────────── */
async function enviarEdicaoAvaliacao() {
    const usuarioId = sessionStorage.getItem('usuarioId');
    if (!usuarioId) return;

    const form = document.getElementById('avaliacaoFormCard');
    if (!form) return;

    const avaliacaoId  = form.dataset.avaliacaoId;
    const selecionadas = form.querySelectorAll('.star-btn.selected').length;

    if (selecionadas === 0) { _avShakeStars(); return; }

    const comentario = document.getElementById('avaliacaoComentario')?.value?.trim() || '';
    const btn = document.getElementById('btnEnviarAvaliacao');

    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-icon">⏳</span> Salvando…'; }

    try {
        const r = await fetch(`${_AV_API}/avaliacao/${avaliacaoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Usuario_id : parseInt(usuarioId, 10),
                Nota       : selecionadas,
                Comentario : comentario || null
            })
        });

        const data = await r.json();

        if (!r.ok) {
            _avMostrarMensagem(data.error || 'Erro ao salvar avaliação.', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<span class="btn-icon">✅</span> Salvar Edição'; }
            return;
        }

        if (btn) {
            btn.innerHTML = '<span class="btn-icon">✅</span> Avaliação atualizada!';
            btn.style.background = 'var(--success, #28a745)';
        }
        _avMostrarMensagem('Avaliação atualizada com sucesso!', 'success');

        setTimeout(() => renderAvaliacoes(_avLivroIdAtual), 1000);

    } catch (e) {
        console.error('[avaliacoes] Erro ao editar:', e);
        _avMostrarMensagem('Erro ao salvar avaliação.', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<span class="btn-icon">✅</span> Salvar Edição'; }
    }
}

/* ── Helpers de UI ──────────────────────────────────────────── */
function _avShakeStars() {
    const sel = document.getElementById('starSelector');
    if (!sel) return;
    sel.style.animation = 'none';
    sel.offsetHeight;
    sel.style.animation = 'shakeStars .35s ease';
}

function _avMostrarTextoNota(msg) {
    const el = document.getElementById('starNotaTexto');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('vazio');
    el.style.color = 'var(--error, #e74c3c)';
    setTimeout(() => { el.style.color = ''; }, 2500);
}

function _avMostrarMensagem(msg, tipo) {
    if (typeof mostrarToast === 'function') {
        mostrarToast(msg, tipo);
    } else {
        console.log('[avaliacoes]', tipo, msg);
    }
}

/* ── Keyframes ──────────────────────────────────────────────── */
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

/* ── Armazena livroId do modal atual ────────────────────────── */
let _avLivroIdAtual = null;

/* ── Patch do abrirModal existente ─────────────────────────── */
(function patchAbrirModal() {
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof abrirModal !== 'function') return;

        const _original = abrirModal;
        window.abrirModal = function(id) {
            _original(id);
            _avLivroIdAtual = id;
            requestAnimationFrame(() => {
                renderAvaliacoes(id);
            });
        };
    });
})();
