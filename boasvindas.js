document.addEventListener("DOMContentLoaded", () => {
    // --- 1. DADOS DO USUÁRIO ---
    const usuarioStr = sessionStorage.getItem('usuario');
    
    if (usuarioStr) {
        const usuario = JSON.parse(usuarioStr);
        
        // Pega apenas o primeiro nome
        const primeiroNome = usuario.nome_completo.split(' ')[0];

        // Preenche os dados na interface
        document.getElementById('user-name-display').textContent = primeiroNome;
        
        // Exibe a role (Grupo de acesso)
        const roleDisplay = document.getElementById('user-role-display');
        if (usuario.grupo_acesso_id === 1) {
            roleDisplay.textContent = "Administrador do Sistema";
            roleDisplay.classList.add("text-white"); 
        } else {
            roleDisplay.textContent = "Equipe de Vendas";
        }

        // Exibe a filial (Se houver)
        const locationDisplay = document.getElementById('current-location');
        if (usuario.filial_id) {
            locationDisplay.textContent = `Filial #${usuario.filial_id}`;
        }
    }

    // --- 2. SISTEMA DE MENSAGENS MOTIVACIONAIS ---
    const mensagens = [
        "A elegância é a única beleza que não desaparece. Um excelente dia de trabalho!",
        "Seu sorriso e atenção são os melhores acessórios que nossa boutique pode oferecer hoje.",
        "Cada cliente é única e especial. Faça com que ela se sinta exatamente assim.",
        "O sucesso do nosso dia começa com o seu talento, dedicação e bom gosto.",
        "Vender luxo é construir relacionamentos e realizar desejos. Boas vendas!",
        "A moda passa, o estilo permanece. Ajude nossas clientes a encontrarem o delas hoje.",
        "Detalhes fazem a perfeição, e a perfeição não é um detalhe. Ótimo turno para você!",
        "Transforme o atendimento de hoje em uma experiência inesquecível para nossa cliente.",
        "Sua energia dita o ritmo da loja. Que hoje seja um dia incrivelmente produtivo!"
    ];

    // Sorteia uma mensagem aleatória
    const mensagemSorteada = mensagens[Math.floor(Math.random() * mensagens.length)];
    document.getElementById('motivational-message').textContent = mensagemSorteada;

    // --- 3. DATA ATUAL ---
    function atualizarData() {
        const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        let dataFormatada = new Date().toLocaleDateString('pt-BR', opcoes);
        
        // Capitaliza a primeira letra para ficar elegante
        dataFormatada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
        
        document.getElementById('current-date').textContent = dataFormatada;
    }
    atualizarData();

    // --- 4. AÇÕES DOS BOTÕES ---
    document.getElementById('btn-acessar-painel').addEventListener('click', () => {
        // Direciona para o painel principal (Onde fica o sistema real)
        window.location.href = 'dashboard.html'; 
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        // Usa a função do módulo de segurança para limpar a sessão e sair
        if(typeof Seguranca !== 'undefined') {
            sessionStorage.clear();
            window.location.replace('login.html');
        } else {
            sessionStorage.clear();
            window.location.href = 'login.html';
        }
    });
});
