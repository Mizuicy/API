import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Carrega o .env a partir da raiz do projeto (API/.env)
// emailService está em backend/src/utils/ → três níveis acima = API/
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Lê e sanitiza as variáveis APÓS o dotenv carregar
// .trim() remove \r residual de CRLF (Windows) ou espaços acidentais
const EMAIL_USER     = (process.env.EMAIL_USER     || '').trim();
const EMAIL_PASSWORD = (process.env.EMAIL_PASSWORD || '').trim();

// ─── Diagnóstico de configuração ─────────────────────────────
// Exibido uma vez na inicialização para ajudar a detectar problemas de .env
console.log('[emailService] Configuração carregada:');
console.log('  EMAIL_USER     :', EMAIL_USER     || '❌ VAZIO — verifique API/.env');
console.log('  EMAIL_PASSWORD :', EMAIL_PASSWORD ? `✅ ${EMAIL_PASSWORD.length} caracteres` : '❌ VAZIO — verifique API/.env');

// ─── Transporter ─────────────────────────────────────────────
// "service: gmail" resolve automaticamente host=smtp.gmail.com, port=465, secure=true
// Compatível com Nodemailer v8 + Gmail App Password (senha de aplicativo de 16 chars)
// REQUISITO Google: a conta Gmail DEVE ter Verificação em 2 etapas ativa
//                  e a App Password deve ser gerada em myaccount.google.com/apppasswords
function criarTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASSWORD
        }
    });
}

const transporter = criarTransporter();

// ─── Verificação SMTP na inicialização ───────────────────────
// Testa a conexão com o servidor Gmail no startup.
// Falha aqui = App Password inválida ou 2FA desativado na conta Google.
transporter.verify((error) => {
    if (error) {
        console.error('\n❌ [emailService] FALHA NA CONEXÃO SMTP — E-mails NÃO serão enviados!');
        console.error('   Código do erro  :', error.code);
        console.error('   Mensagem        :', error.message);
        console.error('\n   COMO CORRIGIR:');
        console.error('   1. Acesse https://myaccount.google.com/security');
        console.error('   2. Confirme que "Verificação em 2 etapas" está ATIVA');
        console.error('   3. Acesse https://myaccount.google.com/apppasswords');
        console.error('   4. Gere uma nova "Senha de app" para "Email" / "Outro"');
        console.error('   5. Cole a senha gerada (16 chars, sem espaços) em API/.env');
        console.error('   6. EMAIL_PASSWORD=<senha_de_16_caracteres_sem_espacos>');
        console.error('   7. Reinicie o servidor\n');
    } else {
        console.log('\n✅ [emailService] Conexão SMTP Gmail verificada com sucesso!');
        console.log('   Conta autenticada:', EMAIL_USER, '\n');
    }
});

// ── Utilitários ──────────────────────────────────────────────

export function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function generateAuthCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Emails ───────────────────────────────────────────────────

// Código de autenticação (fluxo de 2FA pós-login e recuperação de senha)
export async function sendAuthEmail(email, authCode) {
    if (!EMAIL_USER || !EMAIL_PASSWORD) {
        console.error('[sendAuthEmail] ❌ Abortado: EMAIL_USER ou EMAIL_PASSWORD não configurados no .env');
        return false;
    }

    try {
        console.log('[sendAuthEmail] Enviando código para:', email);

        await transporter.sendMail({
            from: `"Kairos Biblioteca" <${EMAIL_USER}>`,
            to: email,
            subject: 'Código de Autenticação - Kairos',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;
                            border: 1px solid #e0e0e0; border-radius: 8px; background: #ffffff;">
                    <h2 style="color: #1a1a2e; margin-bottom: 8px;">🔐 Código de Autenticação</h2>
                    <p style="color: #333;">Olá, seja bem-vindo(a)! Seu código de acesso é:</p>
                    <div style="background: #f0f4ff; border-radius: 6px; padding: 16px;
                                text-align: center; margin: 20px 0;">
                        <span style="font-size: 2rem; font-weight: bold; color: #2563eb;
                                     letter-spacing: 10px;">${authCode}</span>
                    </div>
                    <p style="color: #666;">⏰ Este código é válido por <strong>10 minutos</strong>.</p>
                    <p style="color: #999; font-size: 0.85rem;">
                        Se você não tentou acessar sua conta, ignore este email.
                    </p>
                </div>
            `
        });

        console.log('[sendAuthEmail] ✅ Código enviado com sucesso para:', email);
        return true;
    } catch (error) {
        console.error('[sendAuthEmail] ❌ Falha ao enviar código:');
        console.error('   Código :', error.code);
        console.error('   Mensagem:', error.message);
        if (error.response) console.error('   Resposta SMTP:', error.response);
        return false;
    }
}

// Código de acesso (login com 2FA)
export async function sendLoginCodeEmail(email, authCode) {
    if (!EMAIL_USER || !EMAIL_PASSWORD) {
        console.error('[sendLoginCodeEmail] ❌ Abortado: credenciais não configuradas no .env');
        return false;
    }

    try {
        console.log('[sendLoginCodeEmail] Enviando código para:', email);

        await transporter.sendMail({
            from: `"Kairos Biblioteca" <${EMAIL_USER}>`,
            to: email,
            subject: 'Código de Acesso - Kairos',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;
                            padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #1a1a2e;">🔐 Código de Acesso</h2>
                    <p>Seu código de verificação para acessar a <strong>Biblioteca Kairos</strong> é:</p>
                    <div style="background: #f0f4ff; border-radius: 6px; padding: 16px;
                                text-align: center; margin: 20px 0;">
                        <span style="font-size: 2rem; font-weight: bold; color: #2563eb;
                                     letter-spacing: 10px;">${authCode}</span>
                    </div>
                    <p style="color: #666;">⏰ Este código é válido por <strong>10 minutos</strong>.</p>
                    <p style="color: #999; font-size: 0.85rem;">
                        Se você não tentou acessar sua conta, ignore este email.
                    </p>
                </div>
            `
        });

        console.log('[sendLoginCodeEmail] ✅ Email enviado com sucesso para:', email);
        return true;
    } catch (error) {
        console.error('[sendLoginCodeEmail] ❌ Erro ao enviar email:', error.message);
        if (error.response) console.error('   Resposta SMTP:', error.response);
        return false;
    }
}

