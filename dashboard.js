/**
 * DASHBOARD — Boutique Diniz
 * Busca dados reais via window.authManager (token.js).
 * Endpoints utilizados:
 *  - GET /api/financeiro/dashboard   → caixas, contas pagar/receber
 *  - GET /api/caixa/resumo           → entradas/saídas do dia
 *  - GET /api/caixa/sessoes          → lista caixas abertos hoje
 *  - GET /api/pedidos                → pedidos recentes + total de hoje
 *  - GET /api/estoque/alertas        → produtos com estoque baixo
 *  - GET /api/estoque/resumo         → totais de produtos/variantes/itens
 */

document.addEventListener('DOMContentLoaded', () => {

    // ─── Helpers ──────────────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v ?? '—'; };

    function fmt(v) {
        const n = parseFloat(v) || 0;
        return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtNum(v) { return (parseInt(v) || 0).toLocaleString('pt-BR'); }

    function hoje() { return new Date().toISOString().split('T')[0]; }

    function fmtDataHora(iso) {
        if (!iso) return '—';
        return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    }

    // ─── Relógio/data no header ────────────────────────────────────────────────
    function iniciarRelogio() {
        const dias  = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
        const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        function atualizar() {
            const now = new Date();
            const data = $('dash-data');
            const hora = $('dash-hora');
            if (data) data.textContent = `${dias[now.getDay()]}, ${now.getDate()} ${meses[now.getMonth()]}`;
            if (hora) hora.textContent = now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        }
        atualizar();
        setInterval(atualizar, 1000);
    }

    // ─── Usuário logado ────────────────────────────────────────────────────────
    let usuario = null;

    function carregarUsuario() {
        const str = sessionStorage.getItem('usuario');
        if (!str) { window.location.href = 'login.html'; return false; }
        usuario = JSON.parse(str);

        const nome = usuario.nome_completo || 'Usuário';
        set('topbar-user-name', nome.split(' ')[0]);
        set('topbar-user-initial', nome.charAt(0).toUpperCase());

        const grupos = { 1: 'Administrador', 2: 'Equipe Vendas', 3: 'Financeiro' };
        set('topbar-user-role', grupos[usuario.grupo_acesso_id] || 'Colaborador');

        const labelFilial = $('label-filial');
        if (labelFilial) {
            labelFilial.textContent = `Filial #${usuario.filial_id || 'Todas'}`;
        }
        return true;
    }

    // ─── Animação de número ────────────────────────────────────────────────────
    function animarNumero(el, valorFinal, moeda = true) {
        if (!el) return;
        const dur = 1200;
        const fps = 30;
        const frames = Math.round((dur / 1000) * fps);
        let frame = 0;
        const timer = setInterval(() => {
            frame++;
            const prog = frame / frames;
            const cur = valorFinal * (1 - Math.pow(1 - prog, 3));
            el.textContent = moeda
                ? cur.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : Math.floor(cur).toLocaleString('pt-BR');
            if (frame >= frames) {
                clearInterval(timer);
                el.textContent = moeda
                    ? valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : Math.floor(valorFinal).toLocaleString('pt-BR');
            }
        }, 1000 / fps);
    }

    // ─── Refresh visual no botão ───────────────────────────────────────────────
    let girando = false;
    function setRefreshing(on) {
        girando = on;
        const ic = $('refresh-icon');
        if (!ic) return;
        ic.style.transition = 'transform 0.6s ease';
        if (on) {
            ic.style.animation = 'spin 0.8s linear infinite';
            ic.style.cssText += 'animation: spin 0.8s linear infinite; display:inline-block;';
            // fallback simples
            ic.style.transform = 'rotate(360deg)';
        } else {
            ic.style.animation = '';
            ic.style.transform = '';
        }
    }

    // ─── Chamada à API ─────────────────────────────────────────────────────────
    async function api(path) {
        const h = await window.authManager.getAuthHeaders();
        const res = await fetch(`${window.authManager.apiUrl}${path}`, { headers: h });
        return res.json();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BLOCO 1 — Dashboard Financeiro
    // GET /api/financeiro/dashboard
    // ──────────────────────────────────────────────────────────────────────────
    async function carregarDashFinanceiro() {
        try {
            const d = await api('/api/financeiro/dashboard');
            if (!d.success) return;
            const data = d.data;

            // Caixas
            const abertos   = data.caixas?.abertos ?? 0;
            const pendentes = data.caixas?.pendentes_aprovacao ?? 0;
            const abEl = $('dash-caixas-abertos');
            const pEl  = $('dash-caixas-pendentes');
            if (abEl) abEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-green-400 inline-block"></span>${abertos} aberto(s)`;
            if (pEl)  pEl.innerHTML  = `<span class="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>${pendentes} pend.`;

            // Contas a pagar
            const pagar7d    = data.contas_pagar?.vencendo_7_dias;
            const pagarVenc  = data.contas_pagar?.vencidas;
            animarNumero($('pagar-7dias-valor'), parseFloat(pagar7d?.total) || 0);
            set('pagar-7dias-badge', `${pagar7d?.quantidade ?? 0} contas`);
            aplicarBadge('pagar-7dias-badge', pagar7d?.quantidade);

            animarNumero($('pagar-vencidas-valor'), parseFloat(pagarVenc?.total) || 0);
            set('pagar-vencidas-badge', `${pagarVenc?.quantidade ?? 0} contas`);
            aplicarBadge('pagar-vencidas-badge', pagarVenc?.quantidade, true);

            // Contas a receber
            const receber = data.contas_receber?.pendentes;
            animarNumero($('receber-valor'), parseFloat(receber?.total) || 0);
            set('receber-badge', `${receber?.quantidade ?? 0} contas`);
            aplicarBadge('receber-badge', receber?.quantidade);

        } catch (e) {
            console.error('[Dashboard] financeiro:', e);
        }
    }

    function aplicarBadge(id, qtd, isAlerta = false) {
        const el = $(id);
        if (!el) return;
        el.className = 'text-[10px] px-2.5 py-1 rounded-full font-medium';
        if (isAlerta && qtd > 0) el.classList.add('badge-alert');
        else if (qtd > 0)        el.classList.add('badge-warn');
        else                     el.classList.add('badge-ok');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BLOCO 2 — Resumo do Caixa (entradas/saídas do dia)
    // GET /api/caixa/resumo
    // ──────────────────────────────────────────────────────────────────────────
    async function carregarResumoCaixa() {
        try {
            const filialParam = usuario?.filial_id ? `&filial_id=${usuario.filial_id}` : '';
            const d = await api(`/api/caixa/resumo?data_inicio=${hoje()}&data_fim=${hoje()}${filialParam}`);
            if (!d.success) return;

            const entradas = parseFloat(d.data?.total_entradas) || 0;
            const saidas   = parseFloat(d.data?.total_saidas)   || 0;

            animarNumero($('card-vendas-loja'), entradas);
            set('card-vendas-loja-sub', `${fmt(saidas)} em saídas`);

            animarNumero($('caixa-entradas-hoje'), entradas);
            animarNumero($('caixa-saidas-hoje'),   saidas);

        } catch (e) { console.error('[Dashboard] resumoCaixa:', e); }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BLOCO 3 — Sessões de Caixa hoje
    // GET /api/caixa/sessoes
    // ──────────────────────────────────────────────────────────────────────────
    async function carregarSessoesCaixa() {
        try {
            const filialParam = usuario?.filial_id ? `&filial_id=${usuario.filial_id}` : '';
            const d = await api(`/api/caixa/sessoes?data_inicio=${hoje()}&data_fim=${hoje()}&pageSize=20${filialParam}`);
            const lista = $('lista-caixas');
            if (!lista) return;

            if (!d.success || !d.data?.length) {
                lista.innerHTML = `<p class="text-xs text-gray-600 py-4 text-center">Nenhum caixa aberto hoje.</p>`;
                return;
            }

            const statusMap = {
                aberto:             { cls: 'dot-aberto',   label: 'Aberto' },
                pendente_aprovacao: { cls: 'dot-pendente', label: 'Pend. Aprovação' },
                aprovado:           { cls: 'bg-blue-400',  label: 'Aprovado' },
                fechado:            { cls: 'dot-fechado',  label: 'Fechado' },
            };

            lista.innerHTML = d.data.slice(0, 5).map(s => {
                const sm = statusMap[s.status] || { cls: 'dot-fechado', label: s.status };
                return `
                <div class="list-row flex items-center justify-between px-0 py-2.5 text-xs">
                    <div class="flex items-center gap-2.5">
                        <span class="w-2 h-2 rounded-full ${sm.cls} shrink-0"></span>
                        <span class="text-gray-300">Sessão #${s.id}</span>
                    </div>
                    <span class="text-gray-500">${sm.label}</span>
                </div>`;
            }).join('');

        } catch (e) { console.error('[Dashboard] sessoesCaixa:', e); }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BLOCO 4 — Pedidos de hoje (e-commerce)
    // GET /api/pedidos
    // ──────────────────────────────────────────────────────────────────────────
    async function carregarPedidos() {
        try {
            const d = await api(`/api/pedidos?data_inicio=${hoje()}&data_fim=${hoje()}&pageSize=50`);
            if (!d.success) return;

            const todos    = d.data || [];
            const total    = d.meta?.total ?? todos.length;
            const aprovados = todos.filter(p => p.status_pagamento === 'aprovado');
            const somaAprov = aprovados.reduce((acc, p) => acc + (parseFloat(p.total) || 0), 0);

            // Card
            animarNumero($('card-pedidos'), total, false);
            set('card-pedidos-sub', `${aprovados.length} aprovado(s)`);

            // Vendas Site = soma dos pedidos aprovados hoje
            animarNumero($('card-vendas-site'), somaAprov);
            set('card-vendas-site-sub', `${total} pedido(s) no total`);

            // Lista de pedidos recentes
            renderListaPedidos(todos.slice(0, 6));

        } catch (e) { console.error('[Dashboard] pedidos:', e); }
    }

    function renderListaPedidos(pedidos) {
        const lista = $('lista-pedidos');
        if (!lista) return;

        if (!pedidos.length) {
            lista.innerHTML = `<div class="flex flex-col items-center justify-center py-10 text-gray-700">
                <span class="material-icons text-3xl mb-2">receipt_long</span>
                <p class="text-xs uppercase tracking-widest">Nenhum pedido hoje</p>
            </div>`;
            return;
        }

        const statusPedido = {
            novo:       { cls:'badge-info',  label:'Novo' },
            separando:  { cls:'badge-warn',  label:'Separando' },
            enviado:    { cls:'badge-ok',    label:'Enviado' },
            entregue:   { cls:'badge-ok',    label:'Entregue' },
            cancelado:  { cls:'badge-alert', label:'Cancelado' },
        };
        const statusPgto = {
            aguardando: { cls:'badge-warn',  label:'Aguardando' },
            aprovado:   { cls:'badge-ok',    label:'Aprovado' },
            recusado:   { cls:'badge-alert', label:'Recusado' },
            estornado:  { cls:'badge-alert', label:'Estornado' },
        };

        lista.innerHTML = pedidos.map(p => {
            const sp = statusPedido[p.status_pedido]   || { cls:'badge-info', label: p.status_pedido };
            const sg = statusPgto[p.status_pagamento]  || { cls:'badge-info', label: p.status_pagamento };
            return `
            <div class="list-row flex items-center justify-between px-5 py-3 text-xs gap-3">
                <div class="flex items-center gap-2.5 min-w-0">
                    <span class="text-gray-500 font-mono shrink-0">#${p.id}</span>
                    <span class="text-gray-300 truncate">${p.cliente?.nome_completo || 'Cliente'}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="${sg.cls} text-[9px] px-2 py-0.5 rounded-full font-medium">${sg.label}</span>
                    <span class="text-white font-medium font-mono">R$ ${fmt(p.total)}</span>
                </div>
            </div>`;
        }).join('');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BLOCO 5 — Alertas de Estoque
    // GET /api/estoque/alertas
    // ──────────────────────────────────────────────────────────────────────────
    async function carregarAlertasEstoque() {
        try {
            const d = await api('/api/estoque/alertas');
            if (!d.success) return;

            const alertas = d.data || [];
            const qtd     = alertas.length;

            // Card
            animarNumero($('card-estoque-alerta'), qtd, false);
            set('card-estoque-sub', qtd > 0 ? 'produto(s) em risco' : 'Estoque OK');

            // Ícone fica vermelho se tiver alerta
            const icon = $('card-estoque-icon');
            if (icon && qtd > 0) icon.style.color = '#f87171';

            // Lista
            const lista = $('lista-alertas-estoque');
            if (!lista) return;

            if (!alertas.length) {
                lista.innerHTML = `<div class="flex flex-col items-center justify-center py-10 text-gray-700">
                    <span class="material-icons text-3xl mb-2">check_circle</span>
                    <p class="text-xs uppercase tracking-widest">Estoque OK</p>
                </div>`;
                return;
            }

            lista.innerHTML = alertas.slice(0, 6).map(a => {
                const pct     = Math.min(100, Math.round((a.estoque / Math.max(a.estoque_minimo, 1)) * 100));
                const barCls  = pct <= 30 ? 'bg-red-500' : pct <= 70 ? 'bg-yellow-400' : 'bg-green-400';
                return `
                <div class="list-row px-5 py-3 text-xs">
                    <div class="flex justify-between items-center mb-1.5 gap-2">
                        <span class="text-gray-300 truncate flex-1">${a.produto_nome || 'Produto'} <span class="text-gray-600">${a.tamanho || ''} ${a.cor || ''}</span></span>
                        <span class="badge-alert text-[9px] px-2 py-0.5 rounded-full font-medium shrink-0">${a.estoque} / ${a.estoque_minimo}</span>
                    </div>
                    <div class="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div class="bar-fill h-full ${barCls} rounded-full" style="width:${pct}%"></div>
                    </div>
                </div>`;
            }).join('');

        } catch (e) { console.error('[Dashboard] alertasEstoque:', e); }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BLOCO 6 — Resumo do Estoque
    // GET /api/estoque/resumo
    // ──────────────────────────────────────────────────────────────────────────
    async function carregarResumoEstoque() {
        try {
            const d = await api('/api/estoque/resumo');
            if (!d.success) return;
            const r = d.data;

            animarNumero($('resumo-produtos'),  parseFloat(r.total_produtos)  || 0, false);
            animarNumero($('resumo-variantes'), parseFloat(r.total_variantes) || 0, false);
            animarNumero($('resumo-itens'),     parseFloat(r.total_itens_estoque) || 0, false);

            set('resumo-entradas-hoje', fmtNum(r.movimentos_hoje?.entradas));
            set('resumo-saidas-hoje',   fmtNum(r.movimentos_hoje?.saidas));

        } catch (e) { console.error('[Dashboard] resumoEstoque:', e); }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CARREGAR TUDO
    // ──────────────────────────────────────────────────────────────────────────
    async function carregarTudo() {
        if (girando) return;
        setRefreshing(true);
        try {
            await Promise.allSettled([
                carregarDashFinanceiro(),
                carregarResumoCaixa(),
                carregarSessoesCaixa(),
                carregarPedidos(),
                carregarAlertasEstoque(),
                carregarResumoEstoque(),
            ]);
        } finally {
            setRefreshing(false);
        }
    }

    // ─── Init ──────────────────────────────────────────────────────────────────
    if (!carregarUsuario()) return;
    iniciarRelogio();

    // Botão refresh
    const btnRefresh = $('btn-refresh');
    if (btnRefresh) btnRefresh.addEventListener('click', carregarTudo);

    // Aguarda o authManager e carrega
    (async () => {
        let t = 0;
        while (typeof window.authManager === 'undefined' && t < 100) {
            await new Promise(r => setTimeout(r, 50)); t++;
        }
        if (typeof window.authManager === 'undefined') {
            console.error('[Dashboard] token.js não carregou.');
            return;
        }
        await carregarTudo();

        // Auto-refresh a cada 5 minutos
        setInterval(carregarTudo, 5 * 60 * 1000);
    })();

});
