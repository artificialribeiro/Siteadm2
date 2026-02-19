/**
 * PDV — Boutique Diniz v2.0
 * Correções e melhorias:
 * - PIX automático: não repede cliente se já identificado
 * - PIX manual: confirmação do operador antes de finalizar
 * - Cartão crédito/débito: confirmação do operador
 * - Nota fiscal completa: gift card (número, código, saldo restante), dados do cliente, desconto manual
 * - Módulo de devoluções completo com nota de devolução
 * - Pergunta ao operador antes de finalizar venda não-dinheiro
 */

document.addEventListener("DOMContentLoaded", () => {

    const PIX_API_URL = "https://holy-voice-c21b.artificialribeiro.workers.dev/api/pix";
    const PIX_API_KEY = "1526";

    // ─── Estado Global ────────────────────────────────────────────────────────
    let state = {
        produtos: [], carrinho: [], cliente: null, clienteApi: null,
        sessaoId: null, usuario: null, filialId: null,
        desconto: 0, giftCard: 0, giftCardSaldo: 0,
        giftCardNumero: null, giftCardCodigo: null, giftCardSaldoRestante: 0,
        metodoPagamento: null, pixPaymentId: null, pixPollingTimer: null,
        pendingFormaPagamento: null, pendingLabelPagamento: null
    };

    // ─── Helpers ──────────────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);
    const fmt = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtCPF = v => (v || '').replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    const apenasNum = v => (v || '').replace(/\D/g, '');

    function abrirModal(el) { if (el) { el.classList.remove('hidden'); el.classList.add('flex'); } }
    function fecharModal(el) { if (el) { el.classList.add('hidden'); el.classList.remove('flex'); } }

    let _toastTimer = null;
    function mostrarToast(msg, tipo = 'ok') {
        const t = $('toast'), ic = $('toast-icon'), tx = $('toast-msg');
        if (!t) return;
        if (_toastTimer) clearTimeout(_toastTimer);
        tx.textContent = msg;
        ic.textContent = tipo === 'erro' ? 'error' : tipo === 'aviso' ? 'warning' : 'check_circle';
        ic.className = `material-icons-outlined text-sm ${tipo === 'erro' ? 'text-red-600' : tipo === 'aviso' ? 'text-yellow-500' : 'text-green-600'}`;
        t.classList.remove('-translate-y-20', 'opacity-0');
        _toastTimer = setTimeout(() => t.classList.add('-translate-y-20', 'opacity-0'), 3000);
    }

    function logErroVisual(msg) {
        const bar = $('error-console'), el = $('error-message');
        if (bar && el) { bar.classList.remove('hidden'); bar.classList.add('flex'); el.textContent = msg; }
        console.error(msg);
    }

    // ─── Init ─────────────────────────────────────────────────────────────────
    async function init() {
        try {
            const userStr = sessionStorage.getItem('usuario');
            if (!userStr) throw new Error("Sessão expirada. Faça login novamente.");
            state.usuario = JSON.parse(userStr);
            state.filialId = state.usuario.filial_id || 1;

            const nomeEl = $('topbar-user-name');
            if (nomeEl) nomeEl.textContent = state.usuario.nome_completo?.split(' ')[0] || 'Usuário';

            const infoOp = $('info-operador-abertura');
            if (infoOp) infoOp.textContent = `Operador: ${state.usuario.nome_completo} • Filial #${state.filialId}`;

            let t = 0;
            while (typeof window.authManager === 'undefined' && t < 100) {
                await new Promise(r => setTimeout(r, 50)); t++;
            }
            if (typeof window.authManager === 'undefined') throw new Error("Módulo de autenticação não carregou.");

            injetarModaisDinamicos();
            setupMobileDrawer();
            setupEventosCaixa();
            setupEventosCliente();
            setupEventosGiftCard();
            setupEventosLancamento();
            setupEventosCarrinho();
            setupBuscaScanner();
            setupRecibo();
            setupPix();
            setupBotoesMobileBarra();
            setupDevolucao();
            setupConfirmacaoPagamento();

            await recuperarSessaoAtiva();
            await carregarProdutos();

        } catch (e) { logErroVisual(e.message); }
    }

    // ─── Injetar modais adicionais no DOM ─────────────────────────────────────
    function injetarModaisDinamicos() {
        const container = document.body;

        // Modal de confirmação do operador (cartão/pix manual)
        container.insertAdjacentHTML('beforeend', `
        <div id="modal-confirmar-pgto" class="fixed inset-0 bg-black/95 backdrop-blur-md z-[300] hidden items-center justify-center p-4">
            <div class="bg-brand-dark w-full max-w-sm rounded-2xl border border-brand-border shadow-2xl p-7 text-center">
                <span class="material-icons-outlined text-5xl text-white mb-3 block" id="confirmar-pgto-icon">point_of_sale</span>
                <h3 class="text-white font-bold uppercase tracking-[0.15em] text-sm mb-2" id="confirmar-pgto-titulo">Confirmar Pagamento</h3>
                <p class="text-gray-400 text-xs mb-1" id="confirmar-pgto-valor"></p>
                <p class="text-[10px] text-gray-500 mb-6 leading-relaxed" id="confirmar-pgto-instrucao">
                    Operadora, por favor confirme o recebimento<br>do comprovante da maquininha ou pagamento em mãos.
                </p>
                <div class="flex gap-3">
                    <button id="btn-cancelar-confirmar-pgto"
                        class="flex-1 py-3 bg-transparent border border-brand-border text-gray-400 text-[10px] font-bold uppercase rounded-xl hover:text-white transition-colors">
                        Cancelar
                    </button>
                    <button id="btn-ok-confirmar-pgto"
                        class="flex-1 py-3 bg-white text-black text-[10px] font-bold uppercase rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-1">
                        <span class="material-icons-outlined text-sm">check_circle</span> Confirmar
                    </button>
                </div>
            </div>
        </div>`);

        // Modal de devolução
        container.insertAdjacentHTML('beforeend', `
        <div id="modal-devolucao" class="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] hidden items-center justify-center p-4">
            <div class="bg-brand-dark w-full max-w-md rounded-2xl border border-brand-border shadow-2xl flex flex-col max-h-[95vh]">
                <div class="p-4 bg-brand-black border-b border-brand-border flex justify-between items-center shrink-0">
                    <h3 class="text-white font-bold uppercase tracking-[0.1em] text-xs flex items-center gap-2">
                        <span class="material-icons-outlined text-sm">swap_horiz</span> Devolução / Troca
                    </h3>
                    <button id="btn-fechar-devolucao" class="text-gray-500 hover:text-white"><span class="material-icons-outlined">close</span></button>
                </div>
                <div class="flex-1 overflow-y-auto p-5 space-y-4">

                    <!-- Tipo -->
                    <div>
                        <label class="text-[9px] uppercase text-gray-500 block mb-2 tracking-widest font-semibold">Tipo de Operação</label>
                        <div class="grid grid-cols-3 gap-2">
                            <button type="button" class="btn-tipo-dev py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all bg-white text-black border-white" data-tipo="devolucao">Devolução</button>
                            <button type="button" class="btn-tipo-dev py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all bg-transparent text-gray-400 border-brand-border" data-tipo="troca">Troca</button>
                            <button type="button" class="btn-tipo-dev py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all bg-transparent text-gray-400 border-brand-border" data-tipo="cancelamento">Cancelamento</button>
                        </div>
                        <input type="hidden" id="dev-tipo" value="devolucao">
                    </div>

                    <!-- Cliente -->
                    <div>
                        <label class="text-[9px] uppercase text-gray-500 block mb-1.5 tracking-widest font-semibold">Cliente (opcional)</label>
                        <input type="text" id="dev-cliente-nome" class="input-dark" placeholder="Nome do cliente">
                    </div>

                    <!-- Bipar / Buscar produto -->
                    <div>
                        <label class="text-[9px] uppercase text-gray-500 block mb-1.5 tracking-widest font-semibold">Adicionar Item (bipar ou buscar)</label>
                        <div class="flex gap-2">
                            <div class="relative flex-1">
                                <span class="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]">barcode_reader</span>
                                <input type="text" id="dev-scan-input" autocomplete="off"
                                    class="w-full bg-brand-black border border-gray-800 focus:border-white text-white text-sm pl-9 pr-3 py-2.5 rounded-xl outline-none transition-all placeholder:text-gray-600"
                                    placeholder="Nome, SKU ou bipar código...">
                            </div>
                            <button type="button" id="btn-dev-buscar-produto"
                                class="px-4 bg-white text-black font-bold text-[10px] uppercase rounded-xl hover:bg-gray-200 transition-colors shrink-0 flex items-center gap-1">
                                <span class="material-icons-outlined text-sm">search</span>
                            </button>
                        </div>
                        <p class="text-[9px] text-gray-600 mt-1">Pressione Enter para buscar. Produtos aparecem mesmo sem estoque.</p>
                    </div>

                    <!-- Itens devolvidos -->
                    <div>
                        <label class="text-[9px] uppercase text-gray-500 block mb-2 tracking-widest font-semibold">Itens para Devolver</label>
                        <div id="dev-itens-container" class="space-y-2"></div>
                        <button type="button" id="btn-add-item-dev"
                            class="mt-2 w-full py-2.5 bg-brand-gray border border-dashed border-brand-border text-gray-500 hover:text-white hover:border-gray-500 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1">
                            <span class="material-icons-outlined text-sm">add</span> Adicionar manualmente
                        </button>
                    </div>

                    <!-- Motivo -->
                    <div>
                        <label class="text-[9px] uppercase text-gray-500 block mb-1.5 tracking-widest font-semibold">Motivo *</label>
                        <textarea id="dev-motivo" class="input-dark resize-none" rows="2" placeholder="Descreva o motivo da devolução..."></textarea>
                    </div>

                    <!-- Valor do reembolso -->
                    <div>
                        <label class="text-[9px] uppercase text-gray-500 block mb-1.5 tracking-widest font-semibold">Valor do Reembolso (R$)</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">R$</span>
                            <input type="number" step="0.01" min="0" id="dev-valor" class="input-dark pl-9 font-mono" placeholder="0.00">
                        </div>
                    </div>

                    <!-- Forma de reembolso -->
                    <div>
                        <label class="text-[9px] uppercase text-gray-500 block mb-1.5 tracking-widest font-semibold">Forma de Reembolso</label>
                        <select id="dev-forma-reembolso" class="input-dark">
                            <option value="dinheiro">Dinheiro</option>
                            <option value="pix">PIX</option>
                            <option value="cartao">Cartão</option>
                            <option value="troca">Troca de Produto</option>
                            <option value="credito_loja">Crédito na Loja</option>
                        </select>
                    </div>
                </div>

                <div class="p-4 border-t border-brand-border shrink-0 flex gap-3">
                    <button type="button" id="btn-cancelar-devolucao"
                        class="flex-1 py-3 bg-transparent border border-brand-border text-gray-400 text-[10px] font-bold uppercase rounded-xl hover:text-white">
                        Cancelar
                    </button>
                    <button type="button" id="btn-confirmar-devolucao"
                        class="flex-1 py-3 bg-white text-black text-[10px] font-bold uppercase rounded-xl hover:bg-gray-200 flex items-center justify-center gap-1">
                        <span class="material-icons-outlined text-sm">check</span> Registrar
                    </button>
                </div>
            </div>
        </div>`);

        // Modal de recibo de devolução
        container.insertAdjacentHTML('beforeend', `
        <div id="modal-recibo-devolucao" class="fixed inset-0 bg-black/90 backdrop-blur-md z-[250] hidden items-center justify-center p-2 sm:p-4">
            <div class="bg-brand-dark w-full max-w-xs rounded-2xl border border-red-500/30 shadow-2xl flex flex-col max-h-[95vh]">
                <div class="p-4 border-b border-brand-border flex justify-between items-center bg-brand-black no-print shrink-0">
                    <h3 class="text-white font-bold uppercase tracking-[0.1em] text-xs flex items-center gap-2">
                        <span class="material-icons-outlined text-sm text-red-400">receipt_long</span> Nota de Devolução
                    </h3>
                    <button id="btn-fechar-recibo-dev" class="text-gray-500 hover:text-white"><span class="material-icons-outlined">close</span></button>
                </div>
                <div class="flex-1 overflow-y-auto bg-gray-300 flex justify-center p-3">
                    <div id="area-impressao-devolucao" class="bg-white text-black shadow" style="width:72mm;min-height:80px;"></div>
                </div>
                <div class="p-3 border-t border-brand-border flex gap-2 bg-brand-black no-print shrink-0">
                    <button id="btn-fechar-recibo-dev-btn" class="flex-1 py-3 bg-brand-gray border border-brand-border text-white font-bold text-[10px] uppercase rounded-xl hover:bg-brand-border transition-colors">Fechar</button>
                    <button id="btn-imprimir-dev" class="flex-1 py-3 bg-white text-black font-bold text-[10px] uppercase rounded-xl flex items-center justify-center gap-1.5 hover:bg-gray-200 transition-colors">
                        <span class="material-icons-outlined text-sm">print</span> Imprimir
                    </button>
                </div>
            </div>
        </div>`);
    }

    // ─── 1. PRODUTOS ──────────────────────────────────────────────────────────
    async function carregarProdutos() {
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetch(`${window.authManager.apiUrl}/api/produtos?ativo=1&filial_id=${state.filialId}&pageSize=200`, { headers: h });
            const d = await res.json();
            if (d.success) { state.produtos = d.data || []; renderGrade(state.produtos); }
            else logErroVisual("Erro ao carregar produtos: " + d.message);
        } catch { logErroVisual("Falha ao carregar catálogo."); }
    }

    function renderGrade(lista) {
        const grid = $('container-produtos');
        if (!grid) return;
        if (!lista.length) {
            grid.innerHTML = `<div class="col-span-full h-64 flex flex-col items-center justify-center text-gray-600">
                <span class="material-icons-outlined text-4xl mb-2">inventory_2</span>
                <p class="text-[10px] uppercase tracking-widest">Nenhum produto encontrado</p></div>`;
            return;
        }
        grid.innerHTML = '';
        lista.forEach(p => {
            const imgSrc = p.imagens?.[0]?.url || 'logo.png';
            const pFinal = p.desconto_percent > 0 ? p.preco * (1 - p.desconto_percent / 100) : p.preco;
            const el = document.createElement('div');
            el.className = "bg-brand-gray border border-brand-border rounded-2xl overflow-hidden cursor-pointer group hover:border-white transition-all flex flex-col";
            el.innerHTML = `
                <div class="aspect-[4/5] bg-black overflow-hidden">
                    <img src="${imgSrc}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" onerror="this.src='logo.png'">
                </div>
                <div class="p-3 flex-1 border-t border-brand-border">
                    <p class="text-[10px] font-semibold text-white uppercase leading-tight line-clamp-2">${p.nome}</p>
                    ${p.sku ? `<p class="text-[8px] text-gray-600 font-mono mt-0.5">${p.sku}</p>` : ''}
                    ${p.desconto_percent > 0 ? `<p class="text-[9px] text-gray-500 font-mono line-through mt-1">${fmt(p.preco)}</p>` : ''}
                    <div class="flex items-center justify-between mt-1">
                        <p class="text-sm font-mono text-white">${fmt(pFinal)}</p>
                        ${p.desconto_percent > 0 ? `<span class="text-[7px] bg-white text-black font-bold px-1.5 py-0.5 rounded">-${p.desconto_percent}%</span>` : ''}
                    </div>
                </div>`;
            el.onclick = () => buscarEAdicionarDireto(p, imgSrc);
            grid.appendChild(el);
        });
    }

    // ─── 2. BUSCA / SCANNER ───────────────────────────────────────────────────
    function setupBuscaScanner() {
        const input = $('input-busca-pdv');
        if (input) {
            let debounce;
            input.addEventListener('input', () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => filtrarProdutos(input.value.trim()), 200);
            });
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    const termo = input.value.trim();
                    const p = state.produtos.find(x => x.sku === termo || (x.codigo_barras && x.codigo_barras === termo));
                    if (p) { input.value = ''; filtrarProdutos(''); buscarEAdicionarDireto(p, p.imagens?.[0]?.url || 'logo.png'); }
                }
            });
        }
    }

    function filtrarProdutos(termo) {
        if (!termo) { renderGrade(state.produtos); return; }
        const q = termo.toLowerCase();
        renderGrade(state.produtos.filter(p =>
            p.nome.toLowerCase().includes(q) ||
            (p.sku && p.sku.toLowerCase().includes(q)) ||
            (p.descricao && p.descricao.toLowerCase().includes(q))
        ));
    }

    async function buscarEAdicionarDireto(produto, imgSrc) {
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetch(`${window.authManager.apiUrl}/api/produtos/${produto.id}/variantes`, { headers: h });
            const d = await res.json();
            const variantes = (d.data || []).filter(v => v.ativo !== 0 && v.estoque > 0);
            if (!variantes.length) { mostrarToast("Produto sem estoque.", "aviso"); return; }
            if (variantes.length === 1) { adicionarCarrinho(produto, variantes[0], imgSrc); }
            else { abrirVariantesModal(produto, variantes, imgSrc); }
        } catch { mostrarToast("Erro ao carregar variantes.", "erro"); }
    }

    function abrirVariantesModal(produto, variantes, imgSrc) {
        const modal = $('modal-selecionar-variante');
        const pFinal = produto.desconto_percent > 0 ? produto.preco * (1 - produto.desconto_percent / 100) : produto.preco;
        const foto = $('v-foto-produto'); if (foto) { foto.src = imgSrc; foto.onerror = () => foto.src = 'logo.png'; }
        const nome = $('v-nome-produto'); if (nome) nome.textContent = produto.nome;
        const preco = $('v-preco-produto'); if (preco) preco.textContent = fmt(pFinal);
        const lista = $('lista-variantes-pdv');
        if (lista) {
            lista.innerHTML = '';
            variantes.forEach(v => {
                const btn = document.createElement('button');
                btn.className = "w-full p-3.5 bg-brand-gray border border-brand-border hover:border-white rounded-xl flex justify-between items-center transition-all";
                btn.innerHTML = `<span class="text-sm font-medium text-white">${v.tamanho || '-'} / ${v.cor || '-'}</span>
                    <span class="text-[10px] text-gray-400 font-mono">${v.estoque} un</span>`;
                btn.onclick = () => { adicionarCarrinho(produto, v, imgSrc); fecharModal(modal); };
                lista.appendChild(btn);
            });
        }
        const btnF = $('btn-fechar-variantes');
        if (btnF) btnF.onclick = () => fecharModal(modal);
        abrirModal(modal);
    }

    // ─── 3. CARRINHO ──────────────────────────────────────────────────────────
    function adicionarCarrinho(prod, variante, img) {
        const key = `${prod.id}-${variante.id}`;
        const item = state.carrinho.find(i => i.key === key);
        const precoFinal = prod.desconto_percent > 0 ? prod.preco * (1 - prod.desconto_percent / 100) : prod.preco;
        if (item) {
            if (item.qtd + 1 > variante.estoque) { mostrarToast("Estoque insuficiente!", "aviso"); return; }
            item.qtd++;
        } else {
            state.carrinho.push({ key, varId: variante.id, prodId: prod.id, nome: prod.nome,
                tamanho: variante.tamanho || '-', cor: variante.cor || '-',
                preco: precoFinal, qtd: 1, img: img || 'logo.png', estoqueMax: variante.estoque });
        }
        renderCarrinho();
        mostrarToast(`${prod.nome.substring(0, 20)} adicionado!`);
    }

    function renderCarrinho() {
        const lista = $('lista-carrinho');
        const badge = $('cart-badge');
        if (!lista) return;
        lista.innerHTML = '';
        if (!state.carrinho.length) {
            lista.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-gray-700 py-12">
                <span class="material-icons-outlined text-4xl mb-2">shopping_bag</span>
                <p class="text-[10px] uppercase tracking-widest">Sacola vazia</p></div>`;
        } else {
            state.carrinho.forEach((item, idx) => {
                const d = document.createElement('div');
                d.className = "bg-brand-gray border border-brand-border rounded-xl flex items-center gap-2 p-2.5 mb-2";
                d.innerHTML = `
                    <img src="${item.img}" class="w-11 rounded-lg object-cover shrink-0" onerror="this.src='logo.png'" style="height:52px">
                    <div class="flex-1 min-w-0">
                        <p class="text-[10px] font-bold text-white uppercase truncate leading-tight">${item.nome}</p>
                        <p class="text-[9px] text-gray-500 mt-0.5">${item.tamanho} / ${item.cor}</p>
                        <p class="text-[10px] font-mono text-white mt-0.5">${fmt(item.preco * item.qtd)}</p>
                    </div>
                    <div class="flex items-center gap-1 bg-black rounded-lg p-1 shrink-0">
                        <button onclick="window.pdvAltQtd(${idx},-1)" class="w-6 h-6 flex items-center justify-center hover:bg-brand-gray rounded transition-colors">
                            <span class="material-icons-outlined text-xs">remove</span></button>
                        <span class="text-xs font-bold font-mono w-5 text-center">${item.qtd}</span>
                        <button onclick="window.pdvAltQtd(${idx},1)" class="w-6 h-6 flex items-center justify-center hover:bg-brand-gray rounded transition-colors">
                            <span class="material-icons-outlined text-xs">add</span></button>
                    </div>`;
                lista.appendChild(d);
            });
        }
        const totalItens = state.carrinho.reduce((a, i) => a + i.qtd, 0);
        if (badge) { badge.textContent = totalItens; badge.classList.toggle('hidden', totalItens === 0); }
        atualizarTotais();
    }

    window.pdvAltQtd = (idx, delta) => {
        const item = state.carrinho[idx];
        if (!item) return;
        if (delta > 0 && item.qtd + delta > item.estoqueMax) { mostrarToast("Limite de estoque!", "aviso"); return; }
        item.qtd += delta;
        if (item.qtd <= 0) state.carrinho.splice(idx, 1);
        renderCarrinho();
    };

    function setupEventosCarrinho() {
        const btnLimpar = $('btn-limpar-carrinho');
        if (btnLimpar) btnLimpar.onclick = () => { state.carrinho = []; renderCarrinho(); };
        const inputDesc = $('input-desconto');
        if (inputDesc) inputDesc.addEventListener('input', atualizarTotais);

        // Botões de pagamento
        $$('.btn-metodo-pgto').forEach(b => b.onclick = () => {
            const tipo = b.dataset.tipo;
            const label = b.dataset.label || tipo;
            if (tipo === 'pix') {
                iniciarFluxoPix(label);
            } else {
                // Cartão (crédito/débito) e outros: pede confirmação do operador
                pedirConfirmacaoOperador(tipo, label);
            }
        });

        const btnZerado = $('btn-finalizar-zerado');
        if (btnZerado) btnZerado.onclick = () => finalizarVenda('dinheiro', 'Dinheiro');
    }

    function atualizarTotais() {
        const inputDesc = $('input-desconto');
        const sub = state.carrinho.reduce((a, i) => a + (i.preco * i.qtd), 0);
        state.desconto = Math.min(parseFloat(inputDesc?.value) || 0, sub);
        const parcial = Math.max(0, sub - state.desconto);
        state.giftCard = Math.min(state.giftCardSaldo, parcial);
        const final = Math.max(0, parcial - state.giftCard);

        const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
        set('subtotal-carrinho', fmt(sub));
        set('total-carrinho', fmt(final));

        const rowDesc = $('row-desconto-display'), rowGift = $('row-gift-display');
        if (rowDesc) { rowDesc.classList.toggle('hidden', state.desconto <= 0); rowDesc.classList.toggle('flex', state.desconto > 0); set('display-desconto', `- ${fmt(state.desconto)}`); }
        if (rowGift) { rowGift.classList.toggle('hidden', state.giftCard <= 0); rowGift.classList.toggle('flex', state.giftCard > 0); set('display-gift', `- ${fmt(state.giftCard)}`); }
        if ($('txt-valor-cartao') && state.giftCardSaldo > 0) $('txt-valor-cartao').textContent = `Saldo: ${fmt(state.giftCardSaldo)}`;

        const temItens = state.carrinho.length > 0;
        const gratis = final === 0 && temItens;
        const boxZ = $('box-finalizar-zerado'), gridP = $('grid-pagamentos');
        if (boxZ) boxZ.classList.toggle('hidden', !gratis);
        if (gridP) gridP.classList.toggle('hidden', gratis && sub > 0);
    }

    // ─── Confirmação do Operador (cartão/pix manual/débito) ───────────────────
    function setupConfirmacaoPagamento() {
        const btnOk = $('btn-ok-confirmar-pgto');
        const btnCancelar = $('btn-cancelar-confirmar-pgto');
        if (btnOk) btnOk.onclick = () => {
            fecharModal($('modal-confirmar-pgto'));
            finalizarVenda(state.pendingFormaPagamento, state.pendingLabelPagamento);
        };
        if (btnCancelar) btnCancelar.onclick = () => {
            fecharModal($('modal-confirmar-pgto'));
            state.pendingFormaPagamento = null;
            state.pendingLabelPagamento = null;
        };
    }

    function pedirConfirmacaoOperador(tipo, label) {
        if (!state.carrinho.length) { mostrarToast("Sacola vazia.", "aviso"); return; }
        if (!state.sessaoId) { mostrarToast("Nenhum caixa aberto.", "erro"); return; }

        const sub = state.carrinho.reduce((a, i) => a + (i.preco * i.qtd), 0);
        const total = Math.max(0, sub - state.desconto - state.giftCard);

        state.pendingFormaPagamento = tipo;
        state.pendingLabelPagamento = label;

        // Ícone contextual
        const iconMap = { dinheiro: 'payments', cartao: 'credit_card', pix: 'qr_code' };
        const ic = $('confirmar-pgto-icon');
        if (ic) ic.textContent = iconMap[tipo] || 'point_of_sale';

        const titulo = $('confirmar-pgto-titulo');
        if (titulo) titulo.textContent = `Pagamento — ${label.toUpperCase()}`;

        const valor = $('confirmar-pgto-valor');
        if (valor) valor.textContent = `Valor: ${fmt(total)}`;

        const instr = $('confirmar-pgto-instrucao');
        if (instr) {
            if (tipo === 'cartao') {
                instr.textContent = 'Operadora, confirme que o comprovante\nda maquininha foi recebido antes de finalizar.';
            } else {
                instr.textContent = 'Operadora, confirme o recebimento\ndo pagamento em mãos antes de finalizar.';
            }
        }

        abrirModal($('modal-confirmar-pgto'));
    }

    // ─── 4. CAIXA ─────────────────────────────────────────────────────────────
    async function recuperarSessaoAtiva() {
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetch(`${window.authManager.apiUrl}/api/caixa/sessoes?status=aberto&filial_id=${state.filialId}`, { headers: h });
            const d = await res.json();
            if (d.success && d.data?.length > 0) usarSessao(d.data[0]);
            else abrirModal($('modal-abrir-caixa'));
        } catch { logErroVisual("Falha ao verificar caixa."); abrirModal($('modal-abrir-caixa')); }
    }

    function usarSessao(s) {
        state.sessaoId = s.id;
        const di = $('display-id-caixa'); if (di) di.textContent = `Caixa #${s.id}`;
        const bd = $('status-caixa-badge'); if (bd) bd.style.backgroundColor = '#22c55e';
        const fi = $('fechar-caixa-id'); if (fi) fi.textContent = `#${s.id}`;
        fecharModal($('modal-abrir-caixa'));
    }

    function setupEventosCaixa() {
        const formAbrir = $('form-abrir-caixa');
        if (formAbrir) formAbrir.onsubmit = async e => {
            e.preventDefault();
            try {
                const h = await window.authManager.getAuthHeaders();
                const res = await fetch(`${window.authManager.apiUrl}/api/caixa/abrir`, {
                    method: 'POST', headers: h,
                    body: JSON.stringify({
                        filial_id: state.filialId,
                        usuario_id: state.usuario.id,
                        valor_abertura: parseFloat($('c-valor-inicial')?.value) || 0
                    })
                });
                const d = await res.json();
                if (d.success) { usarSessao(d.data); mostrarToast("Caixa aberto!"); }
                else mostrarToast(d.message || "Erro ao abrir caixa.", "erro");
            } catch { logErroVisual("Falha ao abrir caixa."); }
        };

        const btnFechar = $('btn-abrir-modal-fechar');
        if (btnFechar) btnFechar.onclick = () => {
            if (!state.sessaoId) { mostrarToast("Nenhum caixa aberto.", "aviso"); return; }
            abrirModal($('modal-fechar-caixa'));
        };

        const formFechar = $('form-fechar-caixa');
        if (formFechar) formFechar.onsubmit = async e => {
            e.preventDefault();
            if (!state.sessaoId) { mostrarToast("Sessão inválida.", "erro"); return; }
            try {
                const h = await window.authManager.getAuthHeaders();
                const res = await fetch(`${window.authManager.apiUrl}/api/caixa/${state.sessaoId}/fechar`, {
                    method: 'POST', headers: h,
                    body: JSON.stringify({
                        usuario_id: state.usuario.id,
                        valor_fechamento_declarado: parseFloat($('fc-valor-declarado')?.value) || 0
                    })
                });
                const d = await res.json();
                if (d.success) {
                    fecharModal($('modal-fechar-caixa'));
                    mostrarToast("Caixa fechado! Aguardando aprovação.");
                    state.sessaoId = null;
                    const di = $('display-id-caixa'); if (di) di.textContent = 'Sem caixa';
                    const bd = $('status-caixa-badge'); if (bd) bd.style.backgroundColor = '#ef4444';
                } else mostrarToast(d.message || "Erro ao fechar caixa.", "erro");
            } catch { logErroVisual("Falha ao fechar caixa."); }
        };

        const btnCancelar = $('btn-cancelar-fechar-caixa');
        if (btnCancelar) btnCancelar.onclick = () => fecharModal($('modal-fechar-caixa'));
    }

    // ─── 5. CLIENTE ───────────────────────────────────────────────────────────
    function setupEventosCliente() {
        const modalCliente = $('modal-cliente');
        const btnAbrir = $('btn-abrir-busca-cliente'); if (btnAbrir) btnAbrir.onclick = () => abrirModal(modalCliente);
        const btnFechar = $('btn-fechar-modal-cliente'); if (btnFechar) btnFechar.onclick = () => fecharModal(modalCliente);

        const tabAv = $('tab-cliente-avulso'), tabBu = $('tab-buscar-api');
        const contAv = $('content-cliente-avulso'), contBu = $('content-buscar-api');
        function ativarAba(aba) {
            [tabAv, tabBu].forEach(t => t?.classList.remove('bg-white', 'text-black'));
            [tabAv, tabBu].forEach(t => t?.classList.add('text-gray-400'));
            [contAv, contBu].forEach(c => c?.classList.add('hidden'));
            if (aba === 'av') { tabAv?.classList.add('bg-white', 'text-black'); tabAv?.classList.remove('text-gray-400'); contAv?.classList.remove('hidden'); }
            else { tabBu?.classList.add('bg-white', 'text-black'); tabBu?.classList.remove('text-gray-400'); contBu?.classList.remove('hidden'); }
        }
        if (tabAv) tabAv.onclick = () => ativarAba('av');
        if (tabBu) tabBu.onclick = () => ativarAba('bu');

        // CPF mask
        const cpfInputs = [$('avulso-cpf'), $('busca-cpf')];
        cpfInputs.forEach(inp => {
            if (!inp) return;
            inp.addEventListener('input', () => {
                let v = apenasNum(inp.value);
                if (v.length > 11) v = v.slice(0, 11);
                inp.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) =>
                    d ? `${a}.${b}.${c}-${d}` : c ? `${a}.${b}.${c}` : b ? `${a}.${b}` : a);
            });
        });

        const btnConfAv = $('btn-confirmar-avulso');
        if (btnConfAv) btnConfAv.onclick = () => {
            const nome = $('avulso-nome')?.value?.trim();
            if (!nome) { mostrarToast("Informe o nome.", "aviso"); return; }
            state.cliente = {
                id: null, nome_completo: nome,
                cpf: apenasNum($('avulso-cpf')?.value || ''),
                email: $('avulso-email')?.value?.trim() || ''
            };
            vincularClienteUI(state.cliente);
            fecharModal(modalCliente);
            // Limpa campos
            if ($('avulso-nome')) $('avulso-nome').value = '';
            if ($('avulso-cpf')) $('avulso-cpf').value = '';
            if ($('avulso-email')) $('avulso-email').value = '';
        };

        const btnBuscar = $('btn-buscar-cpf');
        if (btnBuscar) btnBuscar.onclick = async () => {
            const cpf = apenasNum($('busca-cpf')?.value || '');
            if (cpf.length < 11) { mostrarToast("CPF inválido.", "aviso"); return; }
            try {
                const h = await window.authManager.getAuthHeaders();
                const res = await fetch(`${window.authManager.apiUrl}/api/clientes?q=${cpf}`, { headers: h });
                const d = await res.json();
                const box = $('resultado-busca-cliente');
                if (d.success && d.data?.length > 0) {
                    const c = d.data[0]; state.clienteApi = c;
                    const setEl = (id, v) => { const el = $(id); if (el) el.textContent = v; };
                    setEl('res-cliente-nome', c.nome_completo);
                    setEl('res-cliente-cpf', c.cpf || fmtCPF(cpf));
                    setEl('res-cliente-email', c.email || '');
                    if (box) box.classList.remove('hidden');
                } else { mostrarToast("Cliente não encontrado.", "aviso"); if (box) box.classList.add('hidden'); }
            } catch { mostrarToast("Erro na busca.", "erro"); }
        };

        const btnVinc = $('btn-vincular-cliente');
        if (btnVinc) btnVinc.onclick = () => {
            if (!state.clienteApi) return;
            state.cliente = state.clienteApi;
            vincularClienteUI(state.clienteApi);
            fecharModal(modalCliente);
        };

        const btnRem = $('btn-remover-cliente');
        if (btnRem) btnRem.onclick = () => {
            state.cliente = null; state.clienteApi = null;
            const box = $('box-cliente-identificado'); if (box) { box.classList.add('hidden'); box.classList.remove('flex'); }
            const btn = $('btn-abrir-busca-cliente'); if (btn) btn.classList.remove('hidden');
            mostrarToast("Cliente removido.", "aviso");
        };
    }

    function vincularClienteUI(cliente) {
        const box = $('box-cliente-identificado'), btn = $('btn-abrir-busca-cliente');
        const nomeEl = $('txt-nome-cliente'), cpfEl = $('txt-cpf-cliente');
        if (box) { box.classList.remove('hidden'); box.classList.add('flex'); }
        if (btn) btn.classList.add('hidden');
        if (nomeEl) nomeEl.textContent = cliente.nome_completo;
        if (cpfEl) cpfEl.textContent = cliente.cpf ? fmtCPF(String(cliente.cpf)) : 'Sem CPF';
        mostrarToast(`Cliente: ${cliente.nome_completo.split(' ')[0]}`);

        // Se havia um PIX pendente aguardando CPF, retoma automaticamente
        if (_pendingPixAposCliente) {
            const cpf = apenasNum(String(cliente.cpf || ''));
            if (cpf.length >= 11) {
                _pendingPixAposCliente = false;
                const label = _pendingPixLabel || 'PIX';
                _pendingPixLabel = null;
                fecharModal($('modal-cliente'));
                setTimeout(() => _gerarPixComCliente(cpf, cliente.nome_completo, label), 400);
            }
        }
    }

    // ─── 6. GIFT CARD ─────────────────────────────────────────────────────────
    function setupEventosGiftCard() {
        const modalCartao = $('modal-cartao-presente');
        const btnAdd = $('btn-add-cartao'); if (btnAdd) btnAdd.onclick = () => abrirModal(modalCartao);
        const btnFch = $('btn-fechar-modal-cartao'); if (btnFch) btnFch.onclick = () => fecharModal(modalCartao);

        // Máscara do número do cartão
        const numInput = $('cp-numero');
        if (numInput) {
            numInput.addEventListener('input', () => {
                let v = apenasNum(numInput.value).slice(0, 16);
                numInput.value = v.replace(/(\d{4})(?=\d)/g, '$1 ');
            });
        }

        const formGift = $('form-cartao-presente');
        if (formGift) formGift.onsubmit = async e => {
            e.preventDefault();
            const numero = apenasNum($('cp-numero')?.value || '');
            const codigo = $('cp-codigo-seguranca')?.value?.trim();
            if (numero.length !== 16) { mostrarToast("Número deve ter 16 dígitos.", "aviso"); return; }
            if (!codigo) { mostrarToast("Informe o código de segurança.", "aviso"); return; }
            try {
                const h = await window.authManager.getAuthHeaders();
                const res = await fetch(`${window.authManager.apiUrl}/api/cartoes/numero/${numero}`, { headers: h });
                const d = await res.json();
                if (d.success && d.data) {
                    if (d.data.status !== 'ativo') { mostrarToast("Cartão inativo ou expirado.", "erro"); return; }
                    state.giftCardSaldo = parseFloat(d.data.saldo);
                    state.giftCardNumero = d.data.numero;
                    state.giftCardCodigo = codigo;
                    const btnR = $('btn-remover-cartao'); if (btnR) btnR.classList.remove('hidden');
                    if (btnAdd) btnAdd.classList.add('hidden');
                    fecharModal(modalCartao);
                    atualizarTotais();
                    mostrarToast(`Gift Card: ${fmt(state.giftCardSaldo)} disponível`);
                } else mostrarToast(d.message || "Cartão não encontrado.", "erro");
            } catch { mostrarToast("Erro ao verificar cartão.", "erro"); }
        };

        const btnRemIcn = $('btn-remover-cartao-icone');
        if (btnRemIcn) btnRemIcn.onclick = () => {
            state.giftCard = 0; state.giftCardSaldo = 0; state.giftCardNumero = null; state.giftCardCodigo = null;
            const btnR = $('btn-remover-cartao'); if (btnR) btnR.classList.add('hidden');
            const btnA = $('btn-add-cartao'); if (btnA) btnA.classList.remove('hidden');
            atualizarTotais(); mostrarToast("Gift Card removido.", "aviso");
        };
    }

    // ─── 7. LANÇAMENTO MANUAL ─────────────────────────────────────────────────
    function setupEventosLancamento() {
        const modal = $('modal-lancamento');
        const btnAbrir = $('btn-abrir-lancamento'); if (btnAbrir) btnAbrir.onclick = () => { if (!state.sessaoId) { mostrarToast("Abra o caixa primeiro.", "aviso"); return; } abrirModal(modal); };
        const btnFch = $('btn-fechar-lancamento'); if (btnFch) btnFch.onclick = () => fecharModal(modal);
        const btnEnt = $('lan-btn-entrada'), btnSai = $('lan-btn-saida'), inputTipo = $('lan-tipo');

        function selTipo(tipo) {
            if (inputTipo) inputTipo.value = tipo;
            [btnEnt, btnSai].forEach(b => b?.classList.remove('bg-white', 'text-black', 'border-white'));
            [btnEnt, btnSai].forEach(b => b?.classList.add('bg-transparent', 'text-gray-400', 'border-brand-border'));
            const ativo = tipo === 'entrada' ? btnEnt : btnSai;
            ativo?.classList.add('bg-white', 'text-black', 'border-white');
            ativo?.classList.remove('bg-transparent', 'text-gray-400', 'border-brand-border');
        }
        if (btnEnt) btnEnt.onclick = () => selTipo('entrada');
        if (btnSai) btnSai.onclick = () => selTipo('saida');

        const formLan = $('form-lancamento');
        if (formLan) formLan.onsubmit = async e => {
            e.preventDefault();
            try {
                const h = await window.authManager.getAuthHeaders();
                const tipo = inputTipo?.value || 'entrada';
                const descricao = $('lan-descricao')?.value?.trim();
                const valor = parseFloat($('lan-valor')?.value);
                const forma = $('lan-forma-pgto')?.value || 'dinheiro';
                if (!descricao || !valor || valor <= 0) { mostrarToast("Preencha descrição e valor.", "aviso"); return; }
                const res = await fetch(`${window.authManager.apiUrl}/api/caixa/lancamentos`, {
                    method: 'POST', headers: h,
                    body: JSON.stringify({ filial_id: state.filialId, sessao_id: state.sessaoId, tipo, descricao, valor,
                        forma_pagamento: forma, origem: tipo === 'entrada' ? 'outros' : 'despesa', usuario_vendedor_id: state.usuario.id })
                });
                const d = await res.json();
                if (d.success) { fecharModal(modal); formLan.reset(); selTipo('entrada'); mostrarToast("Lançamento registrado!"); }
                else mostrarToast(d.message || "Erro ao registrar.", "erro");
            } catch { logErroVisual("Falha ao registrar lançamento."); }
        };
    }

    // ─── 8. PIX ───────────────────────────────────────────────────────────────
    function setupPix() {
        const btnFch = $('btn-fechar-pix');
        if (btnFch) btnFch.onclick = () => { pararPollingPix(); fecharModal($('modal-pix')); };
        const btnFchOk = $('btn-fechar-pix-ok');
        if (btnFchOk) btnFchOk.onclick = () => fecharModal($('modal-pix'));
        const btnCop = $('btn-copiar-pix');
        if (btnCop) btnCop.onclick = () => {
            const el = $('pix-copia-cola');
            if (el?.value) { navigator.clipboard.writeText(el.value).then(() => mostrarToast("Código copiado!")); }
        };
        // PIX Manual — operador confirma recebimento
        const btnPixManual = $('btn-pix-manual');
        if (btnPixManual) btnPixManual.onclick = () => {
            pararPollingPix();
            fecharModal($('modal-pix'));
            // Pede confirmação do operador (igual cartão)
            state.pendingFormaPagamento = 'pix';
            state.pendingLabelPagamento = 'PIX MANUAL';
            const sub = state.carrinho.reduce((a, i) => a + (i.preco * i.qtd), 0);
            const total = Math.max(0, sub - state.desconto - state.giftCard);
            const ic = $('confirmar-pgto-icon'); if (ic) ic.textContent = 'qr_code';
            const titulo = $('confirmar-pgto-titulo'); if (titulo) titulo.textContent = 'PIX MANUAL';
            const valor = $('confirmar-pgto-valor'); if (valor) valor.textContent = `Valor: ${fmt(total)}`;
            const instr = $('confirmar-pgto-instrucao'); if (instr) instr.textContent = 'Operadora, confirme que o PIX foi recebido na maquininha ou comprovante antes de finalizar.';
            abrirModal($('modal-confirmar-pgto'));
        };
    }

    async function iniciarFluxoPix(labelTipo) {
        if (!state.carrinho.length) { mostrarToast("Sacola vazia.", "aviso"); return; }
        if (!state.sessaoId) { mostrarToast("Abra o caixa primeiro.", "erro"); return; }

        const cpfCliente = apenasNum(state.cliente?.cpf || '');
        const nomeCliente = state.cliente?.nome_completo || '';

        // ── CORREÇÃO PRINCIPAL: só pede cliente se ele ainda NÃO está identificado ──
        if (!cpfCliente || cpfCliente.length < 11) {
            mostrarToast("Identifique o cliente com CPF para gerar PIX.", "aviso");
            // Abre modal de cliente, mas APENAS se ainda não há cliente
            abrirModal($('modal-cliente'));
            // Seta um listener temporário para continuar o PIX após identificar
            _pendingPixAposCliente = true;
            _pendingPixLabel = labelTipo;
            return;
        }

        _pendingPixAposCliente = false;
        _pendingPixLabel = null;
        await _gerarPixComCliente(cpfCliente, nomeCliente, labelTipo);
    }

    let _pendingPixAposCliente = false;
    let _pendingPixLabel = null;

    // PIX retoma automaticamente via vincularClienteUI (ver acima)

    async function _gerarPixComCliente(cpfCliente, nomeCliente, labelTipo) {
        const sub = state.carrinho.reduce((a, i) => a + (i.preco * i.qtd), 0);
        const totalFinal = Math.max(0, sub - state.desconto - state.giftCard);

        if (totalFinal <= 0) { await finalizarVenda('pix', 'PIX'); return; }

        const modal = $('modal-pix');
        const loading = $('pix-loading'), qrCont = $('pix-qr-container');
        if (loading) loading.classList.remove('hidden');
        if (qrCont) qrCont.classList.add('hidden');
        abrirModal(modal);

        try {
            const res = await fetch(`${PIX_API_URL}/gerar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': PIX_API_KEY },
                body: JSON.stringify({
                    nome: nomeCliente || 'Consumidor Final',
                    cpfCnpj: cpfCliente,
                    email: state.cliente?.email || '',
                    valor: totalFinal,
                    descricao: `Venda PDV Boutique Diniz — ${new Date().toLocaleDateString('pt-BR')}`
                })
            });
            const d = await res.json();

            if (!d.success) { fecharModal(modal); mostrarToast(d.message || "Erro ao gerar PIX.", "erro"); return; }

            state.pixPaymentId = d.data.payment_id;

            const qrImg = $('pix-qr-img'); if (qrImg) qrImg.src = d.data.imagem_base64;
            const qrCc = $('pix-copia-cola'); if (qrCc) qrCc.value = d.data.pix_copia_e_cola;
            const valorLabel = $('pix-valor-label'); if (valorLabel) valorLabel.textContent = fmt(totalFinal);

            if (loading) loading.classList.add('hidden');
            if (qrCont) { qrCont.classList.remove('hidden'); qrCont.classList.add('flex'); }

            const aguard = $('pix-aguardando'), conf = $('pix-confirmado');
            if (aguard) aguard.classList.remove('hidden');
            if (conf) conf.classList.add('hidden');

            iniciarPollingPix(d.data.payment_id, totalFinal, labelTipo || 'PIX');

        } catch (err) { fecharModal(modal); logErroVisual("Falha ao gerar PIX: " + err.message); }
    }

    function iniciarPollingPix(paymentId, totalFinal, labelTipo) {
        pararPollingPix();
        state.pixPollingTimer = setInterval(async () => {
            try {
                const res = await fetch(`${PIX_API_URL}/status/${paymentId}`, { headers: { 'x-api-key': PIX_API_KEY } });
                const d = await res.json();
                if (d.success && d.data?.pago) {
                    pararPollingPix();
                    const aguard = $('pix-aguardando'), conf = $('pix-confirmado');
                    if (aguard) aguard.classList.add('hidden');
                    if (conf) { conf.classList.remove('hidden'); conf.classList.add('flex'); }
                    await finalizarVenda('pix', 'PIX', true);
                }
            } catch { /* polling silencioso */ }
        }, 5000);
    }

    function pararPollingPix() {
        if (state.pixPollingTimer) { clearInterval(state.pixPollingTimer); state.pixPollingTimer = null; }
    }

    // ─── 9. CHECKOUT ──────────────────────────────────────────────────────────
    async function finalizarVenda(formaPagamento, labelPagamento, pixJaConfirmado = false) {
        if (!state.carrinho.length) { mostrarToast("Sacola vazia.", "aviso"); return; }
        if (!state.sessaoId) { mostrarToast("Nenhum caixa aberto.", "erro"); return; }

        try {
            const h = await window.authManager.getAuthHeaders();
            const sub = state.carrinho.reduce((a, i) => a + (i.preco * i.qtd), 0);
            const totalFinal = Math.max(0, sub - state.desconto - state.giftCard);
            const itensSnap = [...state.carrinho];
            const descontoSnap = state.desconto;
            const giftSnap = state.giftCard;
            const giftNumeroSnap = state.giftCardNumero;
            const giftCodigoSnap = state.giftCardCodigo;
            const clienteSnap = state.cliente ? { ...state.cliente } : null;
            const nomeOp = state.usuario?.nome_completo || 'Operador';
            const sessaoSnap = state.sessaoId;

            // PASSO 1 — Gift Card
            let giftCardSaldoRestante = 0;
            if (giftSnap > 0 && giftNumeroSnap) {
                const rg = await fetch(`${window.authManager.apiUrl}/api/cartoes/resgatar`, {
                    method: 'POST', headers: h,
                    body: JSON.stringify({ numero: giftNumeroSnap, codigo_seguranca: giftCodigoSnap, valor: giftSnap })
                });
                const dg = await rg.json();
                if (!dg.success) { mostrarToast(dg.message || "Erro no gift card.", "erro"); return; }
                giftCardSaldoRestante = dg.data?.saldo_atual ?? 0;
            }

            // PASSO 2 — Baixa de estoque
            const resultadosEst = await Promise.all(
                itensSnap.map(item => fetch(`${window.authManager.apiUrl}/api/estoque/movimentos`, {
                    method: 'POST', headers: h,
                    body: JSON.stringify({ variante_id: item.varId, tipo: 'saida', quantidade: item.qtd,
                        motivo: 'Venda PDV', referencia_tipo: 'pedido', usuario_id: state.usuario.id })
                }).then(r => r.json()))
            );
            const falhaEst = resultadosEst.find(r => !r.success);
            if (falhaEst) { mostrarToast(falhaEst.error?.details?.[0]?.issue || falhaEst.message || "Estoque insuficiente.", "erro"); return; }

            // PASSO 3 — Lançamento no caixa
            const descVenda = clienteSnap ? `Venda PDV — ${clienteSnap.nome_completo}` : 'Venda PDV';
            const res = await fetch(`${window.authManager.apiUrl}/api/caixa/lancamentos`, {
                method: 'POST', headers: h,
                body: JSON.stringify({
                    filial_id: state.filialId, sessao_id: sessaoSnap,
                    tipo: 'entrada', descricao: descVenda,
                    valor: totalFinal > 0 ? totalFinal : sub,
                    forma_pagamento: formaPagamento || 'dinheiro',
                    origem: 'venda', usuario_vendedor_id: state.usuario.id,
                    ...(clienteSnap?.id ? { cliente_id: clienteSnap.id } : {})
                })
            });
            const d = await res.json();

            if (d.success) {
                mostrarToast("Venda finalizada! ✓");
                if (pixJaConfirmado) setTimeout(() => fecharModal($('modal-pix')), 1500);

                // Gera cupom com TODOS os dados completos
                gerarCupomFiscal({
                    itens: itensSnap,
                    totalFinal,
                    subtotal: sub,
                    desconto: descontoSnap,
                    giftCardValor: giftSnap,
                    giftCardNumero: giftNumeroSnap,
                    giftCardCodigo: giftCodigoSnap,
                    giftCardSaldoRestante,
                    formaPagamento: formaPagamento || 'dinheiro',
                    labelPagamento: labelPagamento || 'Dinheiro',
                    cliente: clienteSnap,
                    operador: nomeOp,
                    sessaoId: sessaoSnap
                });

                limparEstadoVenda();
            } else {
                mostrarToast(d.message || "Erro ao registrar no caixa.", "erro");
            }
        } catch (e) { logErroVisual("Falha no checkout: " + e.message); }
    }

    function limparEstadoVenda() {
        state.carrinho = []; state.desconto = 0; state.giftCard = 0; state.giftCardSaldo = 0;
        state.giftCardNumero = null; state.giftCardCodigo = null; state.giftCardSaldoRestante = 0;
        state.cliente = null; state.clienteApi = null; state.metodoPagamento = null; state.pixPaymentId = null;
        state.pendingFormaPagamento = null; state.pendingLabelPagamento = null;
        const inputDesc = $('input-desconto'); if (inputDesc) inputDesc.value = '';
        const boxC = $('box-cliente-identificado'); if (boxC) { boxC.classList.add('hidden'); boxC.classList.remove('flex'); }
        const btnBC = $('btn-abrir-busca-cliente'); if (btnBC) btnBC.classList.remove('hidden');
        const btnRG = $('btn-remover-cartao'); if (btnRG) btnRG.classList.add('hidden');
        const btnAG = $('btn-add-cartao'); if (btnAG) btnAG.classList.remove('hidden');
        renderCarrinho();
    }

    // ─── 10. CUPOM FISCAL TÉRMICO 80mm ────────────────────────────────────────
    function gerarCupomFiscal(dados) {
        const { itens, totalFinal, subtotal, desconto, giftCardValor, giftCardNumero, giftCardCodigo,
            giftCardSaldoRestante, formaPagamento, labelPagamento, cliente, operador, sessaoId } = dados;

        const area = $('area-impressao-cupom'), modal = $('modal-recibo');
        if (!area || !modal) return;

        const agora = new Date();
        const data = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dataHora = `${data}  ${hora}`;

        const clienteNome = cliente?.nome_completo || 'CONSUMIDOR FINAL';
        const clienteCPF = cliente?.cpf ? fmtCPF(String(cliente.cpf)) : '';
        const clienteEmail = cliente?.email || '';
        const labelPgtoExib = (labelPagamento || formaPagamento || 'DINHEIRO').toUpperCase();

        // ── helpers de layout ──────────────────────────────────────────────────
        // Linha: esquerda · · · direita (40 chars)
        const dotLine = (esq, dir) => {
            const total = 40;
            const dots = Math.max(1, total - esq.length - dir.length);
            return `<div style="display:flex;gap:0"><span>${esq}</span><span style="flex:1;letter-spacing:1px;color:#bbb">${'·'.repeat(dots)}</span><span style="font-weight:bold">${dir}</span></div>`;
        };
        const sep = (char = '─') => `<div style="letter-spacing:1.5px;color:#ccc;text-align:center;margin:3px 0">${char.repeat(36)}</div>`;
        const dashed = () => `<div style="border-top:1px dashed #aaa;margin:3px 0"></div>`;

        // ── itens ──────────────────────────────────────────────────────────────
        const itensHtml = itens.map((i, n) => {
            const varLabel = [i.tamanho !== '-' ? i.tamanho : '', i.cor !== '-' ? i.cor : ''].filter(Boolean).join(' / ');
            return `
            <div style="margin-bottom:5px">
              <div style="font-weight:700;font-size:7.5pt;text-transform:uppercase;line-height:1.3;letter-spacing:0.3px">${i.nome}</div>
              ${varLabel ? `<div style="font-size:7pt;color:#777;line-height:1.2;margin-bottom:1px">${varLabel}</div>` : ''}
              ${dotLine(`  ${i.qtd} un × ${fmt(i.preco)}`, fmt(i.preco * i.qtd))}
            </div>`;
        }).join('');

        // ── gift card ──────────────────────────────────────────────────────────
        const giftHtml = giftCardValor > 0 && giftCardNumero ? `
            ${dashed()}
            <div style="background:#f7f7f7;border:1px solid #ddd;border-radius:4px;padding:4px 6px;margin:3px 0;font-size:7pt">
              <div style="text-align:center;font-weight:bold;font-size:7.5pt;letter-spacing:1px;margin-bottom:2px">◈ CARTÃO PRESENTE</div>
              ${dotLine('Número', '••••' + String(giftCardNumero).slice(-4))}
              ${dotLine('Cód. Segurança', giftCardCodigo || '••••')}
              ${dotLine('Valor utilizado', fmt(giftCardValor))}
              ${dotLine('Saldo restante', fmt(giftCardSaldoRestante))}
            </div>` : '';

        area.innerHTML = `
<div style="font-family:'Courier New',Courier,monospace;font-size:7.5pt;color:#000;width:100%;line-height:1.4;padding:4mm 2mm;box-sizing:border-box">

  <!-- ═══ CABEÇALHO ═══ -->
  <div style="text-align:center;margin-bottom:5px">
    <div style="font-size:15pt;font-weight:900;letter-spacing:3px;line-height:1">BOUTIQUE</div>
    <div style="font-size:15pt;font-weight:900;letter-spacing:3px;line-height:1.1">DINIZ</div>
    <div style="font-size:6.5pt;letter-spacing:4px;color:#777;margin-top:2px;text-transform:uppercase">Moda Feminina</div>
  </div>
  ${sep('═')}

  <!-- ═══ INFO DA VENDA ═══ -->
  <div style="font-size:7pt;color:#555;text-align:center;line-height:1.6;margin-bottom:2px">
    <div>${dataHora}</div>
    <div><b>Operador:</b> ${operador}</div>
    <div><b>Caixa:</b> #${sessaoId || '—'}</div>
  </div>
  ${sep()}

  <!-- ═══ CLIENTE ═══ -->
  ${clienteNome !== 'CONSUMIDOR FINAL' ? `
  <div style="font-size:7pt;line-height:1.5;margin-bottom:2px">
    <div style="font-weight:bold;font-size:7.5pt;margin-bottom:1px">▸ CLIENTE</div>
    <div>${clienteNome}</div>
    ${clienteCPF ? `<div>CPF: ${clienteCPF}</div>` : ''}
    ${clienteEmail ? `<div>E-mail: ${clienteEmail}</div>` : ''}
  </div>
  ${dashed()}` : `
  <div style="text-align:center;font-size:7pt;color:#888;margin-bottom:2px">CONSUMIDOR FINAL</div>
  ${dashed()}`}

  <!-- ═══ ITENS ═══ -->
  <div style="margin-bottom:3px">
    <div style="font-weight:bold;font-size:7pt;letter-spacing:1px;margin-bottom:3px;color:#555">ITEM / DESCRIÇÃO&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;TOTAL</div>
    ${itensHtml}
  </div>
  ${sep()}

  <!-- ═══ TOTAIS ═══ -->
  <div style="margin-bottom:4px">
    ${dotLine('Subtotal', fmt(subtotal))}
    ${desconto > 0 ? `<div style="display:flex;gap:0;color:#c00"><span>Desconto Manual</span><span style="flex:1;letter-spacing:1px;color:#faa">·····</span><span style="font-weight:bold">- ${fmt(desconto)}</span></div>` : ''}
    ${giftCardValor > 0 ? `<div style="display:flex;gap:0;color:#070"><span>Gift Card</span><span style="flex:1;letter-spacing:1px;color:#aga">·····</span><span style="font-weight:bold">- ${fmt(giftCardValor)}</span></div>` : ''}
  </div>

  <!-- ═══ TOTAL FINAL ═══ -->
  <div style="border-top:2px solid #000;border-bottom:2px solid #000;padding:4px 0;margin-bottom:4px">
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <span style="font-size:9pt;font-weight:900;letter-spacing:2px">TOTAL</span>
      <span style="font-size:13pt;font-weight:900;letter-spacing:-0.5px">${fmt(totalFinal)}</span>
    </div>
    <div style="text-align:right;font-size:7.5pt;font-weight:bold;letter-spacing:1.5px;color:#444;margin-top:1px">${labelPgtoExib}</div>
  </div>

  <!-- ═══ GIFT CARD DETALHE ═══ -->
  ${giftHtml}

  <!-- ═══ RODAPÉ ═══ -->
  ${sep('═')}
  <div style="text-align:center;font-size:7pt;color:#555;line-height:1.8">
    <div style="font-weight:bold;letter-spacing:1px">Obrigada pela preferência!</div>
    <div style="color:#888;font-size:6.5pt">Boutique Diniz — Moda Feminina</div>
    <div style="color:#aaa;font-size:6pt;margin-top:1px">${dataHora}</div>
  </div>

</div>`;

        abrirModal(modal);
    }

    function setupRecibo() {
        const modal = $('modal-recibo');
        const btnFch = $('btn-fechar-recibo'); if (btnFch) btnFch.onclick = () => fecharModal(modal);
        const btnPul = $('btn-pular-impressao'); if (btnPul) btnPul.onclick = () => fecharModal(modal);
        const btnImp = $('btn-imprimir-cupom'); if (btnImp) btnImp.onclick = () => window.print();
    }

    // ─── 11. DEVOLUÇÃO ────────────────────────────────────────────────────────
    function setupDevolucao() {
        const modal = $('modal-devolucao');
        const modalRecibo = $('modal-recibo-devolucao');

        // Abre devolução (desktop e mobile)
        [$('btn-abrir-devolucao'), $('btn-abrir-devolucao-mob')].forEach(btn => {
            if (btn) btn.onclick = () => {
                if (!state.sessaoId) { mostrarToast("Abra o caixa primeiro.", "aviso"); return; }
                resetarFormDevolucao();
                abrirModal(modal);
            };
        });

        const btnFch = $('btn-fechar-devolucao'); if (btnFch) btnFch.onclick = () => fecharModal(modal);
        const btnCanc = $('btn-cancelar-devolucao'); if (btnCanc) btnCanc.onclick = () => fecharModal(modal);

        // Seletor de tipo
        $$('.btn-tipo-dev').forEach(b => {
            b.onclick = () => {
                $$('.btn-tipo-dev').forEach(x => {
                    x.classList.remove('bg-white', 'text-black', 'border-white');
                    x.classList.add('bg-transparent', 'text-gray-400', 'border-brand-border');
                });
                b.classList.add('bg-white', 'text-black', 'border-white');
                b.classList.remove('bg-transparent', 'text-gray-400', 'border-brand-border');
                const inp = $('dev-tipo'); if (inp) inp.value = b.dataset.tipo;
            };
        });

        // Adicionar item manualmente
        const btnAddItemManual = $('btn-add-item-dev');
        if (btnAddItemManual) btnAddItemManual.onclick = () => adicionarItemDevolucao();

        // Scanner/bipar produto na devolução (sem filtro de estoque!)
        const inputDevScan = $('dev-scan-input');
        const btnDevBuscar = $('btn-dev-buscar-produto');

        async function buscarProdutoDevolucao(termo) {
            if (!termo) return;
            try {
                const h = await window.authManager.getAuthHeaders();
                // Busca produto por nome ou SKU
                const res = await fetch(`${window.authManager.apiUrl}/api/produtos?q=${encodeURIComponent(termo)}&pageSize=20`, { headers: h });
                const d = await res.json();
                if (!d.success || !d.data?.length) { mostrarToast("Produto não encontrado.", "aviso"); return; }

                const produto = d.data[0];
                // Carrega TODAS as variantes (sem filtro de estoque — devolução aceita qualquer)
                const resV = await fetch(`${window.authManager.apiUrl}/api/produtos/${produto.id}/variantes`, { headers: h });
                const dV = await resV.json();
                const variantes = (dV.data || []).filter(v => v.ativo !== 0); // só filtra inativo, não estoque

                if (!variantes.length) { mostrarToast("Produto sem variantes.", "aviso"); return; }

                if (variantes.length === 1) {
                    adicionarItemDevolucaoFromAPI(produto, variantes[0]);
                } else {
                    abrirVariantesDevModal(produto, variantes);
                }
                if (inputDevScan) inputDevScan.value = '';
            } catch { mostrarToast("Erro ao buscar produto.", "erro"); }
        }

        if (inputDevScan) {
            inputDevScan.addEventListener('keydown', e => {
                if (e.key === 'Enter') buscarProdutoDevolucao(inputDevScan.value.trim());
            });
        }
        if (btnDevBuscar) btnDevBuscar.onclick = () => buscarProdutoDevolucao(inputDevScan?.value?.trim() || '');

        // Confirmar devolução
        const btnConf = $('btn-confirmar-devolucao');
        if (btnConf) btnConf.onclick = async () => {
            const tipo = $('dev-tipo')?.value || 'devolucao';
            const motivo = $('dev-motivo')?.value?.trim();
            const valor = parseFloat($('dev-valor')?.value) || 0;
            const clienteNome = $('dev-cliente-nome')?.value?.trim() || '';
            const formaReembolso = $('dev-forma-reembolso')?.value || 'dinheiro';

            if (!motivo) { mostrarToast("Informe o motivo.", "aviso"); return; }

            const itensDevolvidos = coletarItensDevolucao();

            try {
                const h = await window.authManager.getAuthHeaders();

                // 1 — Entrada de estoque das variantes devolvidas (devolução física)
                const itensCom = itensDevolvidos.filter(i => i.varId && i.qtd > 0);
                if (itensCom.length > 0) {
                    const resEstoque = await Promise.all(itensCom.map(item =>
                        fetch(`${window.authManager.apiUrl}/api/estoque/movimentos`, {
                            method: 'POST', headers: h,
                            body: JSON.stringify({
                                variante_id: item.varId, tipo: 'devolucao', quantidade: item.qtd,
                                motivo: `${tipo}: ${motivo}`, referencia_tipo: 'devolucao', usuario_id: state.usuario.id
                            })
                        }).then(r => r.json())
                    ));
                    const falha = resEstoque.find(r => !r.success);
                    if (falha) { mostrarToast(falha.message || "Erro ao estornar estoque.", "aviso"); /* não bloqueia */ }
                }

                // 2 — Saída no caixa (reembolso em dinheiro/pix/cartão)
                if (valor > 0 && formaReembolso !== 'troca' && formaReembolso !== 'credito_loja') {
                    const descDev = `${tipo === 'cancelamento' ? 'CANCELAMENTO' : tipo === 'troca' ? 'TROCA' : 'DEVOLUÇÃO'} — ${clienteNome || 'Cliente'}: ${motivo.substring(0, 50)}`;
                    const resDev = await fetch(`${window.authManager.apiUrl}/api/caixa/lancamentos`, {
                        method: 'POST', headers: h,
                        body: JSON.stringify({
                            filial_id: state.filialId, sessao_id: state.sessaoId,
                            tipo: 'saida', descricao: descDev, valor,
                            forma_pagamento: formaReembolso === 'pix' ? 'pix' : formaReembolso === 'cartao' ? 'cartao' : 'dinheiro',
                            origem: 'reembolso', usuario_vendedor_id: state.usuario.id
                        })
                    });
                    const dDev = await resDev.json();
                    if (!dDev.success) { mostrarToast(dDev.message || "Erro ao registrar saída no caixa.", "erro"); return; }
                }

                fecharModal(modal);
                mostrarToast("Devolução registrada com sucesso!");
                gerarNotaDevolucao({ tipo, motivo, clienteNome, valor, formaReembolso, itensDevolvidos });

            } catch (e) { logErroVisual("Falha ao registrar devolução: " + e.message); }
        };

        // Recibo devolução
        const btnFchRD = $('btn-fechar-recibo-dev'); if (btnFchRD) btnFchRD.onclick = () => fecharModal(modalRecibo);
        const btnFchRDB = $('btn-fechar-recibo-dev-btn'); if (btnFchRDB) btnFchRDB.onclick = () => fecharModal(modalRecibo);
        const btnImpD = $('btn-imprimir-dev'); if (btnImpD) btnImpD.onclick = () => window.print();
    }

    // Modal de seleção de variante para devolução
    function abrirVariantesDevModal(produto, variantes) {
        // Reusa o modal de variantes existente com callback especial
        const modal = $('modal-selecionar-variante');
        const pFinal = produto.desconto_percent > 0 ? produto.preco * (1 - produto.desconto_percent / 100) : produto.preco;
        const foto = $('v-foto-produto'); if (foto) { foto.src = produto.imagens?.[0]?.url || 'logo.png'; foto.onerror = () => foto.src = 'logo.png'; }
        const nome = $('v-nome-produto'); if (nome) nome.textContent = produto.nome;
        const preco = $('v-preco-produto'); if (preco) preco.textContent = `${fmt(pFinal)} — Selecione para devolução`;
        const lista = $('lista-variantes-pdv');
        if (lista) {
            lista.innerHTML = '';
            variantes.forEach(v => {
                const btn = document.createElement('button');
                btn.className = "w-full p-3.5 bg-brand-gray border border-brand-border hover:border-white rounded-xl flex justify-between items-center transition-all";
                // Mostra estoque mesmo que seja 0 (para devolução)
                const estoqueLabel = v.estoque === 0 ? '<span style="color:#f87171">Sem estoque</span>' : `${v.estoque} un`;
                btn.innerHTML = `<span class="text-sm font-medium text-white">${v.tamanho || '-'} / ${v.cor || '-'}</span>
                    <span class="text-[10px] text-gray-400 font-mono">${estoqueLabel}</span>`;
                btn.onclick = () => { adicionarItemDevolucaoFromAPI(produto, v); fecharModal(modal); };
                lista.appendChild(btn);
            });
        }
        const btnF = $('btn-fechar-variantes');
        if (btnF) btnF.onclick = () => fecharModal(modal);
        abrirModal(modal);
    }

    function adicionarItemDevolucaoFromAPI(produto, variante) {
        const pFinal = produto.desconto_percent > 0 ? produto.preco * (1 - produto.desconto_percent / 100) : produto.preco;
        adicionarItemDevolucao(produto.nome, variante.tamanho || '', variante.cor || '', 1, variante.id, pFinal);
        // Auto-preenche valor se não tiver
        const inputVal = $('dev-valor');
        if (inputVal && (!inputVal.value || parseFloat(inputVal.value) === 0)) {
            inputVal.value = pFinal.toFixed(2);
        }
        mostrarToast(`${produto.nome} adicionado à devolução`);
    }

    let _devItemIndex = 0;
    function resetarFormDevolucao() {
        _devItemIndex = 0;
        const c = $('dev-itens-container'); if (c) c.innerHTML = '';
        const m = $('dev-motivo'); if (m) m.value = '';
        const v = $('dev-valor'); if (v) v.value = '';
        const cn = $('dev-cliente-nome'); if (cn) cn.value = '';
        const si = $('dev-scan-input'); if (si) si.value = '';
        $$('.btn-tipo-dev').forEach(x => {
            x.classList.remove('bg-white', 'text-black', 'border-white');
            x.classList.add('bg-transparent', 'text-gray-400', 'border-brand-border');
        });
        const primeiro = document.querySelector('.btn-tipo-dev[data-tipo="devolucao"]');
        if (primeiro) { primeiro.classList.add('bg-white', 'text-black', 'border-white'); primeiro.classList.remove('bg-transparent', 'text-gray-400', 'border-brand-border'); }
        const ti = $('dev-tipo'); if (ti) ti.value = 'devolucao';
    }

    function adicionarItemDevolucao(nome = '', tamanho = '', cor = '', qtd = 1, varId = null, preco = 0) {
        const idx = _devItemIndex++;
        const container = $('dev-itens-container');
        if (!container) return;
        const div = document.createElement('div');
        div.id = `dev-item-${idx}`;
        div.className = "bg-brand-gray border border-brand-border rounded-xl p-3 space-y-2";
        div.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="text-[9px] uppercase text-gray-500 tracking-widest font-semibold flex items-center gap-1">
                    <span class="material-icons-outlined text-xs">inventory_2</span> Item ${idx + 1}
                    ${varId ? `<span class="text-green-500 text-[8px]">• vinculado</span>` : ''}
                </span>
                <button type="button" onclick="document.getElementById('dev-item-${idx}').remove()" class="text-gray-600 hover:text-red-400 transition-colors">
                    <span class="material-icons-outlined text-sm">close</span>
                </button>
            </div>
            <input type="text" data-dev-nome placeholder="Nome do produto" value="${nome}"
                class="input-dark text-sm" style="padding:0.5rem 0.75rem">
            <div class="grid grid-cols-3 gap-2">
                <input type="text" data-dev-tamanho placeholder="Tam." value="${tamanho}"
                    class="input-dark text-xs text-center" style="padding:0.5rem 0.5rem">
                <input type="text" data-dev-cor placeholder="Cor" value="${cor}"
                    class="input-dark text-xs text-center" style="padding:0.5rem 0.5rem">
                <input type="number" data-dev-qtd min="1" value="${qtd}" placeholder="Qtd"
                    class="input-dark text-xs text-center font-mono" style="padding:0.5rem 0.5rem">
            </div>
            <input type="hidden" data-dev-varid value="${varId || ''}">
            <input type="hidden" data-dev-preco value="${preco || 0}">`;
        container.appendChild(div);
        // Foca na quantidade para ajuste rápido
        setTimeout(() => div.querySelector('[data-dev-qtd]')?.focus(), 100);
    }

    function coletarItensDevolucao() {
        const container = $('dev-itens-container');
        if (!container) return [];
        const itens = [];
        container.querySelectorAll('[id^="dev-item-"]').forEach(div => {
            itens.push({
                nome: div.querySelector('[data-dev-nome]')?.value || '',
                tamanho: div.querySelector('[data-dev-tamanho]')?.value || '',
                cor: div.querySelector('[data-dev-cor]')?.value || '',
                qtd: parseInt(div.querySelector('[data-dev-qtd]')?.value) || 1,
                varId: parseInt(div.querySelector('[data-dev-varid]')?.value) || null,
                preco: parseFloat(div.querySelector('[data-dev-preco]')?.value) || 0
            });
        });
        return itens;
    }

    function gerarNotaDevolucao({ tipo, motivo, clienteNome, valor, formaReembolso, itensDevolvidos }) {
        const area = $('area-impressao-devolucao'), modal = $('modal-recibo-devolucao');
        if (!area || !modal) return;

        const agora = new Date();
        const data = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const operador = state.usuario?.nome_completo || 'Operador';

        const tipoLabel = { devolucao: 'DEVOLUÇÃO', troca: 'TROCA', cancelamento: 'CANCELAMENTO' }[tipo] || tipo.toUpperCase();
        const formaLabel = { dinheiro: 'DINHEIRO', pix: 'PIX', cartao: 'CARTÃO', troca: 'TROCA DE PRODUTO', credito_loja: 'CRÉDITO NA LOJA' }[formaReembolso] || formaReembolso.toUpperCase();

        const sep = (char = '─') => `<div style="letter-spacing:1.5px;color:#ccc;text-align:center;margin:3px 0">${char.repeat(36)}</div>`;
        const dashed = () => `<div style="border-top:1px dashed #aaa;margin:3px 0"></div>`;

        const itensHtml = itensDevolvidos.length > 0
            ? itensDevolvidos.map(i => `
                <div style="margin-bottom:4px;font-size:7.5pt">
                    <div style="font-weight:bold;text-transform:uppercase;line-height:1.3">${i.nome || 'Item'}</div>
                    ${i.tamanho || i.cor ? `<div style="font-size:7pt;color:#666">${[i.tamanho, i.cor].filter(Boolean).join(' / ')}</div>` : ''}
                    <div style="display:flex;justify-content:space-between">
                        <span>${i.qtd} un</span>
                        ${i.preco > 0 ? `<span style="font-weight:bold">${fmt(i.preco * i.qtd)}</span>` : ''}
                    </div>
                </div>`).join('')
            : `<div style="font-size:7pt;color:#888;text-align:center;padding:4px 0">Nenhum item registrado</div>`;

        area.innerHTML = `
<div style="font-family:'Courier New',Courier,monospace;font-size:7.5pt;color:#000;width:100%;line-height:1.4;padding:4mm 2mm;box-sizing:border-box">
  <div style="text-align:center;margin-bottom:4px">
    <div style="font-size:14pt;font-weight:900;letter-spacing:3px;line-height:1">BOUTIQUE</div>
    <div style="font-size:14pt;font-weight:900;letter-spacing:3px;line-height:1.1">DINIZ</div>
    <div style="font-size:6.5pt;letter-spacing:4px;color:#777;text-transform:uppercase;margin-top:2px">Moda Feminina</div>
  </div>
  ${sep('═')}
  <div style="text-align:center;margin:4px 0">
    <div style="font-size:10pt;font-weight:900;letter-spacing:2px;color:#c00000">NOTA DE ${tipoLabel}</div>
    <div style="font-size:6.5pt;color:#888;margin-top:1px">${data}  ${hora}</div>
    <div style="font-size:6.5pt;color:#888">Op: ${operador} | Cx #${state.sessaoId || '—'}</div>
  </div>
  ${sep()}
  <div style="margin-bottom:3px;font-size:7pt">
    <div style="font-weight:bold;font-size:7.5pt;margin-bottom:1px">▸ CLIENTE</div>
    <div>${clienteNome || 'NÃO INFORMADO'}</div>
  </div>
  ${dashed()}
  <div style="margin-bottom:3px">
    <div style="font-weight:bold;font-size:7pt;letter-spacing:1px;margin-bottom:3px;color:#555">ITENS DEVOLVIDOS</div>
    ${itensHtml}
  </div>
  ${sep()}
  <div style="font-size:7pt;margin-bottom:4px">
    <div style="font-weight:bold;margin-bottom:1px">▸ MOTIVO</div>
    <div style="color:#444;line-height:1.4">${motivo}</div>
  </div>
  ${valor > 0 ? `
  <div style="border-top:2px solid #c00000;border-bottom:2px solid #c00000;padding:4px 0;margin-bottom:4px">
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <span style="font-size:9pt;font-weight:900;letter-spacing:1px;color:#c00000">REEMBOLSO</span>
      <span style="font-size:12pt;font-weight:900;color:#c00000">${fmt(valor)}</span>
    </div>
    <div style="text-align:right;font-size:7pt;font-weight:bold;color:#666;margin-top:1px">${formaLabel}</div>
  </div>` : `
  <div style="border-top:1px dashed #aaa;padding-top:3px;margin-bottom:4px;text-align:center;font-size:7pt;color:#666">
    ${formaLabel} — Sem valor monetário
  </div>`}
  ${sep('═')}
  <div style="text-align:center;font-size:6.5pt;color:#666;line-height:1.8">
    <div style="font-weight:bold">Documento de ${tipoLabel}</div>
    <div style="color:#aaa">Boutique Diniz — Moda Feminina</div>
    <div style="color:#bbb;font-size:6pt">${data}  ${hora}</div>
  </div>
</div>`;

        abrirModal(modal);
    }


    // ─── 12. MOBILE DRAWER ────────────────────────────────────────────────────
    function setupMobileDrawer() {
        const painel = $('painel-carrinho'), overlay = $('cart-overlay');
        const btnTog = $('btn-toggle-cart'), btnClose = $('btn-close-cart');
        const abrir = () => { painel?.classList.remove('translate-x-full'); overlay?.classList.remove('hidden'); };
        const fechar = () => { painel?.classList.add('translate-x-full'); overlay?.classList.add('hidden'); };
        if (btnTog) btnTog.onclick = abrir;
        if (btnClose) btnClose.onclick = fechar;
        if (overlay) overlay.onclick = fechar;
    }

    function setupBotoesMobileBarra() {
        const btnLanMob = $('btn-abrir-lancamento-mob');
        if (btnLanMob) btnLanMob.onclick = () => {
            if (!state.sessaoId) { mostrarToast("Abra o caixa primeiro.", "aviso"); return; }
            abrirModal($('modal-lancamento'));
        };
        const btnFchMob = $('btn-abrir-modal-fechar-mob');
        if (btnFchMob) btnFchMob.onclick = () => {
            if (!state.sessaoId) { mostrarToast("Nenhum caixa aberto.", "aviso"); return; }
            abrirModal($('modal-fechar-caixa'));
        };
        const btnDevMob = $('btn-abrir-devolucao-mob');
        if (btnDevMob) btnDevMob.onclick = () => {
            if (!state.sessaoId) { mostrarToast("Abra o caixa primeiro.", "aviso"); return; }
            resetarFormDevolucao();
            abrirModal($('modal-devolucao'));
        };
    }

    // ─── START ────────────────────────────────────────────────────────────────
    init();
});
