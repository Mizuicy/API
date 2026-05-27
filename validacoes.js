// JS extraído de validacoes.html

const API = 'http://localhost:3000';

    // ✅ Pega o email salvo no fluxo de recuperação de senha
    const emailAtual = sessionStorage.getItem('resetEmail') || '';

    // Mostra o email na tela
    document.getElementById('emailExibido').textContent = emailAtual || 'seu email';

    // Timer
    let segundos = 600;
    let timerInterval = setInterval(() => {
        segundos--;
        const m = String(Math.floor(segundos / 60)).padStart(2, '0');
        const s = String(segundos % 60).padStart(2, '0');
        document.getElementById('countdown').textContent = `${m}:${s}`;
        if (segundos <= 60) document.getElementById('timer').classList.add('aviso');
        if (segundos <= 0) {
            clearInterval(timerInterval);
            document.getElementById('btnVerificar').disabled = true;
            alerta('Código expirado. Clique em "Reenviar código".', 'error');
        }
    }, 1000);

    // Navegação entre inputs
    const inputs = document.querySelectorAll('#codeGroup input');
    inputs.forEach((inp, i) => {
        inp.addEventListener('input', () => {
            inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
            if (inp.value && i < 5) inputs[i + 1].focus();
        });
        inp.addEventListener('keydown', e => {
            if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus();
        });
    });

    // ✅ Ao carregar a página, envia o código automaticamente
    window.addEventListener('DOMContentLoaded', () => {
        if (emailAtual) {
            enviarCodigo();
        } else {
            alerta('Nenhum email encontrado. <a href="login.html">Faça login novamente.</a>', 'error');
            document.getElementById('btnVerificar').disabled = true;
        }
    });

    async function enviarCodigo() {
        try {
            const res = await fetch(`${API}/usuario/authcode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Email: emailAtual })
            });
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                console.warn('Resposta inesperada do servidor (não é JSON).');
                alerta('Erro ao enviar código. Verifique a conexão com o servidor.', 'error');
                return;
            }
            const data = await res.json();
            if (res.ok) {
                console.log('Código enviado para:', emailAtual);
            } else {
                alerta(`❌ ${data.error || 'Erro ao enviar código.'}`, 'error');
            }
        } catch (e) {
            console.warn('Falha ao enviar código:', e.message);
            alerta('Erro ao conectar com o servidor.', 'error');
        }
    }

    async function verificarCodigo(e) {
        e.preventDefault();
        const codigo = Array.from(inputs).map(i => i.value).join('');

        if (codigo.length < 6) {
            alerta('Insira os 6 dígitos do código.', 'error');
            return;
        }

        const btn = document.getElementById('btnVerificar');
        btn.disabled = true;
        alerta('<span class="spin"></span>Verificando…', 'loading');

        try {
            const res = await fetch(`${API}/usuario/authcode/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Email: emailAtual, Codigo: codigo })
            });
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error('Resposta inesperada do servidor.');
            }
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Código inválido.');

            clearInterval(timerInterval);
            alerta('✅ Email validado! Redirecionando…', 'success');

            // ✅ FIX: Salva usuarioId para o sistema de notificações funcionar
            if (data.usuario) {
                sessionStorage.setItem('usuarioId', data.usuario.Usuario_id);
                sessionStorage.setItem('nomeUsuario', data.usuario.Nome);
                sessionStorage.setItem('tipoUsuario', data.usuario.Tipo === 'admin' ? 'admin' : 'usuario');
            }

            const tipo = sessionStorage.getItem('tipoUsuario');
            if (tipo === 'admin') {
                window.location.href = '../../index.html';
            } else {
                window.location.href = '../biblioteca/inicio.html';
            }

        } catch (err) {
            alerta(`❌ ${err.message}`, 'error');
            btn.disabled = false;
        }
    }

    async function reenviarCodigo() {
        segundos = 600;
        document.getElementById('timer').classList.remove('aviso');
        document.getElementById('btnVerificar').disabled = false;
        alerta('<span class="spin"></span>Reenviando código…', 'loading');
        await enviarCodigo();
        alerta('✅ Novo código enviado! Verifique seu email.', 'success');
    }

    function alerta(msg, tipo) {
        document.getElementById('alertBox').innerHTML = `<div class="alert ${tipo}">${msg}</div>`;
    }