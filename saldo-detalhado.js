/**
 * SALDO DETALHADO — Boutique Diniz
 * Usa window.authManager (mesmo padrão do PDV) para autenticação.
 */

document.addEventListener('DOMContentLoaded', () => {

    // ─── Estado ───────────────────────────────────────────────────────────────
    let usuario        = null;
    let sessaoAtual    = null;
    let todosLanc      = [];
    let paginaAtual    = 1;
    const POR_PAGINA   = 15;

    // ─── Helpers ──────────────────────────────────────────────────────────────
    const $   = id => document.getElementById(id);
    const fmt = v  => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    function fmtDataHora(iso) {
        if (!iso) return '—';
        return new Date(iso).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function fmtHora(iso) {
        if (!iso) return '—';
        return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    function mostrar(id) { const el = $(id); if (el) el.classList.remove('hidden'); }
    function ocultar(id) { const el = $(id); if (el) el.classList.add('hidden'); }

    // ─── Valida authManager (token.js deve ser carregado antes deste script) ──
    function validarAuth() {
        if (typeof window.authManager === 'undefined') {
            throw new Error('token.js não foi carregado. Verifique a ordem dos scripts no HTML.');
        }
    }

    // ─── Sessão do usuário logado ─────────────────────────────────────────────
    function carregarUsuario() {
        const str = sessionStorage.getItem('usuario');
        if (!str) { window.location.href = 'login.html'; return false; }
        usuario = JSON.parse(str);

        const nome = usuario.nome_completo || 'Usuário';
        const elNome = $('topbar-user-name');
        if (elNome) elNome.textContent = nome;
        const elIni = $('topbar-user-initial');
        if (elIni) elIni.textContent = nome.charAt(0).toUpperCase();
        const elRole = $('topbar-user-role');
        const grupos = { 1: 'Administrador', 2: 'Vendas', 3: 'Financeiro' };
        if (elRole) elRole.textContent = grupos[usuario.grupo_acesso_id] || 'Colaborador';

        return true;
    }

    // ─── Loading / estados visuais ────────────────────────────────────────────
    function setLoading(on) {
        if (on) {
            mostrar('estado-loading');
            ocultar('resumo-container');
            ocultar('lancamentos-container');
            ocultar('sessoes-container');
            ocultar('estado-vazio');
        } else {
            ocultar('estado-loading');
        }
    }

    function mostrarVazio(msg) {
        const el = $('estado-vazio-msg');
        if (el) el.textContent = msg || 'Nenhuma sessão encontrada.';
        mostrar('estado-vazio');
        ocultar('resumo-container');
        ocultar('lancamentos-container');
        ocultar('sessoes-container');
    }

    // ─── Buscar sessões na API ─────────────────────────────────────────────────
    async function buscarSessoes() {
        const data   = $('filtro-data').value;
        const status = $('filtro-status').value;

        setLoading(true);

        try {
            const h = await window.authManager.getAuthHeaders();

            let url = `${window.authManager.apiUrl}/api/caixa/sessoes?pageSize=50`;
            if (usuario.filial_id) url += `&filial_id=${usuario.filial_id}`;
            if (status)            url += `&status=${encodeURIComponent(status)}`;
            if (data)              url += `&data_inicio=${data}&data_fim=${data}`;

            const res  = await fetch(url, { headers: h });
            const json = await res.json();

            setLoading(false);

            if (!json.success || !json.data || json.data.length === 0) {
                mostrarVazio('Nenhuma sessão encontrada para os filtros selecionados.');
                return;
            }

            const sessoes = json.data;

            if (sessoes.length === 1) {
                await carregarDetalhe(sessoes[0].id);
            } else {
                renderizarSessoes(sessoes);
            }

        } catch (e) {
            setLoading(false);
            mostrarVazio('Erro ao carregar sessões. Verifique sua conexão.');
            console.error('[SaldoDetalhado] buscarSessoes:', e);
        }
    }

    // ─── Seletor de sessões (quando há mais de uma) ───────────────────────────
    function renderizarSessoes(sessoes) {
        const lista = $('sessoes-lista');
        if (!lista) return;
        lista.innerHTML = '';

        const statusMap = {
            aberto:             { label: 'Aberto',          cls: 'status-aberto' },
            pendente_aprovacao: { label: 'Pend. Aprovação', cls: 'status-pendente_aprovacao' },
            aprovado:           { label: 'Aprovado',         cls: 'status-aprovado' },
            fechado:            { label: 'Fechado',          cls: 'status-fechado' },
        };

        sessoes.forEach(s => {
            const sm  = statusMap[s.status] || { label: s.status, cls: 'status-fechado' };
            const btn = document.createElement('button');
            btn.className = 'flex flex-col gap-1.5 px-4 py-3 bg-brand-gray/50 border border-gray-800 rounded-xl hover:border-gray-600 transition-colors text-left';
            btn.innerHTML = `
                <span class="text-[10px] text-gray-500 uppercase tracking-widest">${fmtDataHora(s.aberto_em || s.criado_em)}</span>
                <span class="text-sm text-white font-medium">Sessão #${s.id}</span>
                <span class="${sm.cls} text-[10px] px-2 py-0.5 rounded-full font-medium inline-block">${sm.label}</span>
            `;
            btn.addEventListener('click', () => carregarDetalhe(s.id));
            lista.appendChild(btn);
        });

        mostrar('sessoes-container');
        const sc = $('sessoes-container');
        if (sc) sc.classList.remove('opacity-0');
    }

    // ─── Carrega detalhe de uma sessão ────────────────────────────────────────
    async function carregarDetalhe(sessaoId) {
        setLoading(true);

        try {
            const h    = await window.authManager.getAuthHeaders();
            const res  = await fetch(`${window.authManager.apiUrl}/api/caixa/sessoes/${sessaoId}`, { headers: h });
            const json = await res.json();

            setLoading(false);

            if (!json.success || !json.data) {
                mostrarVazio('Não foi possível carregar o detalhe desta sessão.');
                return;
            }

            sessaoAtual = json.data;
            todosLanc   = sessaoAtual.lancamentos || [];
            paginaAtual = 1;

            renderizarResumo(sessaoAtual);
            renderizarTabela();

            mostrar('resumo-container');
            mostrar('lancamentos-container');
            const rc = $('resumo-container');
            const lc = $('lancamentos-container');
            if (rc) rc.classList.remove('opacity-0');
            if (lc) lc.classList.remove('opacity-0');

        } catch (e) {
            setLoading(false);
            mostrarVazio('Erro ao carregar os detalhes da sessão.');
            console.error('[SaldoDetalhado] carregarDetalhe:', e);
        }
    }

    // ─── Renderiza cards de resumo ────────────────────────────────────────────
    function renderizarResumo(d) {
        const entradas = parseFloat(d.total_entradas) || 0;
        const saidas   = parseFloat(d.total_saidas)   || 0;
        const saldo    = d.saldo != null ? parseFloat(d.saldo) : (entradas - saidas);

        const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };

        set('card-saldo',    fmt(saldo));
        set('card-entradas', fmt(entradas));
        set('card-saidas',   fmt(saidas));

        // Breakdown por forma (calcula a partir dos lançamentos)
        const bp = { pix: 0, cartao: 0, dinheiro: 0 };
        (d.lancamentos || []).forEach(l => {
            if (l.tipo !== 'entrada') return;
            const f = (l.forma_pagamento || '').toLowerCase();
            const v = parseFloat(l.valor) || 0;
            if (f.includes('pix'))                            bp.pix     += v;
            else if (f.includes('cart') || f === 'cartao')   bp.cartao  += v;
            else if (f.includes('din'))                       bp.dinheiro+= v;
        });
        set('card-pix',      fmt(bp.pix));
        set('card-cartao',   fmt(bp.cartao));
        set('card-dinheiro', fmt(bp.dinheiro));

        // Status badge
        const statusMap = {
            aberto:             { label: 'Aberto',          cls: 'status-aberto' },
            pendente_aprovacao: { label: 'Pend. Aprovação', cls: 'status-pendente_aprovacao' },
            aprovado:           { label: 'Aprovado',         cls: 'status-aprovado' },
            fechado:            { label: 'Fechado',          cls: 'status-fechado' },
        };
        const sm    = statusMap[d.status] || { label: d.status || '—', cls: 'status-fechado' };
        const badge = $('card-status-badge');
        if (badge) badge.className = `mt-2 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${sm.cls}`;
        set('card-status-label', sm.label);

        // Infos do rodapé
        set('info-filial',       `Filial ${d.filial_id || usuario?.filial_id || '—'}`);
        set('info-abertura',     fmtDataHora(d.aberto_em || d.criado_em));
        set('info-val-abertura', fmt(d.valor_abertura));

        const wrapFech = $('info-fechamento-wrap');
        if (d.fechado_em) {
            set('info-fechamento', fmtDataHora(d.fechado_em));
            if (wrapFech) wrapFech.style.display = '';
        } else {
            if (wrapFech) wrapFech.style.display = 'none';
        }
    }

    // ─── Filtra lançamentos (tipo + forma) ────────────────────────────────────
    function getLancFiltrados() {
        const tipo  = $('filtro-tipo-lancamento').value;
        const forma = $('filtro-forma-lancamento').value;
        return todosLanc.filter(l => {
            if (tipo  && l.tipo !== tipo)                                    return false;
            if (forma && (l.forma_pagamento || '').toLowerCase() !== forma)  return false;
            return true;
        });
    }

    // ─── Renderiza tabela de lançamentos ──────────────────────────────────────
    function renderizarTabela() {
        const tbody     = $('tabela-lancamentos');
        if (!tbody) return;

        const filtrados = getLancFiltrados();
        const total     = filtrados.length;
        const totPag    = Math.max(1, Math.ceil(total / POR_PAGINA));
        if (paginaAtual > totPag) paginaAtual = totPag;

        const ini    = (paginaAtual - 1) * POR_PAGINA;
        const fim    = Math.min(ini + POR_PAGINA, total);
        const pagina = filtrados.slice(ini, fim);

        const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
        set('total-lancamentos-label', `${total} lançamento${total !== 1 ? 's' : ''}`);
        set('paginacao-info',          `Exibindo ${total === 0 ? 0 : ini + 1}–${fim} de ${total}`);
        set('paginacao-paginas',       `Pág. ${paginaAtual} / ${totPag}`);

        const btnPrev = $('btn-prev');
        const btnNext = $('btn-next');
        if (btnPrev) btnPrev.disabled = paginaAtual <= 1;
        if (btnNext) btnNext.disabled = paginaAtual >= totPag;

        if (pagina.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-12 text-gray-600 text-xs">
                        <span class="material-icons block text-2xl mb-2 mx-auto">search_off</span>
                        Nenhum lançamento para os filtros selecionados.
                    </td>
                </tr>`;
            return;
        }

        const formaLabel = { dinheiro:'Dinheiro', pix:'PIX', cartao:'Cartão', boleto:'Boleto' };
        const formaCls   = { dinheiro:'badge-dinheiro', pix:'badge-pix', cartao:'badge-cartao', boleto:'badge-boleto' };
        const origemLbl  = { venda:'Venda', reembolso:'Reembolso', despesa:'Despesa', outros:'Outros' };

        tbody.innerHTML = pagina.map(l => {
            const saida    = l.tipo === 'saida';
            const tipoCls  = saida ? 'tipo-saida'  : 'tipo-entrada';
            const tipoIcon = saida ? 'south'        : 'north';
            const forma    = (l.forma_pagamento || '').toLowerCase();
            const bCls     = formaCls[forma]   || 'badge-dinheiro';
            const bTxt     = formaLabel[forma] || (l.forma_pagamento || '—');
            const parc     = l.parcelas && l.parcelas > 1 ? ` <span class="opacity-40">(${l.parcelas}x)</span>` : '';

            return `
            <tr class="row-lancamento border-b border-gray-900/50">
                <td class="px-6 py-3.5 text-gray-500 text-xs whitespace-nowrap">${fmtHora(l.criado_em)}</td>
                <td class="px-4 py-3.5">
                    <span class="flex items-center gap-1 text-xs font-semibold ${tipoCls}">
                        <span class="material-icons text-sm">${tipoIcon}</span>
                        ${saida ? 'Saída' : 'Entrada'}
                    </span>
                </td>
                <td class="px-4 py-3.5 text-sm text-gray-300 max-w-[220px] truncate">${l.descricao || '—'}</td>
                <td class="px-4 py-3.5">
                    <span class="text-xs px-2.5 py-1 rounded-full font-medium ${bCls}">${bTxt}${parc}</span>
                </td>
                <td class="px-4 py-3.5 text-xs text-gray-500">${origemLbl[l.origem] || l.origem || '—'}</td>
                <td class="px-6 py-3.5 text-right font-semibold text-sm ${tipoCls} whitespace-nowrap">
                    ${saida ? '−' : '+'} R$ ${fmt(l.valor)}
                </td>
            </tr>`;
        }).join('');
    }

    // ─── Utilitários ──────────────────────────────────────────────────────────
    function setDataHoje() {
        const el = $('filtro-data');
        if (el) el.value = new Date().toISOString().split('T')[0];
    }

    function limpar() {
        setDataHoje();
        const ids = ['filtro-status', 'filtro-tipo-lancamento', 'filtro-forma-lancamento'];
        ids.forEach(id => { const el = $(id); if (el) el.value = ''; });
        sessaoAtual = null;
        todosLanc   = [];
        ocultar('resumo-container');
        ocultar('lancamentos-container');
        ocultar('sessoes-container');
        ocultar('estado-vazio');
    }

    // ─── Bootstrap ────────────────────────────────────────────────────────────
    try {
        if (!carregarUsuario()) return;
        validarAuth();

        setDataHoje();

        const btnBuscar = $('btn-buscar');
        const btnLimpar = $('btn-limpar');
        const filtTipo  = $('filtro-tipo-lancamento');
        const filtForma = $('filtro-forma-lancamento');
        const btnPrev   = $('btn-prev');
        const btnNext   = $('btn-next');

        if (btnBuscar) btnBuscar.addEventListener('click', buscarSessoes);
        if (btnLimpar) btnLimpar.addEventListener('click', limpar);

        if (filtTipo)  filtTipo.addEventListener('change',  () => { paginaAtual = 1; renderizarTabela(); });
        if (filtForma) filtForma.addEventListener('change', () => { paginaAtual = 1; renderizarTabela(); });

        if (btnPrev) btnPrev.addEventListener('click', () => {
            if (paginaAtual > 1) { paginaAtual--; renderizarTabela(); }
        });
        if (btnNext) btnNext.addEventListener('click', () => {
            const tot = Math.ceil(getLancFiltrados().length / POR_PAGINA);
            if (paginaAtual < tot) { paginaAtual++; renderizarTabela(); }
        });

        // Carrega automaticamente ao abrir (sessão de hoje)
        buscarSessoes();

    } catch (e) {
        console.error('[SaldoDetalhado] init:', e);
        mostrarVazio('Erro de inicialização: ' + e.message);
    }

});
