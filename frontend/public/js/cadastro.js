// JS extraído de cadastro.html

const API_URL = 'http://localhost:3000';

        // ─── TELEFONE: formata como (11)94567-8900 ─────────────────────────────
        document.getElementById('telefone').addEventListener('input', function () {
            // Guarda posição do cursor antes de reformatar
            let raw = this.value.replace(/\D/g, '');

            // Limita a 11 dígitos
            if (raw.length > 11) raw = raw.slice(0, 11);

            // Monta a máscara progressivamente
            let formatted = '';
            if (raw.length > 0)  formatted  = '(' + raw.slice(0, 2);
            if (raw.length >= 2) formatted += ')' + raw.slice(2, 7);
            if (raw.length >= 7) formatted += '-' + raw.slice(7, 11);

            this.value = formatted;
        });

        // ─── CPF: formata como 000.000.000-00 ─────────────────────────────────
        document.getElementById('cpf').addEventListener('input', function () {
            let raw = this.value.replace(/\D/g, '');

            // Limita a 11 dígitos
            if (raw.length > 11) raw = raw.slice(0, 11);

            // Monta a máscara progressivamente
            let formatted = raw.slice(0, 3);
            if (raw.length >= 4)  formatted += '.' + raw.slice(3, 6);
            if (raw.length >= 7)  formatted += '.' + raw.slice(6, 9);
            if (raw.length >= 10) formatted += '-' + raw.slice(9, 11);

            this.value = formatted;
        });

        // ─── DATA DE NASCIMENTO: DD/MM/AAAA com validações ────────────────────
        document.getElementById('dataNascimento').addEventListener('input', function () {
            let raw = this.value.replace(/\D/g, '');

            // Máximo de 8 dígitos (DDMMAAAA)
            if (raw.length > 8) raw = raw.slice(0, 8);

            // Valida DIA: não pode passar de 31 nem ser 00
            if (raw.length >= 2) {
                let day = parseInt(raw.slice(0, 2), 10);
                if (day > 31) raw = '31' + raw.slice(2);
                if (day === 0) raw = '01' + raw.slice(2);
            }

            // Valida MÊS: não pode passar de 12 nem ser 00
            if (raw.length >= 4) {
                let month = parseInt(raw.slice(2, 4), 10);
                if (month > 12) raw = raw.slice(0, 2) + '12' + raw.slice(4);
                if (month === 0) raw = raw.slice(0, 2) + '01' + raw.slice(4);
            }

            // Monta a máscara DD/MM/AAAA progressivamente
            let formatted = raw.slice(0, 2);
            if (raw.length > 2) formatted += '/' + raw.slice(2, 4);
            if (raw.length > 4) formatted += '/' + raw.slice(4, 8);

            this.value = formatted;

            // Valida ANO somente quando os 4 dígitos forem digitados
            if (raw.length === 8) {
                const year = parseInt(raw.slice(4, 8), 10);
                const alertContainer = document.getElementById('alertContainer');

                if (year < 1901) {
                    mostrarAlerta('Data inválida: ano mínimo permitido é 1901.', 'error');
                } else if (year > 2023) {
                    mostrarAlerta('Data inválida: ano máximo permitido é 2023.', 'error');
                } else {
                    // Limpa alerta de data se estava visível
                    const current = alertContainer.querySelector('.alert.error');
                    if (current && current.textContent.includes('Data inválida')) {
                        alertContainer.innerHTML = '';
                    }
                }
            }
        });

        // ─── SENHA: validação de requisitos em tempo real ─────────────────────
        document.getElementById('senha').addEventListener('input', function () {
            const senha = this.value;

            const requirements = {
                'req-length': senha.length >= 8,
                'req-upper':  /[A-Z]/.test(senha),
                'req-lower':  /[a-z]/.test(senha),
                'req-number': /[0-9]/.test(senha)
            };

            for (const [id, met] of Object.entries(requirements)) {
                const element = document.getElementById(id);
                if (met) {
                    element.classList.add('met');
                    element.querySelector('.requirement-icon').textContent = '✓';
                } else {
                    element.classList.remove('met');
                    element.querySelector('.requirement-icon').textContent = '○';
                }
            }

            verificarFormulario();
        });

        document.getElementById('confirmaSenha').addEventListener('input', verificarFormulario);
        document.getElementById('termos').addEventListener('change', verificarFormulario);

        function verificarFormulario() {
            const senha        = document.getElementById('senha').value;
            const confirmaSenha = document.getElementById('confirmaSenha').value;
            const termos       = document.getElementById('termos').checked;

            const senhaValida  = senha.length >= 8 && /[A-Z]/.test(senha) && /[a-z]/.test(senha) && /[0-9]/.test(senha);
            const senhasIguais = senha === confirmaSenha && senha.length > 0;

            document.getElementById('submitBtn').disabled = !(senhaValida && senhasIguais && termos);
        }

        // ─── ENVIO DO FORMULÁRIO ───────────────────────────────────────────────
        document.getElementById('cadastroForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            // Valida data antes de enviar
            const dataRaw = document.getElementById('dataNascimento').value.replace(/\D/g, '');
            if (dataRaw.length !== 8) {
                mostrarAlerta('Por favor, preencha a data de nascimento completa (DD/MM/AAAA).', 'error');
                return;
            }

            const year = parseInt(dataRaw.slice(4, 8), 10);
            if (year < 1901 || year > 2023) {
                mostrarAlerta('Data inválida: ano deve estar entre 1901 e 2023.', 'error');
                return;
            }

            // Converte DD/MM/AAAA → AAAA-MM-DD (formato ISO para a API)
            const dataNascimento = `${dataRaw.slice(4, 8)}-${dataRaw.slice(2, 4)}-${dataRaw.slice(0, 2)}`;

            const usuario = {
                Nome:            document.getElementById('nome').value,
                Email:           document.getElementById('email').value,
                Telefone:        document.getElementById('telefone').value,
                CPF:             document.getElementById('cpf').value,
                DataNascimento:  dataNascimento,
                Senha:           document.getElementById('senha').value
            };

            try {
                const response = await fetch(`${API_URL}/usuario`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(usuario)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Erro ao criar usuário');
                }

                mostrarAlerta('✓ Conta criada com sucesso!', 'success-box');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2500);
            } catch (error) {
                mostrarAlerta(`Erro: ${error.message}`, 'error');
            }
        });

        function mostrarAlerta(mensagem, tipo) {
            const container = document.getElementById('alertContainer');

            if (tipo === 'success-box') {
                container.innerHTML = `
                    <div class="alert-success-box">
                        <div class="success-message">${mensagem}</div>
                    </div>
                `;
            } else {
                container.innerHTML = `<div class="alert ${tipo}">${mensagem}</div>`;
                if (tipo === 'error') {
                    setTimeout(() => { container.innerHTML = ''; }, 5000);
                }
            }
        }