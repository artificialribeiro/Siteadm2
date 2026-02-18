document.addEventListener("DOMContentLoaded", () => {
    
    let filaEtiquetas = []; 
    let base64Logo = null;
    let produtoAtualParaVariantes = null;

    const inputBusca = document.getElementById('input-busca');
    const containerBusca = document.getElementById('lista-busca');
    const containerFila = document.getElementById('fila-impressao');
    const contadorFila = document.getElementById('contador-fila');
    const btnGerarPdf = document.getElementById('btn-gerar-pdf');
    const modalVariantes = document.getElementById('modal-variantes');
    const listaVariantesOpcoes = document.getElementById('lista-variantes-opcoes');

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
            converterLogoParaBase64('logo.png');
            await buscarProdutosNaApi('');
        } catch (error) {}
    }

    async function buscarProdutosNaApi(termo) {
        containerBusca.innerHTML = '<div class="p-8 text-center text-white animate-pulse uppercase tracking-widest text-[10px]">Consultando Catálogo...</div>';
        try {
            const h = await window.authManager.getAuthHeaders();
            let url = `${window.authManager.apiUrl}/api/produtos?pageSize=50`; 
            if (termo) url += `&q=${encodeURIComponent(termo)}`;
            const res = await fetch(url, { headers: h });
            const d = await res.json();
            if (d.success) renderizarBusca(Array.isArray(d.data) ? d.data : (d.data.itens || []));
        } catch (e) { containerBusca.innerHTML = '<div class="p-8 text-center text-red-500 text-[10px]">Falha na conexão.</div>'; }
    }

    function renderizarBusca(produtos) {
        if (!produtos.length) { containerBusca.innerHTML = '<div class="p-8 text-center text-gray-500 text-[10px]">Nenhum produto.</div>'; return; }
        containerBusca.innerHTML = '';
        produtos.forEach(p => {
            if(!p.ativo) return;
            const div = document.createElement('div');
            div.className = "flex items-center justify-between p-3 border-b border-gray-800/50 hover:bg-white/5 transition-colors cursor-pointer";
            div.innerHTML = `
                <div><p class="text-sm font-medium">${p.nome}</p><p class="text-[9px] text-gray-500 uppercase mt-1">SKU: ${p.sku || 'S/N'}</p></div>
                <span class="material-icons text-gray-600">chevron_right</span>
            `;
            div.onclick = () => abrirModalVariantes(p);
            containerBusca.appendChild(div);
        });
    }

    // 🟢 BUSCA VARIANTES DO MESMO PRODUTO NA API
    async function abrirModalVariantes(produto) {
        produtoAtualParaVariantes = produto;
        document.getElementById('v-nome-produto').textContent = produto.nome;
        listaVariantesOpcoes.innerHTML = '<div class="p-4 text-center text-white animate-pulse text-[10px]">CARREGANDO MEDIDAS...</div>';
        
        abrirModal(modalVariantes);

        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetch(`${window.authManager.apiUrl}/api/produtos/${produto.id}/variantes`, { headers: h });
            const d = await res.json();

            if (d.success && d.data.length > 0) {
                listaVariantesOpcoes.innerHTML = '';
                d.data.forEach(v => {
                    const div = document.createElement('div');
                    div.className = "flex items-center justify-between p-3 bg-black/40 border border-gray-800 rounded-sm hover:border-white transition-colors cursor-pointer";
                    div.innerHTML = `
                        <div class="flex items-center gap-3">
                            <input type="checkbox" class="check-v w-4 h-4 accent-white" data-id="${v.id}" data-tam="${v.tamanho}" data-cor="${v.cor}">
                            <span class="text-xs uppercase font-medium">TAM: ${v.tamanho} | COR: ${v.cor}</span>
                        </div>
                        <span class="text-[9px] text-gray-500 uppercase">Estoque: ${v.estoque}</span>
                    `;
                    div.onclick = (e) => { if(e.target.type !== 'checkbox') div.querySelector('input').click(); };
                    listaVariantesOpcoes.appendChild(div);
                });
            } else {
                listaVariantesOpcoes.innerHTML = '<div class="p-4 text-center text-gray-500 text-[10px]">NENHUMA MEDIDA CADASTRADA.</div>';
            }
        } catch (e) { fecharModal(modalVariantes); }
    }

    document.getElementById('btn-adicionar-selecionados').onclick = () => {
        const selecionados = document.querySelectorAll('.check-v:checked');
        selecionados.forEach(chk => {
            filaEtiquetas.push({
                id: produtoAtualParaVariantes.id,
                nome: produtoAtualParaVariantes.nome,
                sku: produtoAtualParaVariantes.sku || `P-${produtoAtualParaVariantes.id}`,
                preco: produtoAtualParaVariantes.preco,
                tamanho: chk.dataset.tam,
                cor: chk.dataset.cor,
                qtd: 1
            });
        });
        renderizarFila();
        fecharModal(modalVariantes);
    };

    function renderizarFila() {
        if (!filaEtiquetas.length) { 
            containerFila.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-gray-600 opacity-50"><span class="material-icons text-4xl">sell</span><p class="text-[10px] uppercase mt-2">Fila Vazia</p></div>';
            contadorFila.textContent = "0 Tags"; btnGerarPdf.disabled = true; return; 
        }
        containerFila.innerHTML = '';
        let total = 0;
        filaEtiquetas.forEach((item, idx) => {
            total += item.qtd;
            const div = document.createElement('div');
            div.className = "bg-black/40 border border-gray-800 p-3 rounded-sm flex flex-col gap-2";
            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="truncate"><p class="text-xs font-bold truncate">${item.nome}</p><p class="text-[9px] text-gray-500 uppercase">${item.sku} | TAM: ${item.tamanho}</p></div>
                    <button class="text-red-500" onclick="filaEtiquetas.splice(${idx},1);renderizarFila()"><span class="material-icons text-sm">delete</span></button>
                </div>
                <div class="flex items-center gap-2 pt-2 border-t border-gray-800">
                    <span class="text-[10px] text-gray-400 uppercase flex-1">Quantidade:</span>
                    <input type="number" class="w-12 bg-brand-gray border border-gray-700 text-center text-xs py-1 outline-none rounded-sm" value="${item.qtd}" onchange="filaEtiquetas[${idx}].qtd=parseInt(this.value)||1;renderizarFila()">
                </div>
            `;
            containerFila.appendChild(div);
        });
        contadorFila.textContent = `${total} Tags`; btnGerarPdf.disabled = false;
    }

    // PDF A4 GENERATOR (50x90mm Tags)
    btnGerarPdf.addEventListener('click', async () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const tagW = 50; const tagH = 90; const cols = 4; const rows = 3;
        const mX = (210 - (cols * tagW)) / 2; const mY = (297 - (rows * tagH)) / 2;
        const canvas = document.createElement('canvas');
        let cIdx = 0; let rIdx = 0;

        for (const item of filaEtiquetas) {
            for (let i = 0; i < item.qtd; i++) {
                if (cIdx >= cols) { cIdx = 0; rIdx++; }
                if (rIdx >= rows) { doc.addPage('a4', 'portrait'); cIdx = 0; rIdx = 0; }
                const x = mX + (cIdx * tagW); const y = mY + (rIdx * tagH);
                
                doc.setFillColor(15, 15, 15); doc.rect(x, y, tagW, tagH, 'F');
                doc.setDrawColor(100); doc.setLineWidth(0.1); doc.rect(x, y, tagW, tagH, 'S');
                
                if (base64Logo) doc.addImage(base64Logo, 'PNG', x + 10, y + 8, 30, 25);
                
                doc.setTextColor(255); doc.setFontSize(8); doc.text(item.nome.toUpperCase().substring(0, 25), x + 25, y + 42, { align: "center" });
                doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text(`TAM: ${item.tamanho}`, x + 25, y + 48, { align: "center" });
                doc.setFontSize(14); doc.text(`R$ ${parseFloat(item.preco).toLocaleString('pt-BR',{minFrac:2})}`, x + 25, y + 60, { align: "center" });

                try {
                    JsBarcode(canvas, item.sku, { format: "CODE128", displayValue: false, height: 40, width: 2, background: "#ffffff" });
                    doc.setFillColor(255); doc.rect(x + 7, y + 68, 36, 16, 'F');
                    doc.addImage(canvas.toDataURL("image/png"), 'PNG', x + 8, y + 70, 34, 10);
                    doc.setTextColor(0); doc.setFontSize(6); doc.text(item.sku, x + 25, y + 82, { align: "center" });
                } catch (e) {}
                cIdx++;
            }
        }
        doc.save("Folha_A4_Tags_Premium.pdf");
    });

    function converterLogoParaBase64(url) {
        const img = new Image(); img.crossOrigin = 'Anonymous';
        img.onload = () => { const cvs = document.createElement('canvas'); cvs.width = img.width; cvs.height = img.height; cvs.getContext('2d').drawImage(img,0,0); base64Logo = cvs.toDataURL('image/png'); };
        img.src = url;
    }

    function abrirModal(m) { m.classList.remove('hidden'); m.classList.add('flex'); setTimeout(() => m.classList.remove('opacity-0'), 10); }
    function fecharModal(m) { m.classList.add('opacity-0'); setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300); }
    function mostrarToast(msg) {
        const t = document.getElementById('toast'); document.getElementById('toast-msg').textContent = msg;
        t.classList.remove('translate-y-20', 'opacity-0'); setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 3000);
    }
    document.getElementById('btn-fechar-v').onclick = () => fecharModal(modalVariantes);

    init();
});
