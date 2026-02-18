// --- VERIFICAÇÃO DE SESSÃO IMEDIATA ---
// Se não houver token salvo, expulsa o usuário de volta para o login
const apiToken = sessionStorage.getItem('api_token');
const usuarioStr = sessionStorage.getItem('usuario');

if (!apiToken || !usuarioStr) {
    window.location.href = 'login.html';
}

const usuario = JSON.parse(usuarioStr);

// Exibe o nome do usuário na tela
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('user-greeting').textContent = `Acesso: ${usuario.nome_completo}`;
    iniciarVarredura();
});

// --- LÓGICA DE DETECÇÃO DE DISPOSITIVO ---
function detectarDispositivo() {
    const ua = navigator.userAgent.toLowerCase();
    let dispositivo = "Dispositivo Desconhecido";

    // Lógica básica para detectar Apple, Windows, Positivo (Android/Linux), Tablets
    if (ua.includes('macintosh') || ua.includes('mac os')) {
        dispositivo = "Apple Mac (macOS)";
    } else if (ua.includes('ipad')) {
        dispositivo = "Apple iPad";
    } else if (ua.includes('iphone')) {
        dispositivo = "Apple iPhone";
    } else if (ua.includes('windows')) {
        dispositivo = "Computador Windows";
    } else if (ua.includes('android')) {
        // Muitas marcas como Positivo usam Android em tablets e celulares
        if (ua.includes('tablet') || (!ua.includes('mobile') && ua.includes('android'))) {
            dispositivo = "Tablet Android (Positivo/Outros)";
        } else {
            dispositivo = "Smartphone Android";
        }
    } else if (ua.includes('linux')) {
        dispositivo = "Sistema Linux";
    }

    return dispositivo;
}

// --- LÓGICA VISUAL DA VARREDURA ---
function atualizarPasso(idPasso, concluido = false, ativo = false) {
    const passo = document.getElementById(idPasso);
    const icone = passo.querySelector('i');
    
    if (concluido) {
        passo.className = "flex items-center text-white font-medium";
        icone.className = "fas fa-check-circle w-6 text-center mr-3 text-white";
    } else if (ativo) {
        passo.className = "flex items-center text-gray-300 processing";
        icone.className = "fas fa-circle-notch fa-spin w-6 text-center mr-3 text-gray-300";
    } else {
        passo.className = "flex items-center text-gray-700";
        icone.className = "fas fa-minus w-6 text-center mr-3";
    }
}

function iniciarVarredura() {
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('status-text');
    const deviceNameSpan = document.getElementById('device-name');
    const deviceInfoDiv = document.getElementById('device-info');

    // Passo 1: Hardware (0 a 25%)
    setTimeout(() => {
        progressBar.style.width = '25%';
        statusText.textContent = "Analisando hardware...";
        
        // Mostra o dispositivo detectado
        deviceNameSpan.textContent = detectarDispositivo();
        deviceInfoDiv.classList.remove('hidden');
        
        setTimeout(() => {
            atualizarPasso('step-1', true);
            atualizarPasso('step-2', false, true);
        }, 1000);
    }, 500);

    // Passo 2: Navegador/Criptografia (25% a 50%)
    setTimeout(() => {
        progressBar.style.width = '50%';
        statusText.textContent = "Avaliando certificados...";
        
        atualizarPasso('step-2', true);
        atualizarPasso('step-3', false, true);
    }, 3000);

    // Passo 3: Token do Funcionário (50% a 75%)
    setTimeout(() => {
        progressBar.style.width = '75%';
        statusText.textContent = "Confirmando credenciais no servidor...";
        
        atualizarPasso('step-3', true);
        atualizarPasso('step-4', false, true);
    }, 4500);

    // Passo 4: Túnel Seguro e Finalização (75% a 100%)
    setTimeout(() => {
        progressBar.style.width = '100%';
        statusText.textContent = "Acesso autorizado.";
        
        atualizarPasso('step-4', true);
        
        // Muda o ícone principal para indicar sucesso
        const shieldIcon = document.querySelector('.fa-shield-alt');
        shieldIcon.classList.remove('fa-shield-alt', 'text-gray-300');
        shieldIcon.classList.add('fa-check-shield', 'text-white');
        
        // Redireciona para a página de Boas-vindas
        setTimeout(() => {
            // OBS: Corrigi o nome para 'boasvindas.html' (com 'n') para manter o português correto.
            window.location.href = 'boasvindas.html'; 
        }, 1500);

    }, 6500);
}


