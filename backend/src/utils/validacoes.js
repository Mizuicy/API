export function validarUsuario(body) {
    const { Nome, Email, Senha, CPF } = body;
    if (!Nome || !Email || !Senha || !CPF) {
        return 'Nome, Email, Senha e CPF são obrigatórios.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(Email)) {
        return 'Formato de Email inválido.';
    }
    if (CPF.replace(/\D/g, '').length !== 11) {
        return 'CPF deve conter 11 dígitos numéricos.';
    }
    if (Senha.length < 6) {
        return 'Senha deve ter no mínimo 6 caracteres.';
    }
    return null;
}
export function validarLivro(body) {
    const { Titulo, Autor, ISBN, Editora, AnoPublicacao, Categoria, Descricao } = body;
    
    // Campos obrigatórios
    if (!Titulo || !Autor || !ISBN || !AnoPublicacao) {
        return 'Título, Autor, ISBN e Ano de Publicação são obrigatórios.';
    }
    
    // Validar título (não vazio, comprimento mínimo)
    if (Titulo.trim().length < 3) {
        return 'Título deve ter no mínimo 3 caracteres.';
    }
    
    // Validar ISBN (10 ou 13 dígitos)
    const isbnNumeros = ISBN.replace(/[-\s]/g, '');
    if (!/^[\d]{10}$|^[\d]{13}$/.test(isbnNumeros)) {
        return 'ISBN deve conter 10 ou 13 dígitos numéricos.';
    }
    
    // Validar ano de publicação (entre 1000 e ano atual)
    const anoAtual = new Date().getFullYear();
    if (isNaN(AnoPublicacao) || AnoPublicacao < 1000 || AnoPublicacao > anoAtual) {
        return `Ano de publicação deve estar entre 1000 e ${anoAtual}.`;
    }
    
    // Validar autor (não vazio)
    if (Autor.trim().length < 3) {
        return 'Autor deve ter no mínimo 3 caracteres.';
    }
    
    // Validar editora (opcional, mas se fornecida deve ter comprimento mínimo)
    if (Editora && Editora.trim().length < 2) {
        return 'Editora deve ter no mínimo 2 caracteres.';
    }
    
    // Validar categoria (pode ter lista de categorias pré-aprovadas)
    const categoriasValidas = ['Ficção', 'Não-ficção', 'Romance', 'Técnico', 'Educacional'];
    if (Categoria && !categoriasValidas.includes(Categoria)) {
        return `Categoria deve ser uma de: ${categoriasValidas.join(', ')}.`;
    }
    
    // Validar descrição (se fornecida)
    if (Descricao && Descricao.length > 500) {
        return 'Descrição não pode ter mais de 500 caracteres.';
    }
    
    return null;
}