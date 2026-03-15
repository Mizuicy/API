import nodemailer from 'nodemailer';

// Configuração do transporte de email (usar Gmail ou outro serviço)
// Para Gmail: ativar "Senhas de app" em https://myaccount.google.com/apppasswords
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'seu_email@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'sua_senha_app'
    }
});

// Função para validar email
export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Função para gerar código de autenticação (6 dígitos)
export function generateAuthCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Função para enviar email de autenticação
export async function sendAuthEmail(email, authCode) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER || 'seu_email@gmail.com',
            to: email,
            subject: 'Código de Autenticação - Biblioteca',
            html: `
                <h2>Código de Autenticação</h2>
                <p>Seu código de autenticação é:</p>
                <h1 style="color: #007bff; letter-spacing: 5px;">${authCode}</h1>
                <p>Este código é válido por 10 minutos.</p>
                <p>Se você não solicitou este código, ignore este email.</p>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email enviado:', info.response);
        return true;
    } catch (error) {
        console.error('Erro ao enviar email:', error);
        return false;
    }
}

// Função para enviar email de boas-vindas
export async function sendWelcomeEmail(email, name) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER || 'seu_email@gmail.com',
            to: email,
            subject: 'Bem-vindo à Biblioteca!',
            html: `
                <h2>Bem-vindo, ${name}!</h2>
                <p>Sua conta foi criada com sucesso em nosso sistema de biblioteca.</p>
                <p>Agora você pode acessar todos os recursos disponíveis.</p>
                <br/>
                <p>Obrigado por se registrar!</p>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email de boas-vindas enviado:', info.response);
        return true;
    } catch (error) {
        console.error('Erro ao enviar email de boas-vindas:', error);
        return false;
    }
}
