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
    const { Nome } = body;

    if (!Nome || Nome.trim().length < 2) {
        return 'Nome do livro é obrigatório e deve ter no mínimo 2 caracteres.';
    }

    return null;
}
