document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. PREENCHER DADOS DO USUÁRIO NO TOPO ---
    const usuarioStr = sessionStorage.getItem('usuario');
    
    if (usuarioStr) {
        const usuario = JSON.parse(usuarioStr);
        const primeiroNome = usuario.nome_completo.split(' ')[0];
        const inicial = primeiroNome.charAt(0).toUpperCase();

        document.getElementById('topbar-user-name').textContent = primeiroNome;
        document.getElementById('topbar-user-initial').textContent = inicial;
        
        const roleDisplay = document.getElementById('topbar-user-role');
        if (usuario.grupo_acesso_id === 1) {
            roleDisplay.textContent = "Administrador";
            roleDisplay.classList.add('text-gray-300');
        } else {
            roleDisplay.textContent = "Equipe Vendas";
        }
    }

    // --- 2. ANIMAÇÃO DOS NÚMEROS DO PAINEL ---
    const numbersToAnimate = document.querySelectorAll('.animate-number');
    
    setTimeout(() => {
        numbersToAnimate.forEach(el => {
            const target = parseFloat(el.getAttribute('data-target'));
            const isCurrency = el.getAttribute('data-is-currency') !== 'false';
            const duration = 1500;
            const frameRate = 30; 
            const totalFrames = Math.round((duration / 1000) * frameRate);
            let frame = 0;

            const counter = setInterval(() => {
                frame++;
                const progress = frame / totalFrames;
                const currentVal = target * (1 - Math.pow(1 - progress, 3)); 

                if (isCurrency) {
                    el.textContent = currentVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                } else {
                    el.textContent = Math.floor(currentVal).toString();
                }

                if (frame >= totalFrames) {
                    clearInterval(counter);
                    if (isCurrency) {
                        el.textContent = target.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    } else {
                        el.textContent = target;
                    }
                }
            }, 1000 / frameRate);
        });
    }, 600);
});
