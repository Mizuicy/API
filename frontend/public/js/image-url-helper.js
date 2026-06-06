/**
 * image-url-helper.js
 * Utilitário compartilhado para validação e preview de URLs de imagem.
 * Usado em: livros, autores, perfil.
 */

const ImageHelper = (() => {

    // Extensões de imagem aceitas
    const EXTENSOES_VALIDAS = /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?.*)?$/i;

    // Hosts conhecidos que servem imagens diretas
    const HOSTS_IMAGEM_CONHECIDOS = [
        'i.imgur.com',
        'images.unsplash.com',
        'upload.wikimedia.org',
        'raw.githubusercontent.com',
        'pbs.twimg.com',
        'cdn.discordapp.com',
        'media.giphy.com',
        'imgs.search.brave.com',
        'lh3.googleusercontent.com',
        'books.google.com',
        'covers.openlibrary.org',
        'images-na.ssl-images-amazon.com',
        'm.media-amazon.com',
    ];

    // URLs do Google que NÃO são links diretos de imagem
    const URLS_GOOGLE_INVALIDAS = [
        'google.com/search',
        'google.com/imgres',
        'google.com/url',
        'encrypted-tbn',
        'gstatic.com/images',
    ];

    /**
     * Verifica se uma string é uma URL válida.
     */
    function isUrl(str) {
        try {
            const u = new URL(str);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
            return false;
        }
    }

    /**
     * Verifica se é uma URL do Google problemática (não link direto).
     */
    function isGoogleSearchUrl(url) {
        return URLS_GOOGLE_INVALIDAS.some(p => url.includes(p));
    }

    /**
     * Valida se a URL parece ser um link direto de imagem.
     * Retorna: { valida: bool, mensagem: string|null }
     */
    function validarUrl(url) {
        if (!url || !url.trim()) {
            return { valida: false, mensagem: null }; // vazio = ok (campo opcional)
        }

        const u = url.trim();

        if (!isUrl(u)) {
            return {
                valida: false,
                mensagem: 'URL inválida. Certifique-se de incluir http:// ou https://'
            };
        }

        if (isGoogleSearchUrl(u)) {
            return {
                valida: false,
                mensagem: '⚠️ Este parece ser um link de pesquisa do Google, não uma imagem direta.\n\nComo obter o link direto:\n1. Clique com o botão direito na imagem\n2. Selecione "Copiar endereço da imagem"\n3. Cole esse link aqui\n\nExemplo válido: https://upload.wikimedia.org/wikipedia/commons/.../foto.jpg'
            };
        }

        // Aceita base64 também
        if (u.startsWith('data:image/')) {
            return { valida: true, mensagem: null };
        }

        const temExtensao = EXTENSOES_VALIDAS.test(u);
        const temHostConhecido = HOSTS_IMAGEM_CONHECIDOS.some(h => u.includes(h));

        if (!temExtensao && !temHostConhecido) {
            return {
                valida: true, // permite tentar, apenas avisa
                mensagem: null,
                aviso: '⚠️ A URL não termina com uma extensão de imagem conhecida (.jpg, .png, etc.). A imagem pode não carregar corretamente.'
            };
        }

        return { valida: true, mensagem: null };
    }

    /**
     * Tenta carregar a imagem e retorna uma Promise que resolve com
     * true (carregou) ou false (erro).
     */
    function testarCarregamento(url) {
        return new Promise((resolve) => {
            if (!url || url.startsWith('data:')) { resolve(true); return; }
            const img = new Image();
            img.onload  = () => resolve(true);
            img.onerror = () => resolve(false);
            // timeout de 6 segundos
            const t = setTimeout(() => resolve(false), 6000);
            img.onload = img.onerror = (e) => { clearTimeout(t); resolve(e.type === 'load'); };
            img.src = url;
        });
    }

    /**
     * Renderiza a mensagem de erro/aviso de URL do Google em um elemento.
     * @param {HTMLElement} container - elemento onde mostrar a mensagem
     * @param {string} mensagem - texto da mensagem
     * @param {boolean} isAviso - true = amarelo, false = vermelho
     */
    function mostrarMensagemUrl(container, mensagem, isAviso = false) {
        if (!container) return;
        container.innerHTML = `
            <div class="img-url-feedback ${isAviso ? 'img-url-aviso' : 'img-url-erro'}">
                <span class="img-url-feedback-icon">${isAviso ? '⚠️' : '❌'}</span>
                <span class="img-url-feedback-text">${mensagem.replace(/\n/g, '<br>')}</span>
            </div>`;
    }

    /**
     * Limpa mensagem de feedback de URL.
     */
    function limparMensagemUrl(container) {
        if (container) container.innerHTML = '';
    }

    return { validarUrl, testarCarregamento, mostrarMensagemUrl, limparMensagemUrl, isUrl };
})();

// Disponibiliza globalmente
window.ImageHelper = ImageHelper;
