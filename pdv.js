/**
 * PDV — Boutique Diniz (Premium Monochrome + Logic V8 Final)
 * Resolvido: Erro setupBuscaScanner, trava de estoque rigorosa,
 * resgate de gift card no checkout e registro de operador.
 */

document.addEventListener("DOMContentLoaded", () => {
    const PIX_WORKER_URL = "https://holy-voice-c21b.artificialribeiro.workers.dev/api/pix";
    const API_KEY_PIX = "1526";

    let state = {
        produtos: [], carrinho: [], cliente: null, sessaoId: null, usuario: null,
        filialId: null, desconto: 0, giftCard: 0, giftCardSaldo: 0, 
        giftCardNumero: null, giftCardCodigo: null, metodoPagamento: null
    };

    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);

    const els = {
        nomeOperador: $('topbar-user-name'), statusBadge: $('status-caixa-badge'),
        displayIdCaixa: $('display-id-caixa'), cartBadge: $('cart-badge'),
        grid: $('container-produtos'), carrinhoLista: $('lista-carrinho'),
        subtotal: $('subtotal-carrinho'), total: $('total-carrinho'),
        inputDesconto: $('input-desconto'), btnsPgto: $$('.btn-metodo-pgto'),
        modalVariantes: $('modal-selecionar-variante'), listaVariantes: $('lista-variantes-pdv'),
        modalRecibo: $('modal-recibo'), modalAbrirCaixa: $('modal-abrir-caixa'),
        boxCliente: $('box-cliente-identificado'), btnBuscaCliente: $('btn-abrir-busca-cliente'),
        txtValorCartao: $('txt-valor-cartao'), btnRemoverCartao: $('btn-remover-cartao'),
        btnAddCartao: $('btn-add-cartao'), modalCartao: $('modal-cartao-presente')
    };

    function logErroVisual(msg) {
        const console = $('error-console');
        const message = $('error-message');
        if (console && message) { console.classList.remove('hidden'); message.textContent = `ERRO: ${msg}`; }
    }

    async function init() {
        try {
            const userStr = sessionStorage.getItem('usuario');
            if (!userStr) throw new Error("Sessão expirada. Faça login.");
            state.usuario = JSON.parse(userStr);
            state.filialId = state.usuario.filial_id || 1;
            if (els.nomeOperador) els.nomeOperador.textContent = state.usuario.nome_completo.split(' ')[0];

            let tentativas = 0;
            while (typeof window.authManager === 'undefined' && tentativas < 50) {
                await new Promise(r => setTimeout(r, 100)); tentativas++;
            }
            if (typeof window.authManager === 'undefined') throw new Error("Módulo Auth não carregou.");

            // Inicializa funções de interface
            setupMobileDrawer();
            setupAbasCliente();
            setupEventosCaixa();
            setupEventosGiftCard();
            setupBuscaScanner(); // Função agora definida abaixo

            // Carregamento de dados
            await recuperarSessaoAtiva();
            await carregarProdutos();

        } catch (e) { logErroVisual(e.message); }
    }

    // --- 1. PRODUTOS E SCANNER ---
    async function carregarProdutos() {
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetch(`${window.authManager.apiUrl}/api/produtos?ativo=1&filial_id=${state.filialId}`, { headers: h });
            const d = await res.json();
            if (d.success) { state.produtos = d.data || []; renderGrade(state.produtos); }
        } catch (e) { logErroVisual("Falha ao carregar catálogo."); }
    }

    function renderGrade(lista) {
        els.grid.innerHTML = '';
        lista.forEach(p => {
            const imgSrc = p.imagens?.[0]?.url || 'logo.png';
            const pFinal = p.desconto_percent > 0 ? p.preco * (1 - p.desconto_percent/100) : p.preco;
            const div = document.createElement('div');
            div.className = "bg-brand-gray border border-brand-border rounded-2xl overflow-hidden cursor-pointer group hover:border-white transition-all flex flex-col";
            div.innerHTML = `<div class='aspect-[4/5] bg-black overflow-hidden'><img src='${imgSrc}' class='w-full h-full object-cover opacity-80 group-hover:opacity-100'></div>
                <div class='p-4 flex-1 border-t border-brand-border'>
                    <p class='text-[11px] font-semibold text-white uppercase leading-tight'>${p.nome}</p>
                    <p class='text-sm font-light text-white font-mono mt-2'>${formatarMoeda(pFinal)}</p>
                </div>`;
            div.onclick = () => buscarEAdicionarDireto(p, imgSrc);
            els.grid.appendChild(div);
        });
    }

    function setupBuscaScanner() {
        const input = $('input-busca-pdv');
        if (!input) return;
        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const termo = input.value.trim().toLowerCase();
                const p = state.produtos.find(prod => prod.sku === termo || prod.codigo_barras === termo);
                if (p) { input.value = ''; await buscarEAdicionarDireto(p, p.imagens?.[0]?.url || 'logo.png'); }
            }
        });
    }

    async function buscarEAdicionarDireto(produto, imgSrc) {
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetch(`${window.authManager.apiUrl}/api/produtos/${produto.id}/variantes`, { headers: h });
            const d = await res.json();
            const variantes = (d.data || []).filter(v => v.ativo !== 0 && v.estoque > 0);
            if (variantes.length === 1) { adicionarCarrinho(produto, variantes[0], imgSrc); }
            else { abrirVariantesModal(produto, variantes, imgSrc); }
        } catch(e) { mostrarToast("Erro ao carregar variantes.", "erro"); }
    }

    function abrirVariantesModal(produto, variantes, imgSrc) {
        $('v-nome-produto').textContent = produto.nome; $('v-foto-produto').src = imgSrc;
        els.listaVariantes.innerHTML = '';
        variantes.forEach(v => {
            const btn = document.createElement('button');
            btn.className = "w-full p-4 bg-brand-gray border border-brand-border hover:border-white rounded-xl flex justify-between";
            btn.innerHTML = `<span>${v.tamanho} / ${v.cor}</span> <b>${v.estoque} un</b>`;
            btn.onclick = () => { adicionarCarrinho(produto, v, imgSrc); fecharModal(els.modalVariantes); };
            els.listaVariantes.appendChild(btn);
        });
        abrirModal(els.modalVariantes);
    }

    // --- 2. CARRINHO E ESTOQUE ---
    function adicionarCarrinho(prod, variante, img) {
        const key = `${prod.id}-${variante.id}`;
        const item = state.carrinho.find(i => i.key === key);
        const precoFinal = prod.desconto_percent > 0 ? prod.preco * (1 - prod.desconto_percent/100) : prod.preco;

        if (item) {
            if (item.qtd + 1 > variante.estoque) return mostrarToast("Estoque insuficiente!", "aviso");
            item.qtd++;
        } else {
            state.carrinho.push({ key, varId: variante.id, nome: prod.nome, tamanho: variante.tamanho, cor: variante.cor, preco: precoFinal, qtd: 1, img, estoqueMax: variante.estoque });
        }
        renderCarrinho();
    }

    function renderCarrinho() {
        els.carrinhoLista.innerHTML = '';
        state.carrinho.forEach((item, idx) => {
            const d = document.createElement('div');
            d.className = "p-3 mb-2 bg-brand-gray border border-brand-border rounded-xl flex items-center gap-3";
            d.innerHTML = `<img src='${item.img}' class='w-12 h-12 rounded-lg object-cover'>
                <div class='flex-1'><p class='text-[10px] font-bold text-white uppercase'>${item.nome}</p><p class='text-[9px] text-gray-500'>${item.tamanho}/${item.cor}</p></div>
                <div class='flex items-center gap-2 bg-black p-1 rounded-lg'>
                    <button onclick='window.pdvAltQtd(${idx}, -1)'><span class='material-icons-outlined text-xs'>remove</span></button>
                    <span class='text-xs'>${item.qtd}</span>
                    <button onclick='window.pdvAltQtd(${idx}, 1)'><span class='material-icons-outlined text-xs'>add</span></button>
                </div>`;
            els.carrinhoLista.appendChild(d);
        });
        atualizarTotais();
    }

    window.pdvAltQtd = (i, d) => {
        const it = state.carrinho[i];
        if (d > 0 && it.qtd + d > it.estoqueMax) return mostrarToast("Limite de estoque!");
        it.qtd += d; if (it.qtd <= 0) state.carrinho.splice(i, 1);
        renderCarrinho();
    };

    function atualizarTotais() {
        const sub = state.carrinho.reduce((a, i) => a + (i.preco * i.qtd), 0);
        state.desconto = parseFloat(els.inputDesconto.value) || 0;
        const totalParcial = Math.max(0, sub - state.desconto);
        state.giftCard = Math.min(state.giftCardSaldo, totalParcial);
        const final = totalParcial - state.giftCard;

        els.subtotal.textContent = formatarMoeda(sub);
        els.total.textContent = formatarMoeda(final);
        if(state.giftCardSaldo > 0) els.txtValorCartao.textContent = `USO: -${formatarMoeda(state.giftCard)}`;
    }

    // --- 3. CAIXA ---
    async function recuperarSessaoAtiva() {
        const h = await window.authManager.getAuthHeaders();
        const res = await fetch(`${window.authManager.apiUrl}/api/caixa/sessoes?status=aberto&filial_id=${state.filialId}`, { headers: h });
        const d = await res.json();
        if (d.success && d.data?.length > 0) {
            state.sessaoId = d.data[0].id;
            els.displayIdCaixa.textContent = `#${state.sessaoId}`;
            els.statusBadge.style.backgroundColor = "#FFFFFF";
        } else { abrirModal(els.modalAbrirCaixa); }
    }

    function setupEventosCaixa() {
        $('form-abrir-caixa').onsubmit = async (e) => {
            e.preventDefault();
            const h = await window.authManager.getAuthHeaders();
            const res = await fetch(`${window.authManager.apiUrl}/api/caixa/abrir`, {
                method: 'POST', headers: h,
                body: JSON.stringify({ filial_id: state.filialId, usuario_id: state.usuario.id, valor_abertura: parseFloat($('c-valor-inicial').value) })
            });
            const d = await res.json();
            if (d.success) { usarSessao(d.data); } else { mostrarToast(d.message, 'erro'); }
        };
    }

    function usarSessao(s) { state.sessaoId = s.id; els.displayIdCaixa.textContent = `#${s.id}`; fecharModal(els.modalAbrirCaixa); }

    // --- 4. CHECKOUT ---
    async function finalizarVenda() {
        if (state.carrinho.length === 0) return;
        try {
            const h = await window.authManager.getAuthHeaders();
            const totalFinal = Math.max(0, state.carrinho.reduce((a,i)=>a+(i.preco*i.qtd),0) - state.desconto - state.giftCard);

            if (state.giftCard > 0) {
                await fetch(`${window.authManager.apiUrl}/api/cartoes/resgatar`, {
                    method: 'POST', headers: h,
                    body: JSON.stringify({ numero: state.giftCardNumero, codigo_seguranca: state.giftCardCodigo, valor: state.giftCard })
                });
            }

            const res = await fetch(`${window.authManager.apiUrl}/api/caixa/lancamentos`, {
                method: 'POST', headers: h,
                body: JSON.stringify({
                    filial_id: state.filialId, sessao_id: state.sessaoId, tipo: 'entrada',
                    descricao: `Venda PDV`, valor: totalFinal, forma_pagamento: state.metodoPagamento || 'dinheiro',
                    origem: 'venda', usuario_vendedor_id: state.usuario.id
                })
            });
            const d = await res.json();
            if (d.success) {
                mostrarToast("Venda realizada!");
                gerarCupomFiscal([...state.carrinho], totalFinal);
                state.carrinho = []; renderCarrinho();
            }
        } catch(e) { logErroVisual("Falha no checkout."); }
    }

    // --- 5. GIFT CARD ---
    function setupEventosGiftCard() {
        els.btnAddCartao.onclick = () => abrirModal(els.modalCartao);
        $('form-cartao-presente').onsubmit = async (e) => {
            e.preventDefault();
            const h = await window.authManager.getAuthHeaders();
            const res = await fetch(`${window.authManager.apiUrl}/api/cartoes/numero/${$('cp-numero').value.replace(/\s/g, '')}`, { headers: h });
            const d = await res.json();
            if (d.success) {
                state.giftCardSaldo = parseFloat(d.data.saldo);
                state.giftCardNumero = d.data.numero;
                state.giftCardCodigo = $('cp-codigo-seguranca').value;
                els.btnRemoverCartao.classList.remove('hidden'); els.btnAddCartao.classList.add('hidden');
                fecharModal(els.modalCartao); atualizarTotais();
            }
        };
    }

    // --- AUXILIARES ---
    function formatarMoeda(v) { return (v||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    function abrirModal(el) { if(el) { el.classList.remove('hidden'); el.classList.add('flex'); } }
    function fecharModal(el) { if(el) { el.classList.add('hidden'); el.classList.remove('flex'); } }
    function setupMobileDrawer() {
        $('btn-toggle-cart').onclick = () => $('painel-carrinho').classList.add('cart-open');
        $('btn-close-cart').onclick = () => $('painel-carrinho').classList.remove('cart-open');
    }
    function setupAbasCliente() {
        $('tab-cliente-avulso').onclick = () => { $('content-cliente-avulso').classList.remove('hidden'); $('content-buscar-api').classList.add('hidden'); };
        $('tab-buscar-api').onclick = () => { $('content-cliente-avulso').classList.add('hidden'); $('content-buscar-api').classList.remove('hidden'); };
        $('btn-confirmar-avulso').onclick = () => { state.cliente = { nome_completo: $('avulso-nome').value }; $('txt-nome-cliente').textContent = state.cliente.nome_completo; $('box-cliente-identificado').classList.remove('hidden'); fecharModal(els.modalCliente); };
    }
    function mostrarToast(msg, t='sucesso') { const toast=$('toast'); $('toast-msg').textContent=msg; toast.classList.remove('translate-y-20','opacity-0'); setTimeout(()=>toast.classList.add('translate-y-20','opacity-0'),3000); }

    // Binds de pagamento
    els.btnsPgto.forEach(b => b.onclick = () => { state.metodoPagamento = b.dataset.tipo; finalizarVenda(); });

    init();
});
