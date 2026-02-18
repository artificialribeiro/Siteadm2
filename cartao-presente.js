document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. SEGURANÇA & SESSÃO (Operador) ---
    const userDataStr = sessionStorage.getItem('usuario');
    const apiToken = sessionStorage.getItem('api_token');

    if (!userDataStr || !apiToken) {
        window.location.href = 'index.html'; 
        return;
    }

    const usuario = JSON.parse(userDataStr);
    
    // Configura interface para o Vendedor
    const primeiroNome = usuario.nome_completo.split(' ')[0];
    document.getElementById('header-user').textContent = primeiroNome.toUpperCase();
    document.getElementById('print-vendedor').textContent = primeiroNome.toUpperCase();
    document.getElementById('header-filial').textContent = `FILIAL ID: ${usuario.filial_id || 'MTZ'}`;

    // --- CONFIGURAÇÕES ---
    // URL do seu Worker Cloudflare
    const PIX_API_URL = "https://holy-voice-c21b.artificialribeiro.workers.dev";
    
    let state = {
        valor: 0,
        cliente: null,
        metodoPagamento: null,
        pollingInterval: null
    };

    // --- ELEMENTOS UI ---
    const inputValor = document.getElementById('input-valor');
    const displayValor = document.querySelectorAll('#display-valor'); // Múltiplos displays (tela e recibo)
    const displayValidade = document.getElementById('display-validade');
    const btnCheckout = document.getElementById('btn-checkout');
    
    // Validade Padrão: 1 Ano a partir de hoje
    const validadeDate = new Date();
    validadeDate.setFullYear(validadeDate.getFullYear() + 1);
    displayValidade.textContent = validadeDate.toLocaleDateString('pt-BR');

    // --- LÓGICA DE VALOR ---
    inputValor.addEventListener('input', (e) => atualizarValor(parseFloat(e.target.value)));

    document.querySelectorAll('.btn-valor').forEach(btn => {
        btn.addEventListener('click', () => {
            inputValor.value = btn.dataset.valor;
            atualizarValor(parseFloat(btn.dataset.valor));
        });
    });

    function atualizarValor(val) {
        state.valor = val && val > 0 ? val : 0;
        
        displayValor.forEach(el => {
            el.textContent = state.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        });

        // Habilita checkout se valor >= 10
        if (state.valor >= 10) {
            btnCheckout.disabled = false;
            btnCheckout.classList.remove('opacity-50');
        } else {
            btnCheckout.disabled = true;
            btnCheckout.classList.add('opacity-50');
        }
    }

    // --- LÓGICA DE CLIENTE (OPCIONAL) ---
    const formCliente = document.getElementById('form-cliente');
    
    formCliente.addEventListener('submit', (e) => {
        e.preventDefault();
        state.cliente = {
            cpf: document.getElementById('cli-cpf').value,
            nome: document.getElementById('cli-nome').value
        };
        
        // Atualiza a tela do vendedor
        document.getElementById('area-sem-cliente').classList.add('hidden');
        document.getElementById('area-com-cliente').classList.remove('hidden');
        document.getElementById('area-com-cliente').classList.add('flex');
        
        document.getElementById('display-nome-cliente').textContent = state.cliente.nome;
        document.getElementById('display-cpf-cliente').textContent = state.cliente.cpf;
        
        // Atualiza o topo (feedback visual rápido)
        document.getElementById('box-cliente-topo').classList.remove('hidden');
        document.getElementById('box-cliente-topo').classList.add('flex');
        document.getElementById('topo-nome-cliente').textContent = state.cliente.nome.split(' ')[0];

        // Fecha Modal
        document.getElementById('modal-cliente').classList.remove('flex');
        document.getElementById('modal-cliente').classList.add('hidden');
        mostrarToast("Cliente vinculado");
    });

    document.getElementById('btn-remover-cliente-topo').onclick = limparCliente;

    function limparCliente() {
        state.cliente = null;
        document.getElementById('area-sem-cliente').classList.remove('hidden');
        document.getElementById('area-com-cliente').classList.add('hidden');
        document.getElementById('area-com-cliente').classList.remove('flex');
        
        document.getElementById('box-cliente-topo').classList.add('hidden');
        document.getElementById('box-cliente-topo').classList.remove('flex');
        mostrarToast("Cliente removido");
    }

    // --- CHECKOUT ---
    btnCheckout.onclick = () => {
        document.getElementById('modal-pagamento').classList.remove('hidden');
        document.getElementById('modal-pagamento').classList.add('flex');
    };

    document.querySelectorAll('.btn-pay-method').forEach(btn => {
        btn.onclick = () => {
            const method = btn.dataset.method;
            state.metodoPagamento = method;
            
            document.getElementById('modal-pagamento').classList.remove('flex');
            document.getElementById('modal-pagamento').classList.add('hidden');

            if (method === 'pix') {
                document.getElementById('modal-pix-tipo').classList.remove('hidden');
                document.getElementById('modal-pix-tipo').classList.add('flex');
            } else {
                // Dinheiro ou Cartão (Maquininha Externa)
                if(confirm(`Confirmar recebimento de ${state.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}?`)) {
                    gerarCartaoBackend();
                }
            }
        };
    });

    // --- LÓGICA PIX ---
    document.getElementById('btn-pix-manual').onclick = () => {
        document.getElementById('modal-pix-tipo').classList.remove('flex');
        document.getElementById('modal-pix-tipo').classList.add('hidden');
        if(confirm("Confirma que validou o comprovante PIX manualmente?")) {
            gerarCartaoBackend();
        }
    };

    document.getElementById('btn-pix-auto').onclick = async () => {
        document.getElementById('modal-pix-tipo').classList.remove('flex');
        document.getElementById('modal-pix-tipo').classList.add('hidden');
        
        const modalQR = document.getElementById('modal-qrcode');
        modalQR.classList.remove('hidden');
        modalQR.classList.add('flex');
        
        document.getElementById('qr-content').classList.remove('flex');
        document.getElementById('qr-content').classList.add('hidden');
        document.getElementById('qr-loading').classList.remove('hidden');
        document.getElementById('qr-valor').textContent = state.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        try {
            // Chamada ao Worker Cloudflare
            const res = await fetch(`${PIX_API_URL}/api/pix/gerar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': '1526' },
                body: JSON.stringify({
                    nome: state.cliente ? state.cliente.nome : "Venda Gift Card",
                    cpfCnpj: state.cliente ? state.cliente.cpf.replace(/\D/g,'') : "00000000000",
                    valor: state.valor,
                    descricao: "Gift Card Boutique Diniz"
                })
            });
            const d = await res.json();

            if (d.success) {
                let imgBase64 = d.data.imagem_base64;
                if (!imgBase64.startsWith('data:')) imgBase64 = 'data:image/png;base64,' + imgBase64;
                
                document.getElementById('qr-image').src = imgBase64;
                document.getElementById('qr-code-text').value = d.data.pix_copia_e_cola;
                
                document.getElementById('qr-loading').classList.add('hidden');
                document.getElementById('qr-content').classList.remove('hidden');
                document.getElementById('qr-content').classList.add('flex');

                iniciarPolling(d.data.payment_id);
            } else {
                alert("Erro ao gerar PIX: " + d.message);
                cancelarPix();
            }

        } catch (e) {
            console.error(e);
            alert("Erro de conexão com o banco.");
            cancelarPix();
        }
    };

    document.getElementById('btn-copy').onclick = () => {
        document.getElementById('qr-code-text').select();
        document.execCommand('copy');
        mostrarToast("Código copiado!");
    };

    document.getElementById('btn-cancel-qr').onclick = cancelarPix;

    function cancelarPix() {
        if (state.pollingInterval) clearInterval(state.pollingInterval);
        document.getElementById('modal-qrcode').classList.remove('flex');
        document.getElementById('modal-qrcode').classList.add('hidden');
    }

    function iniciarPolling(id) {
        if (state.pollingInterval) clearInterval(state.pollingInterval);
        state.pollingInterval = setInterval(async () => {
            try {
                const res = await fetch(`${PIX_API_URL}/api/pix/status/${id}`, { headers: { 'x-api-key': '1526' }});
                const d = await res.json();
                if (d.success && d.data.pago) {
                    clearInterval(state.pollingInterval);
                    mostrarToast("Pagamento Confirmado!");
                    document.getElementById('modal-qrcode').classList.remove('flex');
                    document.getElementById('modal-qrcode').classList.add('hidden');
                    gerarCartaoBackend();
                }
            } catch (e) {}
        }, 4000);
    }

    // --- EMISSÃO DO CARTÃO (API LOJA) ---
    async function gerarCartaoBackend() {
        mostrarToast("Emitindo cartão...");

        const payload = {
            valor: state.valor,
            validade: validadeDate.toISOString().split('T')[0],
            // Se tiver cliente, associa. Se não, é venda avulsa.
            cliente_id: state.cliente ? 1 : null 
        };

        try {
            const headers = await window.authManager.getAuthHeaders();
            const res = await fetch(`${window.authManager.apiUrl}/api/cartoes`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });
            
            let cardData;
            
            if (res.ok) {
                const json = await res.json();
                cardData = json.data;
            } else {
                console.warn("API de criação offline, gerando localmente para impressão.");
                cardData = {
                    numero: generateRandomCardNumber(),
                    codigo_seguranca: Math.floor(1000 + Math.random() * 9000).toString(),
                    saldo: state.valor,
                    validade: payload.validade,
                    id: Math.floor(Math.random() * 1000)
                };
            }
            
            exibirSucessoImpressao(cardData);

        } catch (e) {
            // Fallback
            const cardData = {
                numero: generateRandomCardNumber(),
                codigo_seguranca: Math.floor(1000 + Math.random() * 9000).toString(),
                saldo: state.valor,
                validade: payload.validade,
                id: "OFFLINE"
            };
            exibirSucessoImpressao(cardData);
        }
    }

    function exibirSucessoImpressao(card) {
        const modal = document.getElementById('modal-sucesso');
        
        // Formata Número (4 em 4 dígitos)
        const numFormatado = card.numero.replace(/(.{4})/g, '$1 ').trim();
        
        document.getElementById('print-code').textContent = numFormatado;
        document.getElementById('print-pin').textContent = card.codigo_seguranca;
        document.getElementById('print-valor').textContent = parseFloat(card.saldo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        const dateParts = card.validade.split('-'); // YYYY-MM-DD
        document.getElementById('print-validade').textContent = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        
        document.getElementById('print-data').textContent = new Date().toLocaleDateString('pt-BR');
        document.getElementById('print-cliente').textContent = state.cliente ? state.cliente.nome.toUpperCase() : "PORTADOR";

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    // --- UTILS ---
    function generateRandomCardNumber() {
        let num = "";
        for(let i=0; i<16; i++) num += Math.floor(Math.random() * 10);
        return num;
    }

    function mostrarToast(msg) {
        const t = document.getElementById('toast');
        document.getElementById('toast-msg').textContent = msg;
        t.classList.remove('translate-y-20', 'opacity-0');
        setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 3000);
    }

});


