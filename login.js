document.addEventListener("DOMContentLoaded", () => {
    
    const loginForm = document.getElementById('login-form');
    const btn = document.getElementById('submit-btn');
    const errorAlert = document.getElementById('error-alert');
    const errorMsg = document.getElementById('error-message');

    if (!loginForm) {
        console.error("HTML incorreto: Formulário de login não foi encontrado.");
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        const loginInput = document.getElementById('login').value.trim();
        const senhaInput = document.getElementById('senha').value.trim();

        // 1. CHECAGEM DE SEGURANÇA IMEDIATA
        if (typeof window.authManager === 'undefined') {
            errorMsg.innerHTML = "O arquivo <b>token.js</b> não foi carregado.<br>Verifique se ele está salvo na mesma pasta que o <i>login.html</i> e aperte CTRL+F5.";
            errorAlert.classList.remove('hidden');
            return; 
        }

        // 2. FEEDBACK DE CARREGAMENTO
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Autenticando...';
        errorAlert.classList.add('hidden');

        try {
            // 3. COMUNICAÇÃO COM O TOKEN.JS E API
            const urlBase = window.authManager.apiUrl;
            const headersSeguros = await window.authManager.getAuthHeaders();

            // 4. REQUISIÇÃO DE LOGIN
            const loginResponse = await fetch(`${urlBase}/api/usuarios/login`, {
                method: 'POST',
                headers: headersSeguros,
                body: JSON.stringify({
                    login: loginInput,
                    senha: senhaInput
                })
            });

            const loginData = await loginResponse.json();

            // 5. TRATAMENTO DE ERROS DA API (Login Inválido)
            if (!loginResponse.ok || !loginData.success) {
                throw new Error(loginData.message || 'Usuário ou senha inválidos.');
            }

            // 6. SUCESSO! SALVANDO DADOS NA SESSÃO
            const apiToken = headersSeguros['x-api-token'];
            sessionStorage.setItem('api_token', apiToken);
            sessionStorage.setItem('usuario', JSON.stringify(loginData.data));

            // 7. REDIRECIONAMENTO
            window.location.href = 'verificaçãoseguraca.html';

        } catch (error) {
            // Mostra a mensagem de erro da API ou da Internet
            console.error("Falha no login:", error);
            errorMsg.textContent = error.message;
            errorAlert.classList.remove('hidden');
        } finally {
            // Devolve o botão ao estado original
            btn.disabled = false;
            btn.innerHTML = 'Entrar no Sistema';
        }
    });
});
