// JS extraído de index.html

// Exibir nome do usuário logado se disponível
        const nome = sessionStorage.getItem('nomeUsuario');
        const email = sessionStorage.getItem('pendingEmail') || sessionStorage.getItem('admin');
        const saudacao = nome || email || 'usuário';
        document.getElementById('nomeUsuario').textContent = `Olá, ${saudacao}`;

        function logout() {
            sessionStorage.clear();
            window.location.href = 'pages/auth/login.html';
        }