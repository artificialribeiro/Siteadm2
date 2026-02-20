// --- CONFIGURAÇÕES DA API ---
// 🟢 URL atualizada para o servidor correto
const API_URL = 'https://botique-apis.onrender.com';
const API_KEY = '1526'; 

// --- LÓGICA DE CRIAÇÃO DE USUÁRIO ---
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    const nomeCompleto = document.getElementById('nome_completo').value.trim();
    const loginInput = document.getElementById('login').value.trim();
    const senhaInput = document.getElementById('senha').value.trim();
    const grupoAcessoId = parseInt(document.getElementById('grupo_acesso_id').value, 10);
    const filialIdRaw = document.getElementById('filial_id').value;
    const filialId = filialIdRaw ? parseInt(filialIdRaw, 10) : null; 

    const btn = document.getElementById('submit-btn');
    const errorAlert = document.getElementById('error-alert');
    const errorMsg = document.getElementById('error-message');
    const successAlert = document.getElementById('success-alert');
    const successMsg = document.getElementById('success-message');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Criando usuário...';
    errorAlert.classList.add('hidden');
    successAlert.classList.add('hidden');

    try {
        // PASSO 1: Gerar o token de acesso
        const tokenResponse = await fetch(`${API_URL}/api/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            }
        });
        
        const tokenData = await tokenResponse.json();
        
        if (!tokenResponse.ok || !tokenData.success) {
            throw new Error('Falha de Segurança: A chave da API (API_KEY) foi recusada.');
        }
        
        const apiToken = tokenData.data.token;

        // PASSO 2: Criar o usuário na API
        const payload = {
            nome_completo: nomeCompleto,
            login: loginInput,
            senha: senhaInput,
            grupo_acesso_id: grupoAcessoId
        };

        if (filialId !== null) {
            payload.filial_id = filialId;
        }

        const createResponse = await fetch(`${API_URL}/api/usuarios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
                // 🟢 CORREÇÃO CRÍTICA DE SEGURANÇA: Usando o padrão Authorization: Bearer
                'Authorization': `Bearer ${apiToken}` 
            },
            body: JSON.stringify(payload)
        });

        const createData = await createResponse.json();

        if (!createResponse.ok || !createData.success) {
            // Verifica se é erro 401 Unauthorized explícito
            if (createData.error && createData.error.code === 'UNAUTHORIZED') {
                throw new Error('Acesso Negado (401). O Token gerado não tem permissão para criar usuários.');
            }
            throw new Error(createData.message || 'Falha ao criar o usuário. Tente novamente.');
        }

        // PASSO 3: Sucesso!
        successMsg.innerHTML = '<strong>Sucesso!</strong> Administrador criado. Redirecionando para o login...';
        successAlert.classList.remove('hidden');
        document.getElementById('register-form').reset();

        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);

    } catch (error) {
        // PASSO 4: Tratar Erros
        errorMsg.textContent = error.message;
        errorAlert.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Registrar Administrador';
    }
});
url da api https://botique-apis.onrender.com
