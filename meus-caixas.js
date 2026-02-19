document.addEventListener("DOMContentLoaded", () => {

    const tabelaCaixas       = document.getElementById('tabela-sessoes');
    const modalDetalhes      = document.getElementById('modal-detalhes');
    const btnAbrirFechamento = document.getElementById('btn-abrir-fechamento');
    const modalFecharCaixa   = document.getElementById('modal-fechar-caixa');
    const formFecharCaixa    = document.getElementById('form-fechar-caixa');
    const btnReabrirCaixa    = document.getElementById('btn-reabrir-caixa');
    const modalRea           = document.getElementById('modal-motivo-reabertura');
    const formRea            = document.getElementById('form-motivo-reabertura');

    let sessoesGlobal        = [];
    let sessaoAtivaImpressao = null;
    let usuarioLogadoId      = 1;
    let mapUsuarios          = {};   // id → nome
    let mapFiliais           = {};   // id → nome

    // ─────────────────────────────────────────
    // UTILITÁRIOS
    // ─────────────────────────────────────────
    async function fetchSeguro(url, opts = {}) {
        const ctrl = new AbortController();
        const t    = setTimeout(() => ctrl.abort(), 15000);
        try {
            const r = await fetch(url, { ...opts, signal: ctrl.signal });
            clearTimeout(t); return r;
        } catch(e) { clearTimeout(t); throw e; }
    }

    const R$ = v => parseFloat(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

    function fmtData(d) {
        if (!d) return '--/--/----';
        return new Date(d).toLocaleDateString('pt-BR');
    }
    function fmtDH(d) {
        if (!d) return '--/--/---- --:--';
        const dt = new Date(d);
        return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    }

    function toast(msg, tipo='ok') {
        const t = document.getElementById('toast');
        document.getElementById('toast-msg').textContent  = msg;
        const ic = document.getElementById('toast-icon');
        ic.textContent  = tipo==='erro' ? 'error' : 'check_circle';
        ic.className    = `material-icons ${tipo==='erro' ? 'text-red-500' : 'text-black'}`;
        t.classList.remove('translate-y-20','opacity-0');
        setTimeout(() => t.classList.add('translate-y-20','opacity-0'), 3500);
    }

    function abrirModal(m) { m.classList.remove('hidden'); m.classList.add('flex'); setTimeout(()=>m.classList.remove('opacity-0'),10); }
    function fecharModal(m) { m.classList.add('opacity-0'); setTimeout(()=>{ m.classList.add('hidden'); m.classList.remove('flex'); },300); }

    // ─────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────
    async function init() {
        let i = 0;
        while (typeof window.authManager === 'undefined' && i++ < 30)
            await new Promise(r => setTimeout(r, 100));

        try {
            const uStr = sessionStorage.getItem('usuario');
            if (uStr) {
                const u = JSON.parse(uStr);
                document.getElementById('topbar-user-name').textContent    = u.nome_completo || 'Operador';
                document.getElementById('topbar-user-initial').textContent = (u.nome_completo||'O').charAt(0).toUpperCase();
                usuarioLogadoId = u.id || 1;
            }
            await carregarFiltros();
            carregarSessoes();
        } catch(e) {
            tabelaCaixas.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500 uppercase tracking-widest text-[10px]">Falha de Inicialização</td></tr>`;
        }
    }

    // ─────────────────────────────────────────
    // CARREGAR FILIAIS + OPERADORES
    // ─────────────────────────────────────────
    async function carregarFiltros() {
        try {
            const h = await window.authManager.getAuthHeaders();

            // Filiais
            const rfF = await fetchSeguro(`${window.authManager.apiUrl}/api/filiais`, { headers: h });
            const dF  = await rfF.json();
            if (dF.success && Array.isArray(dF.data)) {
                const sel = document.getElementById('filtro-filial');
                dF.data.forEach(f => {
                    mapFiliais[f.id] = f.nome;
                    const o = document.createElement('option');
                    o.value = f.id; o.textContent = f.nome;
                    sel.appendChild(o);
                });
            }

            // Usuários
            const rfU = await fetchSeguro(`${window.authManager.apiUrl}/api/usuarios`, { headers: h });
            const dU  = await rfU.json();
            const arr = dU.success ? (Array.isArray(dU.data) ? dU.data : (dU.data.itens||[])) : [];
            const sel = document.getElementById('filtro-operador');
            arr.forEach(u => {
                mapUsuarios[u.id] = u.nome_completo || u.nome || `Op #${u.id}`;
                const o = document.createElement('option');
                o.value = u.id; o.textContent = mapUsuarios[u.id];
                sel.appendChild(o);
            });
        } catch(e) { console.warn('Erro filtros', e); }
    }

    // ─────────────────────────────────────────
    // LISTAR SESSÕES
    // ─────────────────────────────────────────
    async function carregarSessoes() {
        tabelaCaixas.innerHTML = `<tr><td colspan="7" class="p-12 text-center text-gray-500 animate-pulse uppercase tracking-widest text-[10px]">Buscando caixas...</td></tr>`;

        const dI = document.getElementById('filtro-data-inicio').value;
        const dF = document.getElementById('filtro-data-fim').value;
        const fF = document.getElementById('filtro-filial').value;
        const fO = document.getElementById('filtro-operador').value;

        try {
            const h   = await window.authManager.getAuthHeaders();
            let url   = `${window.authManager.apiUrl}/api/caixa/sessoes?pageSize=100`;
            if (dI) url += `&data_inicio=${dI}`;
            if (dF) url += `&data_fim=${dF}`;
            if (fF) url += `&filial_id=${fF}`;

            const res = await fetchSeguro(url, { headers: h });
            const d   = await res.json();

            if (d.success) {
                let lista = Array.isArray(d.data) ? d.data : (d.data?.itens || []);
                if (fO) lista = lista.filter(s => String(s.usuario_id) === String(fO) || String(s.usuario_abertura_id) === String(fO));
                sessoesGlobal = lista;

                const aberto = sessoesGlobal.find(s => String(s.status).toLowerCase() === 'aberto');
                if (aberto) { sessionStorage.setItem('sessaoCaixaId', aberto.id); btnAbrirFechamento.classList.remove('hidden'); }
                else        { btnAbrirFechamento.classList.add('hidden'); }

                renderSessoes(sessoesGlobal);
            } else throw new Error();
        } catch(e) {
            tabelaCaixas.innerHTML = `<tr><td colspan="7" class="p-12 text-center text-red-500 bg-red-900/10 uppercase tracking-widest text-[10px]">Erro ao buscar dados.</td></tr>`;
        }
    }
    window.carregarSessoes = carregarSessoes;

    function renderSessoes(sessoes) {
        if (!sessoes.length) {
            tabelaCaixas.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-500 uppercase text-[10px]">Nenhum caixa encontrado.</td></tr>`;
            return;
        }
        tabelaCaixas.innerHTML = '';

        sessoes.forEach(s => {
            const tr       = document.createElement('tr');
            tr.className   = 'hover:bg-white/5 transition-colors';
            const statusSt = String(s.status).toLowerCase();

            let badge = '';
            if      (statusSt === 'aberto')              badge = `<span class="text-green-400 font-bold uppercase text-[9px]">Aberto</span>`;
            else if (statusSt === 'pendente_aprovacao')  badge = `<span class="text-yellow-400 font-bold uppercase text-[9px]">Pendente</span>`;
            else if (statusSt === 'aprovado')            badge = `<span class="text-blue-400 font-bold uppercase text-[9px]">Aprovado</span>`;
            else                                         badge = `<span class="text-gray-400 uppercase text-[9px]">Fechado</span>`;

            const fundo  = parseFloat(s.valor_abertura) || 0;
            const ent    = parseFloat(s.total_entradas) || 0;
            const sai    = parseFloat(s.total_saidas) || 0;
            const saldo  = s.saldo_calculado !== undefined ? parseFloat(s.saldo_calculado) : fundo + ent - sai;

            let quebraHtml = `<span class="text-gray-600 text-[10px]">—</span>`;
            if (statusSt !== 'aberto') {
                const dec = parseFloat(s.valor_fechamento_declarado) || 0;
                const q   = dec - saldo;
                if      (q < -0.01) quebraHtml = `<span class="text-red-400 font-bold">${R$(q)}</span>`;
                else if (q >  0.01) quebraHtml = `<span class="text-green-400 font-bold">+${R$(q)}</span>`;
                else                quebraHtml = `<span class="text-gray-400 font-bold">Exato</span>`;
            }

            const operador = mapUsuarios[s.usuario_id] || s.usuario_id || '—';
            const filial   = mapFiliais[s.filial_id]   || (s.filial_id ? `Filial #${s.filial_id}` : '—');

            tr.innerHTML = `
                <td class="p-4 pl-6 text-center font-mono text-gray-300 font-bold">#${s.id}</td>
                <td class="p-4 text-xs text-white">${fmtData(s.aberto_em || s.criado_em)}</td>
                <td class="p-4 text-xs text-gray-300">
                    <div class="font-medium text-white truncate max-w-[110px]">${operador}</div>
                    <div class="text-[9px] text-gray-500 uppercase mt-0.5">${filial}</div>
                </td>
                <td class="p-4">${badge}</td>
                <td class="p-4 text-right font-bold text-white tracking-widest">${R$(saldo)}</td>
                <td class="p-4 text-right">${quebraHtml}</td>
                <td class="p-4 text-right pr-6">
                    <button class="btn-ver-detalhes bg-white/10 hover:bg-white text-gray-300 hover:text-black border border-gray-700 px-4 py-1.5 rounded-sm text-[10px] uppercase font-bold tracking-widest transition-colors" data-id="${s.id}">
                        Detalhes
                    </button>
                </td>`;
            tabelaCaixas.appendChild(tr);
        });

        document.querySelectorAll('.btn-ver-detalhes').forEach(b =>
            b.addEventListener('click', e => abrirDetalhes(e.currentTarget.dataset.id))
        );
    }

    // ─────────────────────────────────────────
    // DETALHE DA SESSÃO
    // ─────────────────────────────────────────
    async function abrirDetalhes(id) {
        // Reset visual
        ['detalhe-status','detalhe-operador','detalhe-filial','detalhe-abertura','detalhe-fechamento']
            .forEach(k => document.getElementById(k).textContent = '—');
        ['detalhe-fundo','detalhe-entradas','detalhe-saidas','detalhe-saldo']
            .forEach(k => document.getElementById(k).textContent = 'R$ 0,00');
        document.getElementById('detalhe-id').textContent = `#${id}`;
        document.getElementById('detalhe-quebra').textContent = '—';
        document.getElementById('detalhe-lancamentos-body').innerHTML = '';
        document.getElementById('detalhe-sem-lancamentos').classList.add('hidden');
        abrirModal(modalDetalhes);

        try {
            const h = await window.authManager.getAuthHeaders();

            const [rSessao, rLanc] = await Promise.all([
                fetchSeguro(`${window.authManager.apiUrl}/api/caixa/sessoes/${id}`,  { headers: h }),
                fetchSeguro(`${window.authManager.apiUrl}/api/caixa/lancamentos?sessao_id=${id}&pageSize=5000`, { headers: h })
            ]);
            const dS = await rSessao.json();
            const dL = await rLanc.json();

            if (!dS.success || !dS.data) { toast('Sessão não encontrada.','erro'); return; }

            const s = dS.data;

            // Lançamentos — tenta pelo filtro de sessao_id, se não, filtra no front
            let lancs = [];
            if (dL.success) {
                const raw = Array.isArray(dL.data) ? dL.data : (dL.data?.itens || []);
                lancs = raw.filter(l => String(l.sessao_id) === String(id));
                // Se a API retornou vazio mas a sessão tem lançamentos embutidos, usa eles
                if (!lancs.length && Array.isArray(s.lancamentos)) lancs = s.lancamentos;
            } else if (Array.isArray(s.lancamentos)) {
                lancs = s.lancamentos;
            }

            // Cálculos
            const fundo = parseFloat(s.valor_abertura) || 0;
            let sumE = 0, sumS = 0;
            lancs.forEach(l => {
                const v = parseFloat(l.valor) || 0;
                if (String(l.tipo).toLowerCase() === 'entrada') sumE += v;
                else                                            sumS += v;
            });
            const saldoAtual    = fundo + sumE - sumS;
            const statusStr     = String(s.status).toLowerCase();
            const valDeclarado  = parseFloat(s.valor_fechamento_declarado) || 0;
            const quebra        = statusStr !== 'aberto' ? (valDeclarado - saldoAtual) : 0;

            const nomeOp   = mapUsuarios[s.usuario_id] || (s.usuario_id ? `Op #${s.usuario_id}` : '—');
            const nomeFilial = mapFiliais[s.filial_id] || (s.filial_id ? `Filial #${s.filial_id}` : '—');

            // Salva para impressão
            s._lancs  = lancs;
            s._calc   = { fundo, sumE, sumS, saldoAtual, quebra, valDeclarado };
            s._nomeOp = nomeOp;
            s._nomeFilial = nomeFilial;
            sessaoAtivaImpressao = s;

            // Preenche UI
            document.getElementById('detalhe-id').textContent        = `#${s.id}`;
            document.getElementById('detalhe-status').textContent    = statusStr.replace(/_/g,' ').toUpperCase();
            document.getElementById('detalhe-operador').textContent  = nomeOp;
            document.getElementById('detalhe-filial').textContent    = nomeFilial;
            document.getElementById('detalhe-abertura').textContent  = fmtDH(s.aberto_em || s.criado_em);
            document.getElementById('detalhe-fechamento').textContent= statusStr === 'aberto' ? 'Em aberto' : fmtDH(s.fechado_em);

            document.getElementById('detalhe-fundo').textContent    = R$(fundo);
            document.getElementById('detalhe-entradas').textContent = R$(sumE);
            document.getElementById('detalhe-saidas').textContent   = R$(sumS);
            document.getElementById('detalhe-saldo').textContent    = R$(saldoAtual);

            btnReabrirCaixa.classList.toggle('hidden', statusStr !== 'pendente_aprovacao');

            const qEl = document.getElementById('detalhe-quebra');
            if      (statusStr === 'aberto') { qEl.textContent = '—';           qEl.className = 'text-base font-bold text-gray-400'; }
            else if (quebra < -0.01)         { qEl.textContent = R$(quebra);    qEl.className = 'text-base font-bold text-red-400'; }
            else if (quebra >  0.01)         { qEl.textContent = '+'+R$(quebra);qEl.className = 'text-base font-bold text-green-400'; }
            else                             { qEl.textContent = 'Exato';       qEl.className = 'text-base font-bold text-gray-400'; }

            // Tabela de lançamentos
            const tbody = document.getElementById('detalhe-lancamentos-body');
            const semL  = document.getElementById('detalhe-sem-lancamentos');
            if (!lancs.length) { semL.classList.remove('hidden'); return; }
            semL.classList.add('hidden');

            const origens = { venda:'Venda', reembolso:'Reembolso', despesa:'Despesa', outros:'Outros' };
            tbody.innerHTML = lancs.map(l => {
                const isE = String(l.tipo).toLowerCase() === 'entrada';
                return `<tr class="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                    <td class="p-3 text-[10px] text-gray-400 font-mono whitespace-nowrap">${fmtDH(l.criado_em)}</td>
                    <td class="p-3">
                        <span class="text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm ${isE ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}">${isE ? 'Entrada' : 'Saída'}</span>
                    </td>
                    <td class="p-3 text-[11px] text-white max-w-[200px] truncate">${l.descricao || '—'}</td>
                    <td class="p-3 text-[10px] text-gray-400 uppercase">${l.forma_pagamento || '—'}</td>
                    <td class="p-3 text-[10px] text-gray-500 capitalize">${origens[l.origem] || l.origem || '—'}</td>
                    <td class="p-3 text-right font-bold font-mono text-[11px] ${isE ? 'text-green-400' : 'text-red-400'}">${isE ? '+' : '-'}${R$(l.valor)}</td>
                </tr>`;
            }).join('');

        } catch(e) { console.error(e); toast('Erro ao carregar caixa.', 'erro'); }
    }

    document.getElementById('btn-fechar-modal').addEventListener('click', () => fecharModal(modalDetalhes));

    // ─────────────────────────────────────────
    // REABRIR CAIXA
    // ─────────────────────────────────────────
    btnReabrirCaixa.addEventListener('click', () => abrirModal(modalRea));
    document.getElementById('btn-cancelar-reabertura').addEventListener('click', () => { fecharModal(modalRea); formRea.reset(); });

    formRea.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('btn-confirmar-reabertura'); btn.disabled = true;
        try {
            const h   = await window.authManager.getAuthHeaders();
            const res = await fetchSeguro(`${window.authManager.apiUrl}/api/financeiro/caixas/${sessaoAtivaImpressao.id}/rejeitar`, {
                method:'POST', headers: h,
                body: JSON.stringify({ motivo: document.getElementById('r-motivo').value, usuario_financeiro_id: usuarioLogadoId })
            });
            const d = await res.json();
            if (d.success) { toast('Caixa reaberto!'); fecharModal(modalRea); fecharModal(modalDetalhes); carregarSessoes(); }
            else toast(d.message, 'erro');
        } catch(err) { toast('Falha de rede.','erro'); }
        finally { btn.disabled = false; }
    });

    // ─────────────────────────────────────────
    // FECHAR CAIXA
    // ─────────────────────────────────────────
    btnAbrirFechamento.addEventListener('click', () => abrirModal(modalFecharCaixa));
    document.getElementById('btn-cancelar-fechamento').addEventListener('click', () => fecharModal(modalFecharCaixa));

    formFecharCaixa.addEventListener('submit', async e => {
        e.preventDefault();
        const idS = sessionStorage.getItem('sessaoCaixaId'); if (!idS) return;
        const btn = document.getElementById('btn-confirmar-fechamento'); btn.disabled = true;
        try {
            const h   = await window.authManager.getAuthHeaders();
            const res = await fetchSeguro(`${window.authManager.apiUrl}/api/caixa/${idS}/fechar`, {
                method:'POST', headers: h,
                body: JSON.stringify({
                    usuario_id: usuarioLogadoId,
                    valor_fechamento_declarado: parseFloat(document.getElementById('c-valor-fechamento').value)||0,
                    observacoes: document.getElementById('c-obs-fechamento').value
                })
            });
            const d = await res.json();
            if (d.success) { toast('Caixa Fechado!'); fecharModal(modalFecharCaixa); carregarSessoes(); }
            else toast(d.message, 'erro');
        } catch(err) { toast('Falha de rede.','erro'); }
        finally { btn.disabled = false; }
    });

    // ─────────────────────────────────────────
    // IMPRESSÃO — abre nova aba limpa com o HTML do relatório
    // ─────────────────────────────────────────
    document.getElementById('btn-imprimir-relatorio').addEventListener('click', () => {
        if (!sessaoAtivaImpressao) return;

        const s       = sessaoAtivaImpressao;
        const c       = s._calc;
        const lancs   = s._lancs || [];
        const status  = String(s.status).toLowerCase();
        const nomeOp  = s._nomeOp  || '—';
        const nomeFil = s._nomeFilial || '—';

        // ── Totais por forma de pagamento (entradas)
        const pag = { dinheiro:0, cartao:0, pix:0, boleto:0, outros:0 };
        lancs.forEach(l => {
            if (String(l.tipo).toLowerCase() !== 'entrada') return;
            const pg = String(l.forma_pagamento||'').toLowerCase();
            const v  = parseFloat(l.valor)||0;
            if      (pg === 'dinheiro')                                pg === 'dinheiro' && (pag.dinheiro += v);
            else if (pg === 'cartao'||pg==='credito'||pg==='debito')  pag.cartao  += v;
            else if (pg === 'pix')                                     pag.pix     += v;
            else if (pg === 'boleto')                                  pag.boleto  += v;
            else                                                       pag.outros  += v;
        });
        // fix do bug acima — recalcular corretamente
        pag.dinheiro = pag.cartao = pag.pix = pag.boleto = pag.outros = 0;
        lancs.forEach(l => {
            if (String(l.tipo).toLowerCase() !== 'entrada') return;
            const pg = String(l.forma_pagamento||'').toLowerCase().trim();
            const v  = parseFloat(l.valor)||0;
            if      (pg === 'dinheiro')                             pag.dinheiro += v;
            else if (pg === 'cartao'||pg==='credito'||pg==='debito')pag.cartao  += v;
            else if (pg === 'pix')                                  pag.pix     += v;
            else if (pg === 'boleto')                               pag.boleto  += v;
            else                                                    pag.outros  += v;
        });

        // ── Datas
        const dtAbertura   = fmtDH(s.aberto_em || s.criado_em);
        const dtFechamento = status === 'aberto' ? 'Em aberto' : fmtDH(s.fechado_em);
        const dtEmissao    = new Date().toLocaleString('pt-BR');

        // ── Quebra
        let quebraColor = '#555'; let quebraLabel = '—';
        if (status !== 'aberto') {
            if      (c.quebra < -0.01) { quebraColor='#dc2626'; quebraLabel=`FALTA ${R$(c.quebra)}`; }
            else if (c.quebra >  0.01) { quebraColor='#16a34a'; quebraLabel=`SOBRA +${R$(c.quebra)}`; }
            else                       { quebraColor='#374151'; quebraLabel='EXATO'; }
        }

        // ── Badge status
        const badges = {
            aberto:             `<span style="background:#dcfce7;color:#15803d;padding:2px 10px;border-radius:4px;font-size:10px;font-weight:700;">ABERTO</span>`,
            pendente_aprovacao: `<span style="background:#fef9c3;color:#854d0e;padding:2px 10px;border-radius:4px;font-size:10px;font-weight:700;">AGUARDANDO APROVAÇÃO</span>`,
            aprovado:           `<span style="background:#dbeafe;color:#1d4ed8;padding:2px 10px;border-radius:4px;font-size:10px;font-weight:700;">APROVADO</span>`,
        };
        const statusBadge = badges[status] || `<span style="background:#f3f4f6;color:#374151;padding:2px 10px;border-radius:4px;font-size:10px;font-weight:700;">FECHADO</span>`;

        // ── Linhas de lançamentos
        const origens = { venda:'Venda', reembolso:'Reembolso', despesa:'Despesa', outros:'Outros' };
        let saldoAc = c.fundo;
        let linhas  = '';

        if (!lancs.length) {
            linhas = `<tr><td colspan="7" style="padding:18px;text-align:center;color:#888;font-style:italic;">Nenhum lançamento nesta sessão.</td></tr>`;
        } else {
            lancs.forEach((l, i) => {
                const isE = String(l.tipo).toLowerCase() === 'entrada';
                const v   = parseFloat(l.valor) || 0;
                saldoAc  += isE ? v : -v;
                const bg  = i % 2 === 0 ? '#ffffff' : '#f9fafb';
                linhas += `
                <tr style="background:${bg};">
                    <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:10px;color:#6b7280;white-space:nowrap;">${fmtDH(l.criado_em)}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">
                        <span style="font-size:9px;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:3px;background:${isE?'#dcfce7':'#fee2e2'};color:${isE?'#15803d':'#b91c1c'};">${isE?'ENTRADA':'SAÍDA'}</span>
                    </td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#111;">${l.descricao||'—'}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:10px;color:#6b7280;text-transform:uppercase;">${l.forma_pagamento||'—'}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:10px;color:#6b7280;">${origens[l.origem]||l.origem||'—'}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;font-size:11px;color:${isE?'#15803d':'#b91c1c'};">${isE?'+':'-'}${R$(v)}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:10px;color:#374151;font-weight:600;">${R$(saldoAc)}</td>
                </tr>`;
            });
        }

        // ── HTML completo do relatório
        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Relatório de Caixa — Sessão #${s.id}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media screen { body { padding: 20px; max-width: 1100px; margin: auto; } }
</style>
</head>
<body>

<!-- CABEÇALHO -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #000;padding-bottom:12px;margin-bottom:16px;">
  <div>
    <div style="font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:2px;">Boutique Diniz</div>
    <div style="font-size:11px;color:#555;margin-top:2px;text-transform:uppercase;letter-spacing:1px;">Relatório Analítico de Caixa</div>
  </div>
  <div style="text-align:right;font-size:11px;line-height:2;color:#333;">
    <div style="font-size:15px;font-weight:800;">Sessão #${s.id} &nbsp;${statusBadge}</div>
    <div><strong>Operador:</strong> ${nomeOp.toUpperCase()}</div>
    <div><strong>Filial:</strong> ${nomeFil.toUpperCase()}</div>
    <div><strong>Abertura:</strong> ${dtAbertura} &nbsp;|&nbsp; <strong>Fechamento:</strong> ${dtFechamento}</div>
    <div style="color:#888;font-size:10px;margin-top:2px;">Emitido em: ${dtEmissao}</div>
  </div>
</div>

<!-- CARDS FINANCEIROS -->
<div style="display:flex;gap:10px;margin-bottom:14px;">
  <div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:10px;text-align:center;background:#fafafa;">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:4px;">Fundo Inicial</div>
    <div style="font-size:18px;font-weight:800;color:#111;">${R$(c.fundo)}</div>
  </div>
  <div style="flex:1;border:1px solid #bbf7d0;border-radius:6px;padding:10px;text-align:center;background:#f0fdf4;">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#15803d;margin-bottom:4px;">(+) Entradas</div>
    <div style="font-size:18px;font-weight:800;color:#15803d;">${R$(c.sumE)}</div>
  </div>
  <div style="flex:1;border:1px solid #fecaca;border-radius:6px;padding:10px;text-align:center;background:#fef2f2;">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#b91c1c;margin-bottom:4px;">(-) Saídas</div>
    <div style="font-size:18px;font-weight:800;color:#b91c1c;">${R$(c.sumS)}</div>
  </div>
  <div style="flex:1.2;border:2px solid #1d4ed8;border-radius:6px;padding:10px;text-align:center;background:#eff6ff;">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#1d4ed8;margin-bottom:4px;">(=) Saldo Calculado</div>
    <div style="font-size:20px;font-weight:900;color:#1d4ed8;">${R$(c.saldoAtual)}</div>
  </div>
  <div style="flex:1.2;border:2px solid ${quebraColor};border-radius:6px;padding:10px;text-align:center;background:${c.quebra < -0.01 ? '#fef2f2' : c.quebra > 0.01 ? '#f0fdf4' : '#f9fafb'};">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:2px;">Valor Declarado</div>
    <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:4px;">${status==='aberto'?'—':R$(c.valDeclarado)}</div>
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:2px;">Quebra</div>
    <div style="font-size:14px;font-weight:800;color:${quebraColor};">${quebraLabel}</div>
  </div>
</div>

<!-- FORMAS DE PAGAMENTO -->
<div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px;background:#fafafa;margin-bottom:14px;">
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-bottom:8px;">
    Entradas por Forma de Pagamento
  </div>
  <div style="display:flex;gap:8px;">
    <div style="flex:1;text-align:center;border:1px solid #e5e7eb;border-radius:4px;padding:8px;background:#fff;">
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-bottom:3px;">💳 Cartão</div>
      <div style="font-size:15px;font-weight:700;">${R$(pag.cartao)}</div>
    </div>
    <div style="flex:1;text-align:center;border:1px solid #e5e7eb;border-radius:4px;padding:8px;background:#fff;">
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-bottom:3px;">📱 PIX</div>
      <div style="font-size:15px;font-weight:700;">${R$(pag.pix)}</div>
    </div>
    <div style="flex:1;text-align:center;border:1px solid #e5e7eb;border-radius:4px;padding:8px;background:#fff;">
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-bottom:3px;">💵 Dinheiro</div>
      <div style="font-size:15px;font-weight:700;">${R$(pag.dinheiro)}</div>
    </div>
    <div style="flex:1;text-align:center;border:1px solid #e5e7eb;border-radius:4px;padding:8px;background:#fff;">
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-bottom:3px;">🧾 Boleto</div>
      <div style="font-size:15px;font-weight:700;">${R$(pag.boleto)}</div>
    </div>
    <div style="flex:1;text-align:center;border:1px solid #e5e7eb;border-radius:4px;padding:8px;background:#fff;">
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-bottom:3px;">🎁 Outros</div>
      <div style="font-size:15px;font-weight:700;">${R$(pag.outros)}</div>
    </div>
  </div>
</div>

<!-- LANÇAMENTOS -->
<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#374151;margin-bottom:6px;">
  Lançamentos da Sessão (${lancs.length} registro${lancs.length!==1?'s':''})
</div>
<table style="width:100%;border-collapse:collapse;font-size:11px;">
  <thead>
    <tr style="background:#111;color:#fff;">
      <th style="padding:8px 10px;font-weight:600;font-size:10px;text-transform:uppercase;">Data / Hora</th>
      <th style="padding:8px 10px;font-weight:600;font-size:10px;text-transform:uppercase;">Tipo</th>
      <th style="padding:8px 10px;font-weight:600;font-size:10px;text-transform:uppercase;width:30%;">Descrição</th>
      <th style="padding:8px 10px;font-weight:600;font-size:10px;text-transform:uppercase;">Pagamento</th>
      <th style="padding:8px 10px;font-weight:600;font-size:10px;text-transform:uppercase;">Origem</th>
      <th style="padding:8px 10px;font-weight:600;font-size:10px;text-transform:uppercase;text-align:right;">Valor</th>
      <th style="padding:8px 10px;font-weight:600;font-size:10px;text-transform:uppercase;text-align:right;">Saldo</th>
    </tr>
  </thead>
  <tbody>${linhas}</tbody>
  <tfoot>
    <tr style="background:#f3f4f6;font-weight:700;">
      <td colspan="5" style="padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;">Totais da Sessão</td>
      <td style="padding:8px 10px;text-align:right;font-size:11px;">
        <span style="color:#15803d;">+${R$(c.sumE)}</span> &nbsp; <span style="color:#b91c1c;">-${R$(c.sumS)}</span>
      </td>
      <td style="padding:8px 10px;text-align:right;font-size:13px;font-weight:900;color:#1d4ed8;">${R$(c.saldoAtual)}</td>
    </tr>
  </tfoot>
</table>

<!-- RODAPÉ -->
<div style="margin-top:24px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #d1d5db;padding-top:12px;">
  <div style="font-size:10px;color:#6b7280;line-height:1.8;">
    <strong>Sistema:</strong> Boutique Diniz — Atlas Tecnologia v3.0<br>
    <strong>Sessão:</strong> #${s.id} &nbsp;|&nbsp; <strong>Operador:</strong> ${nomeOp} &nbsp;|&nbsp; <strong>Filial:</strong> ${nomeFil}<br>
    <strong>Emitido em:</strong> ${dtEmissao}
  </div>
  <div style="text-align:center;">
    <div style="width:260px;border-top:1px solid #000;margin:0 auto 6px;"></div>
    <div style="font-size:10px;color:#555;">Assinatura do Responsável</div>
    <div style="font-size:11px;font-weight:700;">${nomeOp.toUpperCase()}</div>
  </div>
</div>

<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };<\/script>
</body></html>`;

        // ── Abre janela nova limpa — resolve o problema do PDF branco
        const win = window.open('', '_blank', 'width=1100,height=750');
        if (!win) { toast('Permita pop-ups para imprimir.', 'erro'); return; }
        win.document.open();
        win.document.write(html);
        win.document.close();
    });

    init();
});
