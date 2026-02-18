document.addEventListener("DOMContentLoaded", () => {
    
    // --- ELEMENTOS GLOBAIS ---
    const tabelaMovimentos = document.getElementById('tabela-movimentos');
    const filtroTipo = document.getElementById('filtro-tipo');
    
    let currentPage = 1;
    let totalPages = 1;

    // BLINDAGEM DE TELA
    window.addEventListener("error", function(e) {
        if (tabelaMovimentos) {
            tabelaMovimentos.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500 font-bold bg-red-900/20">Erro interno: ${e.message}</td></tr>`;
        }
    });

    window.addEventListener("unhandledrejection", function(e) {
        if (tabelaMovimentos && tabelaMovimentos.innerHTML.includes('Aguardando')) {
            tabelaMovimentos.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500 font-bold bg-red-900/20">Falha de conexão com a API.</td></tr>`;
        }
    });

    // ==========================================
    // FETCH SEGURO E AUTENTICAÇÃO
    // ==========================================
    async function fetchSeguro(url, options = {}) {
        const timeout = 15000;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw new Error(error.name === 'AbortError' ? "Timeout de servidor." : "Erro de rede.");
        }
    }

    async function garantirAuthManager() {
        let tentativas = 0;
        while (typeof window.authManager === 'undefined' && tentativas < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
            tentativas++;
        }
        if (typeof window.authManager === 'undefined') throw new Error("Segurança não carregada.");
    }

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================
    async function init() {
        try {
            await garantirAuthManager();
            
            const uStr = sessionStorage.getItem('usuario');
            if(uStr) {
                const u = JSON.parse(uStr);
                if(document.getElementById('topbar-user-name')) document.getElementById('topbar-user-name').textContent = u.nome_completo.split(' ')[0];
                if(document.getElementById('topbar-user-initial')) document.getElementById('topbar-user-initial').textContent = u.nome_completo.charAt(0).toUpperCase();
            }

            carregarResumo();
            carregarAlertas();
            carregarMovimentos();
            preencherSelectProdutos(); // Prepara o formulário invisível

        } catch (error) {
            console.error(error);
        }
    }

    // ==========================================
    // DASHBOARD: RESUMO GERAL
    // ==========================================
    async function carregarResumo() {
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetchSeguro(`${window.authManager.apiUrl}/api/estoque/resumo`, { headers: h });
            const d = await res.json();
            
            if (d.success && d.data) {
                document.getElementById('resumo-total-itens').textContent = d.data.total_itens_estoque || 0;
                document.getElementById('resumo-alertas').textContent = d.data.alertas_estoque_baixo || 0;
                
                // Se houver um bloco de movimentos do dia
                if (d.data.movimentos_hoje) {
                    document.getElementById('resumo-entradas').textContent = d.data.movimentos_hoje.entradas || 0;
                    document.getElementById('resumo-saidas').textContent = d.data.movimentos_hoje.saidas || 0;
                }
            }
        } catch (e) { console.warn("Aviso: Resumo falhou.", e); }
    }

    // ==========================================
    // DASHBOARD: ALERTAS DE BAIXA
    // ==========================================
    async function carregarAlertas() {
        const boxAlertas = document.getElementById('box-alertas');
        const tabelaAlertas = document.getElementById('tabela-alertas');
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetchSeguro(`${window.authManager.apiUrl}/api/estoque/alertas`, { headers: h });
            const d = await res.json();
            
            if (d.success && d.data && d.data.length > 0) {
                boxAlertas.classList.remove('hidden');
                tabelaAlertas.innerHTML = '';
                
                d.data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="py-3 font-medium text-white">${item.produto_nome} <span class="text-gray-500 text-[10px] ml-2">(${item.tamanho} - ${item.cor})</span></td>
                        <td class="py-3 font-mono tracking-widest text-[10px] text-gray-500">${item.sku || 'N/A'}</td>
                        <td class="py-3 text-center text-red-500 font-bold text-base">${item.estoque}</td>
                        <td class="py-3 text-center text-gray-500">${item.estoque_minimo}</td>
                    `;
                    tabelaAlertas.appendChild(tr);
                });
            } else {
                boxAlertas.classList.add('hidden');
            }
        } catch (e) { boxAlertas.classList.add('hidden'); }
    }

    // ==========================================
    // HISTÓRICO: LISTAR MOVIMENTOS
    // ==========================================
    async function carregarMovimentos() {
        const tipo = filtroTipo.value;
        tabelaMovimentos.innerHTML = '<tr><td colspan="5" class="p-12 text-center text-brand-gold animate-pulse uppercase tracking-[0.3em] text-[10px]">Atualizando Histórico...</td></tr>';
        
        try {
            const h = await window.authManager.getAuthHeaders();
            let url = `${window.authManager.apiUrl}/api/estoque/movimentos?page=${currentPage}&pageSize=15`;
            if (tipo) url += `&tipo=${tipo}`;

            const res = await fetchSeguro(url, { headers: h });
            const d = await res.json();

            if (d.success) {
                const lista = Array.isArray(d.data) ? d.data : [];
                renderizarMovimentos(lista);
                
                const meta = d.meta || {};
                totalPages = Math.ceil((meta.total || 0) / (meta.page_size || 15));
                document.getElementById('info-paginacao').textContent = `Página ${currentPage} de ${totalPages || 1}`;
                document.getElementById('btn-prev').disabled = currentPage === 1;
                document.getElementById('btn-next').disabled = currentPage >= totalPages;
            } else {
                tabelaMovimentos.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500 bg-red-900/10">Sem movimentos ou erro de API.</td></tr>`;
            }
        } catch (e) { 
            tabelaMovimentos.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500 bg-red-900/10">Falha ao buscar histórico.</td></tr>`;
        }
    }

    function renderizarMovimentos(lista) {
        if (lista.length === 0) {
            tabelaMovimentos.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-500">Nenhum movimento registrado.</td></tr>';
            return;
        }
        tabelaMovimentos.innerHTML = '';
        
        lista.forEach(m => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-900/30 transition-colors";
            
            // Formatador de Data Seguro
            let dataFormatada = m.criado_em;
            try {
                if(m.criado_em) {
                    const dt = new Date(m.criado_em);
                    dataFormatada = dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                }
            } catch(e){}

            // Cores e Ícones Dinâmicos por Tipo
            let badgeTipo = '';
            let sinal = '';
            if (m.tipo === 'entrada') {
                badgeTipo = '<span class="px-2 py-0.5 rounded border border-green-900 text-green-400 bg-green-950/30 text-[9px] uppercase">Entrada</span>';
                sinal = '<span class="text-green-500 font-bold">+</span>';
            } else if (m.tipo === 'saida') {
                badgeTipo = '<span class="px-2 py-0.5 rounded border border-red-900 text-red-400 bg-red-950/30 text-[9px] uppercase">Saída</span>';
                sinal = '<span class="text-red-500 font-bold">-</span>';
            } else {
                badgeTipo = '<span class="px-2 py-0.5 rounded border border-blue-900 text-blue-400 bg-blue-950/30 text-[9px] uppercase">Ajuste</span>';
                sinal = '<span class="text-blue-500 font-bold">=</span>';
            }

            tr.innerHTML = `
                <td class="p-4 pl-6 text-xs text-gray-400 whitespace-nowrap">${dataFormatada}</td>
                <td class="p-4">
                    <div class="font-medium text-white text-sm">${m.produto_nome || 'Produto Desconhecido'}</div>
                    <div class="text-[10px] text-gray-500 uppercase mt-1">Tam: ${m.tamanho || '?'} | Cor: ${m.cor || '?'}</div>
                </td>
                <td class="p-4 text-center">${badgeTipo}</td>
                <td class="p-4 text-center font-mono text-base text-gray-300">${sinal} ${m.quantidade}</td>
                <td class="p-4 text-xs text-gray-500 max-w-xs truncate" title="${m.motivo || ''}">${m.motivo || '--'}</td>
            `;
            tabelaMovimentos.appendChild(tr);
        });
    }

    // ==========================================
    // MODAL DE LANÇAMENTO (LÓGICA ENCADEADA)
    // ==========================================
    const selectProduto = document.getElementById('m-produto');
    const selectVariante = document.getElementById('m-variante');

    // 1. Carrega todos os produtos para o Select Primário
    async function preencherSelectProdutos() {
        try {
            const h = await window.authManager.getAuthHeaders();
            // Puxa um pageSize alto para listar tudo no combobox
            const res = await fetchSeguro(`${window.authManager.apiUrl}/api/produtos?pageSize=100`, { headers: h });
            const d = await res.json();
            
            if (d.success) {
                const prods = Array.isArray(d.data) ? d.data : (d.data && d.data.itens ? d.data.itens : []);
                let html = '<option value="" disabled selected>Selecione um Produto...</option>';
                prods.forEach(p => {
                    html += `<option value="${p.id}">${p.sku ? '['+p.sku+'] ' : ''}${p.nome}</option>`;
                });
                selectProduto.innerHTML = html;
            }
        } catch (e) { console.error("Erro ao carregar lista de produtos form", e); }
    }

    // 2. Quando escolhe o Produto, busca e carrega as Variantes dele
    selectProduto.addEventListener('change', async (e) => {
        const idProd = e.target.value;
        selectVariante.innerHTML = '<option value="" disabled selected>Buscando estoque...</option>';
        selectVariante.disabled = true;

        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetchSeguro(`${window.authManager.apiUrl}/api/produtos/${idProd}`, { headers: h });
            const d = await res.json();

            if (d.success && d.data && d.data.variantes) {
                let vars = d.data.variantes;
                if (vars.length === 0) {
                    selectVariante.innerHTML = '<option value="" disabled selected>Nenhuma variante cadastrada neste produto</option>';
                    return;
                }
                
                let html = '<option value="" disabled selected>Escolha o Tamanho e Cor</option>';
                vars.forEach(v => {
                    html += `<option value="${v.id}">${v.tamanho} / ${v.cor} (Estoque atual: ${v.estoque})</option>`;
                });
                selectVariante.innerHTML = html;
                selectVariante.disabled = false;
            }
        } catch (err) {
            selectVariante.innerHTML = '<option value="" disabled selected>Erro ao carregar variantes</option>';
        }
    });

    // 3. Salvar Movimento (POST)
    const formMovimento = document.getElementById('form-movimento');
    formMovimento.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const varId = selectVariante.value;
        if (!varId) return mostrarToast("Você deve selecionar uma variante válida.", "erro");

        const btn = document.getElementById('btn-salvar-m');
        const iconOriginal = document.getElementById('icon-salvar-m').textContent;
        btn.disabled = true;
        document.getElementById('icon-salvar-m').textContent = 'autorenew';
        document.getElementById('icon-salvar-m').classList.add('animate-spin');

        const payload = {
            produto_variante_id: parseInt(varId),
            tipo: document.getElementById('m-tipo').value,
            quantidade: parseInt(document.getElementById('m-qtd').value),
            motivo: document.getElementById('m-motivo').value.trim() || null
        };

        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetchSeguro(`${window.authManager.apiUrl}/api/estoque/movimentos`, {
                method: 'POST',
                headers: h,
                body: JSON.stringify(payload)
            });
            const d = await res.json();

            if (d.success) {
                mostrarToast("Movimento registrado com sucesso!");
                fecharModal(document.getElementById('modal-movimento'));
                formMovimento.reset();
                selectVariante.disabled = true;
                
                // Recarrega todo o Dashboard
                carregarResumo();
                carregarAlertas();
                carregarMovimentos();
            } else {
                mostrarToast(d.message || "Erro de Validação.", 'erro', d);
            }
        } catch (e) {
            mostrarToast("Falha de comunicação com o servidor.", "erro");
        } finally {
            btn.disabled = false;
            document.getElementById('icon-salvar-m').textContent = iconOriginal;
            document.getElementById('icon-salvar-m').classList.remove('animate-spin');
        }
    });

    // ==========================================
    // CONTROLES DE INTERFACE
    // ==========================================
    filtroTipo.addEventListener('change', () => { currentPage = 1; carregarMovimentos(); });
    
    document.getElementById('btn-prev').addEventListener('click', () => { if(currentPage > 1) { currentPage--; carregarMovimentos(); } });
    document.getElementById('btn-next').addEventListener('click', () => { if(currentPage < totalPages) { currentPage++; carregarMovimentos(); } });

    document.getElementById('btn-novo-movimento').addEventListener('click', () => {
        document.getElementById('form-movimento').reset();
        selectVariante.innerHTML = '<option value="" disabled selected>Escolha um produto primeiro</option>';
        selectVariante.disabled = true;
        abrirModal(document.getElementById('modal-movimento'));
    });

    document.getElementById('btn-fechar-modal').addEventListener('click', () => fecharModal(document.getElementById('modal-movimento')));
    document.getElementById('btn-cancelar').addEventListener('click', () => fecharModal(document.getElementById('modal-movimento')));

    function abrirModal(modal) { 
        modal.classList.remove('hidden'); modal.classList.add('flex'); 
        setTimeout(() => modal.classList.remove('opacity-0'), 10); 
    }
    
    function fecharModal(modal) { 
        modal.classList.add('opacity-0'); 
        setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300); 
    }

    function mostrarToast(msg, tipo = 'sucesso', d = null) {
        let txt = msg;
        if (d && d.errors) { try { txt += " | " + Object.values(d.errors).flat().join(', '); } catch(e){} }
        
        const t = document.getElementById('toast');
        if(!t) return;
        document.getElementById('toast-msg').textContent = txt;
        document.getElementById('toast-icon').textContent = tipo === 'erro' ? 'error' : 'check_circle';
        document.getElementById('toast-icon').className = `material-icons ${tipo === 'erro' ? 'text-red-500' : 'text-green-600'}`;
        t.classList.remove('translate-y-20', 'opacity-0');
        setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 4000);
    }

    // BOOT
    init();
});


