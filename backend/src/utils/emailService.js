import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Transporter criado após o dotenv carregar as variáveis
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,        // false para STARTTLS na porta 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD  // App Password do Gmail (16 caracteres, sem espaços)
    }
});

// Validar configuração ao iniciar
transporter.verify((error) => {
    if (error) {
        console.error('❌ [emailService] Falha na conexão SMTP:', error.message);
        console.error('   Verifique EMAIL_USER e EMAIL_PASSWORD no arquivo .env');
    } else {
        console.log('✅ [emailService] Conexão SMTP verificada com sucesso!');
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

// Função para enviar email de autenticação (código de acesso)
export async function sendAuthEmail(email, authCode) {
    try {
        console.log('[sendAuthEmail] Enviando código para:', email);

        const mailOptions = {
            from: `"Kairos Biblioteca" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Código de Autenticação - Kairos',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px; background: #ffffff;">
                    <h2 style="color: #1a1a2e; margin-bottom: 8px;">🔐 Código de Autenticação</h2>
                    <p style="color: #333;">Olá, seja bem-vindo(a) novamente! Seu código de autenticação é:</p>
                    <div style="background: #f0f4ff; border-radius: 6px; padding: 16px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 2rem; font-weight: bold; color: #2563eb; letter-spacing: 10px;">${authCode}</span>
                    </div>
                    <p style="color: #666;">⏰ Este código é válido por <strong>10 minutos</strong>.</p>
                    <p style="color: #999; font-size: 0.85rem;">Se você não tentou acessar sua conta, ignore este email.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('[sendAuthEmail] ✅ Email enviado com sucesso para:', email);
        return true;
    } catch (error) {
        console.error('[sendAuthEmail] ❌ Erro ao enviar email:', error.message);
        console.error('[sendAuthEmail] Detalhes:', error);
        return false;
    }
}


// Função para enviar email de código de login (validação de conta)
export async function sendLoginCodeEmail(email, authCode) {
    try {
        console.log('[sendLoginCodeEmail] Enviando código para:', email);

        const mailOptions = {
            from: `"Kairos Biblioteca" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Código de Acesso - Kairos',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #1a1a2e;">🔐 Código de Acesso</h2>
                    <p>Olá! Seu código de verificação para acessar a <strong>Biblioteca Kairos</strong> é:</p>
                    <div style="background: #f0f4ff; border-radius: 6px; padding: 16px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 2rem; font-weight: bold; color: #2563eb; letter-spacing: 10px;">${authCode}</span>
                    </div>
                    <p style="color: #666;">⏰ Este código é válido por <strong>10 minutos</strong>.</p>
                    <p style="color: #999; font-size: 0.85rem;">Se você não tentou acessar sua conta, ignore este email.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('[sendLoginCodeEmail] ✅ Email enviado com sucesso para:', email);
        return true;
    } catch (error) {
        console.error('[sendLoginCodeEmail] ❌ Erro ao enviar email:', error.message);
        return false;
    }
}

 
// Função para enviar email de aviso de vencimento de empréstimo (2 dias)
export async function sendLoanExpiryEmail(email, nomeUsuario, nomeLivro, dataPrevista) {
    try {
        const dataFormatada = new Date(dataPrevista).toLocaleDateString('pt-BR', {
            day: '2-digit', month: 'long', year: 'numeric'
        });
 
        const mailOptions = {
            from: `"Kairos Biblioteca" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '\u26a0\ufe0f Prazo de devolução se aproximando \u2014 Kairos Biblioteca',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e0e0e0; border-radius: 10px; background: #ffffff;">
                    <div style="text-align:center; margin-bottom: 24px;">
                        <span style="font-size: 2.5rem;">\ud83d\udcda</span>
                        <h2 style="color: #1a1a2e; margin-top: 8px; font-size: 1.4rem;">Aviso de Devolução</h2>
                        <p style="color: #666; font-size: 0.9rem;">Biblioteca Kairos</p>
                    </div>
                    <p style="font-size: 1rem; color: #333;">Olá, <strong>${nomeUsuario}</strong>!</p>
                    <br/>
                    <p style="color: #555;">Este é um lembrete amigável: o prazo de devolução do livro abaixo está se aproximando.</p>
                    <div style="background: #fef9ec; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 16px 20px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 0.85rem; color: #92400e; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Livro</p>
                        <p style="margin: 4px 0 12px; font-size: 1.1rem; font-weight: bold; color: #1a1a2e;">${nomeLivro}</p>
                        <p style="margin: 0; font-size: 0.85rem; color: #92400e; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Data prevista de devolução</p>
                        <p style="margin: 4px 0 0; font-size: 1rem; font-weight: bold; color: #d97706;">\ud83d\udcc5 ${dataFormatada}</p>
                    </div>
                    <div style="background: #fff3f3; border-radius: 6px; padding: 14px 18px; border: 1px solid #fecaca; margin-bottom: 20px;">
                        <p style="margin: 0; color: #b91c1c; font-size: 0.95rem;">
                            \u23f0 <strong>Faltam apenas 2 dias</strong> para o vencimento deste empréstimo.
                            Por favor, devolva o livro até a data indicada para evitar atrasos.
                        </p>
                    </div>
                    <p style="color: #555; font-size: 0.9rem;">Caso já tenha realizado a devolução, desconsidere este aviso.</p>
                    <br/>
                    <p style="color: #888; font-size: 0.8rem; border-top: 1px solid #eee; padding-top: 14px;">
                        Obrigado por usar a <strong>Biblioteca Kairos</strong>. \ud83c\udfd9\ufe0f<br/>
                        Este é um email automático \u2014 não responda a esta mensagem.
                    </p>
                </div>
            `
        };
 
        await transporter.sendMail(mailOptions);
        console.log(`[sendLoanExpiryEmail] \u2705 Aviso de vencimento enviado para: ${email} (livro: ${nomeLivro})`);
        return true;
    } catch (error) {
        console.error('[sendLoanExpiryEmail] \u274c Erro ao enviar email:', error.message);
        return false;
    }
}
 
// Função para enviar email de boas-vindas
export async function sendWelcomeEmail(email, name) {
    try {
        const mailOptions = {
            from: `"Kairos Biblioteca" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Bem-vindo à Biblioteca Kairos! 🏛️',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #1a1a2e;">🏛️ Bem-vindo, ${name}!</h2>
                    <p>Sua conta foi criada com sucesso no sistema da <strong>Biblioteca Kairos</strong>.</p>
                    <p>Agora você pode acessar todos os recursos disponíveis: consultar o catálogo, fazer empréstimos e muito mais.</p>
                    <br/>
                    <p style="color: #666;">Obrigado por se registrar!</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('[sendWelcomeEmail] ✅ Email de boas-vindas enviado para:', email);
        return true;
    } catch (error) {
        console.error('[sendWelcomeEmail] ❌ Erro ao enviar email de boas-vindas:', error.message);
        return false;
    }
}