// Aviso de vencimento de empréstimo (2 dias antes)
export async function sendLoanExpiryEmail(email, nomeUsuario, nomeLivro, dataPrevista) {
    if (!EMAIL_USER || !EMAIL_PASSWORD) {
        console.error('[sendLoanExpiryEmail] ❌ Abortado: credenciais não configuradas no .env');
        return false;
    }

    try {
        const dataFormatada = new Date(dataPrevista).toLocaleDateString('pt-BR', {
            day: '2-digit', month: 'long', year: 'numeric'
        });

        await transporter.sendMail({
            from: `"Kairos Biblioteca" <${EMAIL_USER}>`,
            to: email,
            subject: '⚠️ Prazo de devolução se aproximando — Kairos Biblioteca',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;
                            padding: 28px; border: 1px solid #e0e0e0; border-radius: 10px; background: #ffffff;">
                    <div style="text-align:center; margin-bottom: 24px;">
                        <span style="font-size: 2.5rem;">📚</span>
                        <h2 style="color: #1a1a2e; margin-top: 8px; font-size: 1.4rem;">Aviso de Devolução</h2>
                        <p style="color: #666; font-size: 0.9rem;">Biblioteca Kairos</p>
                    </div>
                    <p style="font-size: 1rem; color: #333;">Olá, <strong>${nomeUsuario}</strong>!</p>
                    <p style="color: #555;">Lembrete: o prazo de devolução do livro abaixo está próximo.</p>
                    <div style="background: #fef9ec; border-left: 4px solid #f59e0b;
                                border-radius: 6px; padding: 16px 20px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 0.85rem; color: #92400e;
                                  text-transform: uppercase; font-weight: 600;">Livro</p>
                        <p style="margin: 4px 0 12px; font-size: 1.1rem; font-weight: bold;
                                  color: #1a1a2e;">${nomeLivro}</p>
                        <p style="margin: 0; font-size: 0.85rem; color: #92400e;
                                  text-transform: uppercase; font-weight: 600;">Data prevista de devolução</p>
                        <p style="margin: 4px 0 0; font-size: 1rem; font-weight: bold;
                                  color: #d97706;">📅 ${dataFormatada}</p>
                    </div>
                    <div style="background: #fff3f3; border-radius: 6px; padding: 14px 18px;
                                border: 1px solid #fecaca; margin-bottom: 20px;">
                        <p style="margin: 0; color: #b91c1c; font-size: 0.95rem;">
                            ⏰ <strong>Faltam apenas 2 dias</strong> para o vencimento.
                            Por favor, devolva o livro até a data indicada.
                        </p>
                    </div>
                    <p style="color: #555; font-size: 0.9rem;">
                        Lembrete: o prazo de empréstimo da Biblioteca Kairos é de
                        <strong>14 dias</strong> a partir da retirada do livro.
                    </p>
                    <p style="color: #555; font-size: 0.9rem;">
                        Caso já tenha devolvido, desconsidere este aviso.
                    </p>
                    <p style="color: #888; font-size: 0.8rem; border-top: 1px solid #eee;
                              padding-top: 14px;">
                        Obrigado por usar a <strong>Biblioteca Kairos</strong>. 🏛️<br/>
                        Este é um email automático — não responda a esta mensagem.
                    </p>
                </div>
            `
        });

        console.log(`[sendLoanExpiryEmail] ✅ Aviso enviado para: ${email} (${nomeLivro})`);
        return true;
    } catch (error) {
        console.error('[sendLoanExpiryEmail] ❌ Erro ao enviar email:', error.message);
        return false;
    }
}

// Aviso de empréstimo em atraso (prazo de 14 dias já ultrapassado)
export async function sendLoanOverdueEmail(email, nomeUsuario, nomeLivro, dataPrevista, diasAtraso) {
    if (!EMAIL_USER || !EMAIL_PASSWORD) {
        console.error('[sendLoanOverdueEmail] ❌ Abortado: credenciais não configuradas no .env');
        return false;
    }

    try {
        const dataFormatada = new Date(dataPrevista).toLocaleDateString('pt-BR', {
            day: '2-digit', month: 'long', year: 'numeric'
        });
        const diasTexto = diasAtraso === 1 ? '1 dia' : `${diasAtraso} dias`;

        await transporter.sendMail({
            from: `"Kairos Biblioteca" <${EMAIL_USER}>`,
            to: email,
            subject: '🔴 Devolução em atraso — Kairos Biblioteca',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;
                            padding: 28px; border: 1px solid #e0e0e0; border-radius: 10px; background: #ffffff;">
                    <div style="text-align:center; margin-bottom: 24px;">
                        <span style="font-size: 2.5rem;">📚</span>
                        <h2 style="color: #1a1a2e; margin-top: 8px; font-size: 1.4rem;">Devolução Pendente</h2>
                        <p style="color: #666; font-size: 0.9rem;">Biblioteca Kairos</p>
                    </div>
                    <p style="font-size: 1rem; color: #333;">Olá, <strong>${nomeUsuario}</strong>!</p>
                    <p style="color: #555;">
                        O prazo de devolução do livro abaixo já foi ultrapassado e a devolução
                        está <strong>pendente</strong>.
                    </p>
                    <div style="background: #fef9ec; border-left: 4px solid #f59e0b;
                                border-radius: 6px; padding: 16px 20px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 0.85rem; color: #92400e;
                                  text-transform: uppercase; font-weight: 600;">Livro</p>
                        <p style="margin: 4px 0 12px; font-size: 1.1rem; font-weight: bold;
                                  color: #1a1a2e;">${nomeLivro}</p>
                        <p style="margin: 0; font-size: 0.85rem; color: #92400e;
                                  text-transform: uppercase; font-weight: 600;">Data prevista de devolução</p>
                        <p style="margin: 4px 0 0; font-size: 1rem; font-weight: bold;
                                  color: #d97706;">📅 ${dataFormatada}</p>
                    </div>
                    <div style="background: #fef2f2; border-radius: 6px; padding: 14px 18px;
                                border: 1px solid #fecaca; margin-bottom: 20px;">
                        <p style="margin: 0; color: #b91c1c; font-size: 0.95rem;">
                            🔴 <strong>Atraso de ${diasTexto}.</strong>
                            O prazo de empréstimo da Biblioteca Kairos é de <strong>14 dias</strong>
                            a partir da retirada do livro. Por favor, realize a devolução o quanto antes.
                        </p>
                    </div>
                    <p style="color: #555; font-size: 0.9rem;">
                        Caso já tenha devolvido, desconsidere este aviso.
                    </p>
                    <p style="color: #888; font-size: 0.8rem; border-top: 1px solid #eee;
                              padding-top: 14px;">
                        Obrigado por usar a <strong>Biblioteca Kairos</strong>. 🏛️<br/>
                        Este é um email automático — não responda a esta mensagem.
                    </p>
                </div>
            `
        });

        console.log(`[sendLoanOverdueEmail] ✅ Aviso de atraso enviado para: ${email} (${nomeLivro})`);
        return true;
    } catch (error) {
        console.error('[sendLoanOverdueEmail] ❌ Erro ao enviar email:', error.message);
        return false;
    }
}

// Email de boas-vindas
export async function sendWelcomeEmail(email, name) {
    if (!EMAIL_USER || !EMAIL_PASSWORD) {
        console.error('[sendWelcomeEmail] ❌ Abortado: credenciais não configuradas no .env');
        return false;
    }

    try {
        await transporter.sendMail({
            from: `"Kairos Biblioteca" <${EMAIL_USER}>`,
            to: email,
            subject: 'Bem-vindo à Biblioteca Kairos! 🏛️',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;
                            padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #1a1a2e;">🏛️ Bem-vindo, ${name}!</h2>
                    <p>Sua conta foi criada com sucesso na <strong>Biblioteca Kairos</strong>.</p>
                    <p>Agora você pode consultar o catálogo, fazer empréstimos e muito mais.</p>
                    <p style="color: #666;">Obrigado por se registrar!</p>
                </div>
            `
        });

        console.log('[sendWelcomeEmail] ✅ Boas-vindas enviado para:', email);
        return true;
    } catch (error) {
        console.error('[sendWelcomeEmail] ❌ Erro ao enviar email de boas-vindas:', error.message);
        return false;
    }
}