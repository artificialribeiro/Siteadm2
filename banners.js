document.addEventListener("DOMContentLoaded", () => {
    
    const gridBanners = document.getElementById('grid-banners');
    const formBanner = document.getElementById('form-banner');
    const modalBanner = document.getElementById('modal-banner');
    const inputArquivo = document.getElementById('banner-arquivo');
    const previewUpload = document.getElementById('preview-upload');
    const imgRender = document.getElementById('img-render');

    let listaBannersGlobal = [];

    // ==========================================
    // 🟢 TRATAMENTO DE URL DE IMAGEM
    // ==========================================
    function getImagemUrl(caminho) {
        if (!caminho) return '';
        if (caminho.startsWith('http')) return caminho;
        const baseUrl = window.authManager ? window.authManager.apiUrl : "";
        // Remove /api do final da URL se existir para acessar o domínio raiz do servidor
        const domain = baseUrl.replace(/\/api\/?$/i, '').replace(/\/+$/, '');
        const path = caminho.startsWith('/') ? caminho : '/' + caminho;
        return domain + path;
    }

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================
    async function garantirAuthManager() {
        let tentativas = 0;
        while (typeof window.authManager === 'undefined' && tentativas < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
            tentativas++;
        }
    }

    async function init() {
        try {
            await garantirAuthManager();
            
            const uStr = sessionStorage.getItem('usuario');
            if(uStr) {
                const u = JSON.parse(uStr);
                document.getElementById('topbar-user-name').textContent = u.nome_completo.split(' ')[0];
                document.getElementById('topbar-user-initial').textContent = u.nome_completo.charAt(0).toUpperCase();
            }

            carregarBanners();
        } catch (error) { console.error(error); }
    }

    // ==========================================
    // LISTAGEM DE BANNERS
    // ==========================================
    async function carregarBanners() {
        gridBanners.innerHTML = '<div class="col-span-full py-20 text-center text-white animate-pulse uppercase tracking-widest text-[10px]">Sincronizando carrossel...</div>';
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetch(`${window.authManager.apiUrl}/api/banners`, { headers: h });
            const d = await res.json();

            if (d.success) {
                listaBannersGlobal = d.data || [];
                renderizarBanners(listaBannersGlobal);
            }
        } catch (e) {
            gridBanners.innerHTML = '<div class="col-span-full py-20 text-center text-red-500 uppercase tracking-widest text-[10px]">Falha na conexão com a API.</div>';
        }
    }

    function renderizarBanners(banners) {
        if (banners.length === 0) {
            gridBanners.innerHTML = '<div class="col-span-full py-20 text-center text-gray-600 uppercase tracking-widest text-[10px]">Nenhum banner cadastrado.</div>';
            return;
        }

        gridBanners.innerHTML = '';
        banners.forEach(b => {
            const card = document.createElement('div');
            card.className = "glass-panel p-4 rounded-sm flex flex-col gap-4 group hover:border-white/20 transition-all";
            
            const statusLabel = b.ativo 
                ? '<span class="bg-white text-black px-2 py-0.5 text-[8px] font-bold uppercase tracking-tighter rounded-full">Ativo</span>'
                : '<span class="bg-red-900 text-white px-2 py-0.5 text-[8px] font-bold uppercase tracking-tighter rounded-full">Oculto</span>';

            card.innerHTML = `
                <div class="relative overflow-hidden">
                    <img src="${getImagemUrl(b.caminho_imagem)}" class="banner-preview">
                    <div class="absolute top-2 left-2">${statusLabel}</div>
                    <div class="absolute top-2 right-2 bg-black/60 px-2 py-1 text-[10px] font-mono text-white">#${b.ordem}</div>
                </div>
                <div class="flex justify-between items-center">
                    <div>
                        <h4 class="text-sm font-medium text-white truncate max-w-[200px]">${b.titulo || 'Sem título'}</h4>
                        <p class="text-[9px] text-gray-500 uppercase tracking-widest mt-1 truncate max-w-[200px]">${b.link || 'Sem link'}</p>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn-edit w-8 h-8 rounded-full border border-gray-800 flex items-center justify-center hover:bg-white hover:text-black transition-all" data-id="${b.id}">
                            <span class="material-icons text-sm">edit</span>
                        </button>
                        <button class="btn-del w-8 h-8 rounded-full border border-gray-800 flex items-center justify-center hover:bg-red-600 hover:border-red-600 hover:text-white transition-all" data-id="${b.id}">
                            <span class="material-icons text-sm">delete_outline</span>
                        </button>
                    </div>
                </div>
            `;
            gridBanners.appendChild(card);
        });

        document.querySelectorAll('.btn-edit').forEach(btn => btn.onclick = () => abrirEdicao(btn.dataset.id));
        document.querySelectorAll('.btn-del').forEach(btn => btn.onclick = () => deletarBanner(btn.dataset.id));
    }

    // ==========================================
    // CRIAÇÃO / EDIÇÃO (MULTIPART)
    // ==========================================
    formBanner.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('banner-id').value;
        const arquivo = inputArquivo.files[0];
        
        if (!id && !arquivo) {
            mostrarToast("A imagem é obrigatória para novos banners!", "erro");
            return;
        }

        const btnSalvar = document.getElementById('btn-salvar-banner');
        btnSalvar.disabled = true;
        document.getElementById('icon-salvar').textContent = 'autorenew';
        document.getElementById('icon-salvar').classList.add('animate-spin');

        try {
            const h = await window.authManager.getAuthHeaders();
            const uploadHeaders = { ...h };
            delete uploadHeaders['Content-Type']; // Deixa o navegador gerar o boundary
            
            const formData = new FormData();
            if(arquivo) formData.append('imagem', arquivo);
            formData.append('titulo', document.getElementById('banner-titulo').value);
            formData.append('link', document.getElementById('banner-link').value);
            formData.append('ativo', document.getElementById('banner-ativo').value === 'true');
            formData.append('ordem', parseInt(document.getElementById('banner-ordem').value) || 0);

            let url = `${window.authManager.apiUrl}/api/banners`;
            let method = 'POST';

            if (id) {
                url += `/${id}`;
                method = 'PUT';
            }

            const res = await fetch(url, { method, headers: uploadHeaders, body: formData });
            const d = await res.json();

            if (d.success) {
                mostrarToast(id ? "Banner atualizado!" : "Banner publicado!");
                fecharModal(modalBanner);
                carregarBanners();
            } else {
                mostrarToast(d.message || "Erro na API.", "erro");
            }
        } catch (e) {
            mostrarToast("Falha na rede.", "erro");
        } finally {
            btnSalvar.disabled = false;
            document.getElementById('icon-salvar').textContent = 'save';
            document.getElementById('icon-salvar').classList.remove('animate-spin');
        }
    });

    async function deletarBanner(id) {
        if (!confirm("Remover este banner do site permanentemente?")) return;
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetch(`${window.authManager.apiUrl}/api/banners/${id}`, { method: 'DELETE', headers: h });
            if ((await res.json()).success) { mostrarToast("Banner removido."); carregarBanners(); }
        } catch (e) {}
    }

    // ==========================================
    // AUXILIARES
    // ==========================================
    function abrirEdicao(id) {
        const b = listaBannersGlobal.find(x => x.id == id);
        if (!b) return;

        document.getElementById('modal-titulo').textContent = "Editar Banner";
        document.getElementById('banner-id').value = b.id;
        document.getElementById('banner-titulo').value = b.titulo || '';
        document.getElementById('banner-link').value = b.link || '';
        document.getElementById('banner-ordem').value = b.ordem;
        document.getElementById('banner-ativo').value = b.ativo ? 'true' : 'false';
        
        // Preview da imagem atual
        imgRender.src = getImagemUrl(b.caminho_imagem);
        previewUpload.classList.remove('hidden');
        
        abrirModal(modalBanner);
    }

    inputArquivo.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                imgRender.src = ev.target.result;
                previewUpload.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    };

    document.getElementById('btn-novo-banner').onclick = () => {
        formBanner.reset();
        document.getElementById('banner-id').value = "";
        document.getElementById('modal-titulo').textContent = "Novo Banner";
        previewUpload.classList.add('hidden');
        abrirModal(modalBanner);
    };

    document.getElementById('btn-fechar-modal').onclick = () => fecharModal(modalBanner);
    document.getElementById('btn-cancelar').onclick = () => fecharModal(modalBanner);

    function abrirModal(m) { m.classList.remove('hidden'); m.classList.add('flex'); setTimeout(() => m.classList.remove('opacity-0'), 10); }
    function fecharModal(m) { m.classList.add('opacity-0'); setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300); }
    
    function mostrarToast(msg, tipo = 'sucesso') {
        const t = document.getElementById('toast');
        document.getElementById('toast-msg').textContent = msg;
        document.getElementById('toast-icon').className = `material-icons ${tipo === 'erro' ? 'text-red-500' : 'text-black'}`;
        t.classList.remove('translate-y-20', 'opacity-0');
        setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 3000);
    }

    init();
});
