document.addEventListener("DOMContentLoaded", () => {
    
    const tabelaProdutos = document.getElementById('tabela-produtos');

    window.addEventListener("error", function(e) {
        if (tabelaProdutos) {
            tabelaProdutos.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500 font-bold bg-red-900/20 uppercase tracking-widest text-[10px]">Falha Crítica no Script: ${e.message}</td></tr>`;
        }
    });

    window.addEventListener("unhandledrejection", function(e) {
        if (tabelaProdutos) {
            tabelaProdutos.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500 font-bold bg-red-900/20 uppercase tracking-widest text-[10px]">A API recusou a requisição ou está offline.</td></tr>`;
        }
    });

    if (!tabelaProdutos) return;

    let currentPage = 1;
    let totalPages = 1;
    let listaProdutos = [];
    let listaFiliais = [];
    let listaCategorias = [];
    let variantesAtuais = [];
    let imagensAtuais = [];
    let idProdutoSendoEditado = null;

    const formProduto = document.getElementById('form-produto');
    const modalProduto = document.getElementById('modal-produto');
    const modalVariante = document.getElementById('modal-v');
    const selectFilial = document.getElementById('p-filial');
    const selectCategoria = document.getElementById('p-categoria');
    
    const modalCategoria = document.getElementById('modal-categoria');
    const formCategoria = document.getElementById('form-categoria');

    const btnTabVariantes = document.getElementById('btn-tab-variantes');
    const btnTabImagens = document.getElementById('btn-tab-imagens');
    const inputUpload = document.getElementById('input-imagens');
    const galeriaImagens = document.getElementById('galeria-imagens');

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
            throw error;
        }
    }

    // 🟢 FUNÇÃO DE IMAGEM ATUALIZADA: FOCA PRIMEIRO NO BASE64 RETORNADO PELA API
    function getImagemUrl(imgObj) {
        if (!imgObj) return '';
        
        // Se a API mandou o Base64 nativo, a gente usa ele! É instantâneo e não tem erro de CORS.
        if (imgObj.base64 && imgObj.base64.trim() !== '') {
            // Se já vier com data:image, ótimo. Se não, a gente monta
            if (imgObj.base64.startsWith('data:image')) {
                return imgObj.base64;
            } else {
                const mime = imgObj.mime || 'image/png';
                return `data:${mime};base64,${imgObj.base64}`;
            }
        }

        // Se por algum motivo não vier base64 (produto antigo), a gente tenta montar a URL
        let caminhoBruto = imgObj.caminho || '';
        if (!caminhoBruto) return '';
        if (caminhoBruto.startsWith('http')) return caminhoBruto;
        
        const urlManus = "https://1535-i6bit6szq65xk8rh0ay2a-921031c2.us2.manus.computer";
        let path = String(caminhoBruto).replace(/\\/g, '/');

        if (path.includes('/uploads/')) {
            path = '/uploads/' + path.split('/uploads/')[1];
        } else if (!path.startsWith('/')) {
            path = '/' + path;
        }
        return urlManus + path;
    }

    async function garantirAuthManager() {
        let tentativas = 0;
        while (typeof window.authManager === 'undefined' && tentativas < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
            tentativas++;
        }
        if (typeof window.authManager === 'undefined') throw new Error("A Segurança falhou ao iniciar.");
    }

    async function init() {
        try {
            tabelaProdutos.innerHTML = '<tr><td colspan="5" class="p-12 text-center text-gray-400 animate-pulse uppercase tracking-widest text-[10px]">Verificando sistema...</td></tr>';
            await garantirAuthManager();
            
            try {
                const usuarioStr = sessionStorage.getItem('usuario');
                if(usuarioStr) {
                    const u = JSON.parse(usuarioStr);
                    if(document.getElementById('topbar-user-name')) document.getElementById('topbar-user-name').textContent = u.nome_completo.split(' ')[0];
                    if(document.getElementById('topbar-user-initial')) document.getElementById('topbar-user-initial').textContent = u.nome_completo.charAt(0).toUpperCase();
                }
            } catch (e) {}

            await Promise.all([
                carregarCategorias(),
                carregarFiliais()
            ]);

            await carregarProdutos();

        } catch (error) {
            tabelaProdutos.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500 font-bold bg-red-900/10 uppercase tracking-widest text-[10px]">Falha de Boot: ${error.message}</td></tr>`;
        }
    }

    async function carregarCategorias(idParaSelecionar = null) {
        if (!selectCategoria) return;
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetchSeguro(`${window.authManager.apiUrl}/api/categorias`, { headers: h });
            const d = await res.json();
            
            if (d.success) {
                listaCategorias = Array.isArray(d.data) ? d.data : (d.data && d.data.itens ? d.data.itens : []);
                
                let html = '<option value="" disabled selected>Selecione a Categoria...</option>';
                listaCategorias.forEach(c => { html += `<option value="${c.id}">${c.nome}</option>`; });
                selectCategoria.innerHTML = html;

                if (idParaSelecionar) selectCategoria.value = idParaSelecionar;
            }
        } catch (e) {}
    }

    if (formCategoria) {
        formCategoria.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-salvar-cat');
            btn.innerHTML = "Salvando..."; btn.disabled = true;

            try {
                const h = await window.authManager.getAuthHeaders();
                const res = await fetchSeguro(`${window.authManager.apiUrl}/api/categorias`, {
                    method: 'POST',
                    headers: h,
                    body: JSON.stringify({ nome: document.getElementById('cat-nome').value.trim(), ativo: 1 })
                });
                const d = await res.json();

                if (d.success) {
                    mostrarToast("Categoria criada com sucesso!");
                    fecharModal(modalCategoria);
                    formCategoria.reset();
                    const novaCatId = d.data ? d.data.id : null;
                    await carregarCategorias(novaCatId); 
                } else {
                    mostrarToast(d.message || "Falha na criação", "erro", d);
                }
            } catch (error) {
                mostrarToast("Erro de comunicação.", "erro");
            } finally {
                btn.innerHTML = "Criar"; btn.disabled = false;
            }
        });
    }

    async function carregarFiliais() {
        if (!selectFilial) return;
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetchSeguro(`${window.authManager.apiUrl}/api/filiais`, { headers: h });
            const d = await res.json();
            if (d.success) {
                listaFiliais = d.data || [];
                let html = '<option value="" disabled selected>Escolha a Filial</option>';
                listaFiliais.forEach(f => { html += `<option value="${f.id}">${f.nome}</option>`; });
                selectFilial.innerHTML = html;
            }
        } catch (e) {}
    }

    async function carregarProdutos() {
        const inputBusca = document.getElementById('input-busca');
        const busca = inputBusca ? inputBusca.value : '';
        
        tabelaProdutos.innerHTML = '<tr><td colspan="5" class="p-12 text-center text-brand-gold animate-pulse uppercase tracking-[0.3em] text-[10px]">Baixando Catálogo...</td></tr>';
        
        try {
            const h = await window.authManager.getAuthHeaders();
            let url = `${window.authManager.apiUrl}/api/produtos?page=${currentPage}&pageSize=15`;
            if (busca) url += `&q=${encodeURIComponent(busca)}`;

            const res = await fetchSeguro(url, { headers: h });
            if (!res.ok) throw new Error(`O Servidor retornou código ${res.status}`);
            
            const d = await res.json();

            if (d.success) {
                listaProdutos = Array.isArray(d.data) ? d.data : (d.data && d.data.itens ? d.data.itens : []);
                renderizarTabelaProdutos(listaProdutos);
                
                const meta = d.meta || {};
                totalPages = Math.ceil((meta.total || 0) / (meta.page_size || 15));
                if(document.getElementById('info-paginacao')) document.getElementById('info-paginacao').textContent = `Página ${currentPage} de ${totalPages || 1}`;
                if(document.getElementById('btn-prev')) document.getElementById('btn-prev').disabled = currentPage === 1;
                if(document.getElementById('btn-next')) document.getElementById('btn-next').disabled = currentPage >= totalPages;
            } else {
                throw new Error(d.message || "API negou o acesso.");
            }
        } catch (e) { 
            tabelaProdutos.innerHTML = `<tr><td colspan="5" class="p-12 text-center text-red-500 font-medium bg-red-900/10 uppercase tracking-widest text-[10px]">Erro de Conexão: ${e.message}</td></tr>`;
        }
    }

    function renderizarTabelaProdutos(produtos) {
        if (!produtos || produtos.length === 0) {
            tabelaProdutos.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-500">Nenhum produto cadastrado no catálogo.</td></tr>';
            return;
        }
        tabelaProdutos.innerHTML = '';
        
        produtos.forEach(p => {
            try {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-900/30 transition-all group";
                
                let imgHtml = '<span class="material-icons text-gray-700">image</span>';
                if (p.imagens && p.imagens.length > 0) {
                    // Passa o objeto imagem inteiro para a nova função que lê o Base64
                    const urlFoto = getImagemUrl(p.imagens[0]);
                    if(urlFoto) {
                        imgHtml = `<img src="${urlFoto}" class="w-full h-full object-cover">`;
                    }
                }

                const precoFloat = p.preco ? parseFloat(p.preco) : 0;
                const precoFormatado = isNaN(precoFloat) ? "0,00" : precoFloat.toLocaleString('pt-BR', {minimumFractionDigits: 2});

                const statusBadge = p.ativo 
                    ? `<span class="px-2 py-0.5 rounded-full text-[9px] uppercase border border-green-900 text-green-500 bg-green-950/20">Ativo</span>` 
                    : `<span class="px-2 py-0.5 rounded-full text-[9px] uppercase border border-red-900 text-red-500 bg-red-950/20">Inativo</span>`;

                tr.innerHTML = `
                    <td class="p-4 pl-6 flex items-center gap-4">
                        <div class="w-12 h-12 bg-gray-900 border border-gray-800 rounded-sm flex items-center justify-center overflow-hidden shrink-0">
                            ${imgHtml}
                        </div>
                        <div>
                            <div class="font-medium text-white truncate max-w-[150px] sm:max-w-xs">${p.nome || 'Produto sem nome'}</div>
                            <div class="text-[9px] text-gray-500 uppercase">${p.filial_nome || 'Geral'}</div>
                        </div>
                    </td>
                    <td class="p-4 text-center text-[10px] text-gray-400 font-mono tracking-widest">${p.sku || 'N/A'}</td>
                    <td class="p-4 font-medium text-brand-gold whitespace-nowrap">R$ ${precoFormatado}</td>
                    <td class="p-4">${statusBadge}</td>
                    <td class="p-4 text-right pr-6 space-x-2 whitespace-nowrap">
                        <button class="btn-edit-p text-gray-500 hover:text-white transition-colors" data-id="${p.id}"><span class="material-icons text-sm">edit</span></button>
                        <button class="btn-status-p text-gray-500 hover:text-brand-gold transition-colors" data-id="${p.id}" data-ativo="${p.ativo}"><span class="material-icons text-sm">${p.ativo ? 'visibility' : 'visibility_off'}</span></button>
                    </td>
                `;
                tabelaProdutos.appendChild(tr);
            } catch (errLoop) { console.error(errLoop); }
        });

        document.querySelectorAll('.btn-edit-p').forEach(b => b.addEventListener('click', () => abrirEdicaoProduto(b.dataset.id)));
        document.querySelectorAll('.btn-status-p').forEach(b => b.addEventListener('click', () => alternarStatusProduto(b.dataset.id, b.dataset.ativo == '1' || b.dataset.ativo === 'true')));
    }

    if (formProduto) {
        formProduto.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const filialSelecionada = document.getElementById('p-filial').value;
            const categoriaSelecionada = document.getElementById('p-categoria').value;
            
            if (!filialSelecionada) return mostrarToast("Selecione uma Filial proprietária!", "erro");
            if (!categoriaSelecionada) return mostrarToast("Selecione uma Categoria!", "erro");

            const id = document.getElementById('produto-id').value;
            const btnSalvar = document.getElementById('btn-salvar-produto');
            const iconOriginal = document.getElementById('icon-salvar-p').textContent;
            
            btnSalvar.disabled = true;
            document.getElementById('icon-salvar-p').textContent = 'autorenew';
            document.getElementById('icon-salvar-p').classList.add('animate-spin');
            
            const campoParcelavel = document.getElementById('p-parcelavel').checked;
            const payload = {
                nome: document.getElementById('p-nome').value.trim(),
                sku: document.getElementById('p-sku').value.trim() || null,
                descricao: document.getElementById('p-descricao').value.trim() || null,
                categoria_id: parseInt(categoriaSelecionada),
                filial_id: parseInt(filialSelecionada),
                preco: parseFloat(document.getElementById('p-preco').value.replace(',', '.')) || 0,
                desconto_valor: document.getElementById('p-desc-valor').value ? parseFloat(document.getElementById('p-desc-valor').value.replace(',', '.')) : null,
                desconto_percent: document.getElementById('p-desc-perc').value ? parseFloat(document.getElementById('p-desc-perc').value.replace(',', '.')) : null,
                parcelavel: campoParcelavel ? 1 : 0,
                parcelas_max: campoParcelavel && document.getElementById('p-parcelas-max').value ? parseInt(document.getElementById('p-parcelas-max').value) : null
            };

            try {
                const h = await window.authManager.getAuthHeaders();
                const method = id ? 'PUT' : 'POST';
                const url = id ? `${window.authManager.apiUrl}/api/produtos/${id}` : `${window.authManager.apiUrl}/api/produtos`;

                const res = await fetchSeguro(url, { method, headers: h, body: JSON.stringify(payload) });
                const d = await res.json();

                if (d.success) {
                    mostrarToast(id ? "Produto atualizado com sucesso!" : "Produto salvo! Adicione as fotos agora.");
                    if (!id && document.querySelector('[data-tab="tab-imagens"]')) {
                        abrirEdicaoProduto(d.data.id);
                        document.querySelector('[data-tab="tab-imagens"]').click();
                    } else {
                        fecharModal(modalProduto);
                        carregarProdutos();
                    }
                } else { mostrarToast(d.message || "Erro de Validação da API.", 'erro', d); }
            } catch (e) { mostrarToast(`Falha: ${e.message}`, 'erro'); } 
            finally {
                btnSalvar.disabled = false;
                document.getElementById('icon-salvar-p').textContent = iconOriginal;
                document.getElementById('icon-salvar-p').classList.remove('animate-spin');
            }
        });
    }

    async function alternarStatusProduto(id, atualAtivo) {
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetchSeguro(`${window.authManager.apiUrl}/api/produtos/${id}/status`, {
                method: 'PATCH', headers: h, body: JSON.stringify({ ativo: !atualAtivo })
            });
            if ((await res.json()).success) { mostrarToast("Status atualizado!"); carregarProdutos(); }
        } catch (e) {}
    }

    async function abrirEdicaoProduto(id) {
        idProdutoSendoEditado = id;
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetchSeguro(`${window.authManager.apiUrl}/api/produtos/${id}`, { headers: h });
            const d = await res.json();
            
            if (d.success && d.data) {
                const p = d.data;
                document.getElementById('modal-titulo').textContent = "Edição: " + (p.nome || '');
                document.getElementById('produto-id').value = p.id;
                document.getElementById('p-nome').value = p.nome || '';
                document.getElementById('p-sku').value = p.sku || "";
                document.getElementById('p-descricao').value = p.descricao || "";
                
                if (document.getElementById('p-categoria')) document.getElementById('p-categoria').value = p.categoria_id || "";
                if (document.getElementById('p-filial')) document.getElementById('p-filial').value = p.filial_id || "";
                
                document.getElementById('p-preco').value = p.preco || '';
                document.getElementById('p-desc-valor').value = p.desconto_valor || "";
                document.getElementById('p-desc-perc').value = p.desconto_percent || "";
                
                if(document.getElementById('p-parcelavel')) document.getElementById('p-parcelavel').checked = p.parcelavel ? true : false;
                if(document.getElementById('p-parcelas-max')) document.getElementById('p-parcelas-max').value = p.parcelas_max || "";
                
                if(document.getElementById('box-parcelas')) {
                    document.getElementById('box-parcelas').classList.toggle('hidden', !p.parcelavel);
                }

                if(btnTabVariantes) btnTabVariantes.classList.remove('hidden');
                if(btnTabImagens) btnTabImagens.classList.remove('hidden');
                
                variantesAtuais = p.variantes || [];
                renderizarVariantes();
                imagensAtuais = p.imagens || [];
                renderizarImagens();
                
                abrirModal(modalProduto);
            }
        } catch (e) { mostrarToast("Erro ao buscar detalhes.", "erro"); }
    }

    // ==========================================
    // UPLOAD DE IMAGENS E GALERIA COM BASE64
    // ==========================================
    function renderizarImagens() {
        if(!galeriaImagens) return;
        galeriaImagens.innerHTML = '';
        if(imagensAtuais.length === 0) {
            galeriaImagens.innerHTML = '<div class="col-span-full text-center text-xs text-gray-600 italic py-4">Nenhuma foto adicionada.</div>';
            return;
        }
        imagensAtuais.forEach(img => {
            const div = document.createElement('div');
            div.className = "relative group aspect-square bg-gray-900 border border-gray-800 rounded-sm overflow-hidden shadow-lg";
            
            // 🟢 LENDO O BASE64 NO MODAL
            const urlFoto = getImagemUrl(img);

            div.innerHTML = `
                <img src="${urlFoto}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button type="button" class="btn-del-img bg-red-600 text-white w-8 h-8 rounded-full shadow-lg flex items-center justify-center hover:bg-red-500 transition-colors" data-id="${img.id}">
                        <span class="material-icons text-sm">delete</span>
                    </button>
                </div>
            `;
            galeriaImagens.appendChild(div);
        });
        document.querySelectorAll('.btn-del-img').forEach(b => b.addEventListener('click', () => excluirImagem(b.dataset.id)));
    }

    if(inputUpload) {
        inputUpload.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            if (!idProdutoSendoEditado) return mostrarToast("Salve o produto primeiro!", "erro");

            mostrarToast("Tratando e enviando imagem...", "sucesso");
            
            const formData = new FormData();
            
            for (let i = 0; i < files.length; i++) {
                let file = files[i];
                let mimeType = file.type;
                let fileName = file.name || `camera_${Date.now()}.jpg`;

                const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
                if (!allowedTypes.includes(mimeType)) mimeType = 'image/jpeg';
                if (!fileName.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/)) fileName = `foto_tratada_${Date.now()}_${i}.jpg`;

                const arquivoBlindado = new File([file], fileName, { type: mimeType });
                
                formData.append('imagens', arquivoBlindado); 
            }

            try {
                const h = await window.authManager.getAuthHeaders();
                const uploadHeaders = {
                    'X-API-KEY': h['X-API-KEY'] || h['x-api-key'],
                    'X-API-TOKEN': h['X-API-TOKEN'] || h['x-api-token']
                };
                
                const res = await fetchSeguro(`${window.authManager.apiUrl}/api/produtos/${idProdutoSendoEditado}/imagens`, {
                    method: 'POST', 
                    headers: uploadHeaders, 
                    body: formData
                });
                
                const d = await res.json();
                if (d.success) {
                    mostrarToast("Imagens recebidas pelo servidor!");
                    inputUpload.value = ''; 
                    abrirEdicaoProduto(idProdutoSendoEditado); 
                } else {
                    mostrarToast(d.message || "A API recusou o arquivo da câmera.", 'erro', d);
                }
            } catch (error) { mostrarToast("Demorou muito para enviar.", 'erro'); }
        });
    }

    async function excluirImagem(imagemId) {
        if (!confirm("Excluir foto permanentemente?")) return;
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetchSeguro(`${window.authManager.apiUrl}/api/produtos/${idProdutoSendoEditado}/imagens/${imagemId}`, { 
                method: 'DELETE', headers: h 
            });
            if ((await res.json()).success) abrirEdicaoProduto(idProdutoSendoEditado); 
        } catch (e) {}
    }

    // ==========================================
    // VARIANTES E ESTOQUE
    // ==========================================
    function renderizarVariantes() {
        const corpo = document.getElementById('tabela-variantes');
        if(!corpo) return;
        if (variantesAtuais.length === 0) {
            corpo.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-600 italic">Nenhum estoque cadastrado.</td></tr>';
            return;
        }
        corpo.innerHTML = '';
        variantesAtuais.forEach(v => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-3 text-white font-medium whitespace-nowrap">${v.tamanho}</td>
                <td class="p-3 text-gray-400 whitespace-nowrap">${v.cor}</td>
                <td class="p-3"><span class="font-mono ${v.estoque <= v.estoque_minimo ? 'text-red-500 font-bold' : 'text-gray-300'}">${v.estoque || 0}</span></td>
                <td class="p-3 text-gray-500">${v.estoque_minimo || 0}</td>
                <td class="p-3 text-right">
                    <button type="button" class="btn-del-v text-gray-600 hover:text-red-500 transition-colors" data-id="${v.id}"><span class="material-icons text-sm">delete_outline</span></button>
                </td>
            `;
            corpo.appendChild(tr);
        });
        document.querySelectorAll('.btn-del-v').forEach(b => b.addEventListener('click', () => excluirVariante(b.dataset.id)));
    }

    const formVariante = document.getElementById('form-variante');
    if (formVariante) {
        formVariante.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                tamanho: document.getElementById('v-tamanho').value,
                cor: document.getElementById('v-cor').value,
                estoque: parseInt(document.getElementById('v-estoque').value || 0),
                estoque_minimo: parseInt(document.getElementById('v-min').value || 0)
            };

            try {
                const h = await window.authManager.getAuthHeaders();
                const res = await fetchSeguro(`${window.authManager.apiUrl}/api/produtos/${idProdutoSendoEditado}/variantes`, {
                    method: 'POST', headers: h, body: JSON.stringify(payload)
                });
                const d = await res.json();
                if (d.success) {
                    mostrarToast("Estoque Registrado!");
                    fecharModal(modalVariante);
                    formVariante.reset();
                    abrirEdicaoProduto(idProdutoSendoEditado);
                } else { mostrarToast(d.message, 'erro', d); }
            } catch (e) { mostrarToast("Erro de conexão.", 'erro'); }
        });
    }

    async function excluirVariante(id) {
        if (!confirm("Remover do estoque permanentemente?")) return;
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetchSeguro(`${window.authManager.apiUrl}/api/variantes/${id}`, { method: 'DELETE', headers: h });
            if ((await res.json()).success) abrirEdicaoProduto(idProdutoSendoEditado); 
        } catch (e) {}
    }

    // ==========================================
    // CONTROLES DE INTERFACE
    // ==========================================
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('tab-active');
            if(document.getElementById(btn.dataset.tab)) document.getElementById(btn.dataset.tab).classList.remove('hidden');
        });
    });

    if(document.getElementById('p-parcelavel')) {
        document.getElementById('p-parcelavel').addEventListener('change', (e) => {
            if(document.getElementById('box-parcelas')) document.getElementById('box-parcelas').classList.toggle('hidden', !e.target.checked);
        });
    }

    function addClick(id, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', callback);
    }

    addClick('btn-novo-produto', () => {
        if(formProduto) formProduto.reset();
        document.getElementById('produto-id').value = "";
        document.getElementById('modal-titulo').textContent = "Cadastrar Produto";
        
        if(btnTabVariantes) btnTabVariantes.classList.add('hidden');
        if(btnTabImagens) btnTabImagens.classList.add('hidden');
        if(document.querySelector('[data-tab="tab-geral"]')) document.querySelector('[data-tab="tab-geral"]').click(); 
        
        abrirModal(modalProduto);
    });

    addClick('btn-nova-categoria', () => abrirModal(modalCategoria));
    addClick('btn-fechar-cat', () => fecharModal(modalCategoria));

    addClick('btn-nova-variante', () => abrirModal(modalVariante));
    addClick('btn-fechar-v', () => fecharModal(modalVariante));
    addClick('btn-fechar-modal', () => { fecharModal(modalProduto); });
    addClick('btn-cancelar', () => { fecharModal(modalProduto); });
    addClick('btn-prev', () => { if(currentPage > 1) { currentPage--; carregarProdutos(); } });
    addClick('btn-next', () => { if(currentPage < totalPages) { currentPage++; carregarProdutos(); } });
    
    let typingTimer;
    const inputBusca = document.getElementById('input-busca');
    if (inputBusca) {
        inputBusca.addEventListener('input', () => {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => { currentPage = 1; carregarProdutos(); }, 600);
        });
    }

    function abrirModal(modal) { 
        if(!modal) return;
        modal.classList.remove('hidden'); 
        modal.classList.add('flex'); 
        setTimeout(() => modal.classList.remove('opacity-0'), 10); 
    }
    
    function fecharModal(modal) { 
        if(!modal) return;
        modal.classList.add('opacity-0'); 
        setTimeout(() => { 
            modal.classList.add('hidden'); 
            modal.classList.remove('flex'); 
        }, 300); 
    }

    function mostrarToast(msg, tipo = 'sucesso', d = null) {
        let txt = msg;
        if (d && d.errors) {
            try { txt += " | " + Object.values(d.errors).flat().join(', '); } catch(e){}
        } else if (d && d.error && d.error.details) {
            try { txt += " | " + JSON.stringify(d.error.details); } catch(e){}
        }
        
        const t = document.getElementById('toast');
        if(!t) return;
        document.getElementById('toast-msg').textContent = txt;
        document.getElementById('toast-icon').textContent = tipo === 'erro' ? 'error' : 'check_circle';
        document.getElementById('toast-icon').className = `material-icons ${tipo === 'erro' ? 'text-red-500' : 'text-green-600'}`;
        t.classList.remove('translate-y-20', 'opacity-0');
        setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 4500);
    }

    init();
});
