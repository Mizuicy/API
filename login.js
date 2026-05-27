// JS extraído de login.html

const API = 'http://localhost:3000';


        function switchTab(tabName, btn) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');
            btn.classList.add('active');
        }

        function alerta(id, msg, tipo) {
            document.getElementById(id).innerHTML = `<div class="alert ${tipo}">${msg}</div>`;
        }

        // ── Login de Usuário ──────────────────────────────────────────────
        document.getElementById('usuarioForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('usuarioEmail').value.trim();
            const senha = document.getElementById('usuarioSenha').value;
            const btn   = document.getElementById('btnUsuario');

            btn.disabled = true;
            alerta('usuarioAlert', '<span class="spin"></span>Verificando…', 'loading');

            try {
                const res  = await fetch(`${API}/usuario/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ Email: email, Senha: senha })
                });
                const data = await res.json();

                if (!res.ok) {
                    alerta('usuarioAlert', `❌ ${data.error || 'Credenciais inválidas.'}`, 'error');
                    btn.disabled = false;
                    return;
                }

                // Salva sessão
                sessionStorage.setItem('pendingEmail', email);
                sessionStorage.setItem('nomeUsuario', data.usuario.Nome);
                sessionStorage.setItem('tipoUsuario', 'usuario');

                // Vai para validação de código
                alerta('usuarioAlert', '✅ Login bem-sucedido! Redirecionando…', 'success');
                setTimeout(() => {
                    window.location.href = 'validacoes.html';
                }, 800);

            } catch (err) {
                alerta('usuarioAlert', '❌ Servidor offline. Verifique se ele está rodando.', 'error');
                btn.disabled = false;
            }
        });

        // ── Login de Admin ────────────────────────────────────────────────────
        document.getElementById('adminForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('adminEmail').value.trim();
            const senha = document.getElementById('adminSenha').value;
            const btn   = document.getElementById('btnAdmin');

            btn.disabled = true;
            alerta('adminAlert', '<span class="spin"></span>Autenticando…', 'loading');

            try {
                const res  = await fetch(`${API}/admin/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ Email: email, Senha: senha })
                });
                const data = await res.json();

                if (!res.ok) {
                    alerta('adminAlert', `❌ ${data.error || 'Credenciais inválidas ou sem permissão de administrador.'}`, 'error');
                    btn.disabled = false;
                    return;
                }

                // Salva sessão
                sessionStorage.setItem('pendingEmail', email);
                sessionStorage.setItem('nomeUsuario', data.usuario.Nome);
                sessionStorage.setItem('tipoUsuario', 'admin');

                alerta('adminAlert', '✅ Acesso autorizado! Redirecionando…', 'success');
                setTimeout(() => {
                    window.location.href = 'validacoes.html';
                }, 800);

            } catch (err) {
                alerta('adminAlert', '❌ Servidor offline.', 'error');
                btn.disabled = false;
            }
        });