document.addEventListener("DOMContentLoaded", () => {
    
    const tabelaCaixas = document.getElementById('tabela-sessoes');
    const modalDetalhes = document.getElementById('modal-detalhes');
    const areaImpressao = document.getElementById('area-impressao-relatorio');
    
    const btnAbrirFechamento = document.getElementById('btn-abrir-fechamento');
    const modalFecharCaixa = document.getElementById('modal-fechar-caixa');
    const formFecharCaixa = document.getElementById('form-fechar-caixa');

    const btnReabrirCaixa = document.getElementById('btn-reabrir-caixa');
    const modalMotivoReabertura = document.getElementById('modal-motivo-reabertura');
    const formMotivoReabertura = document.getElementById('form-motivo-reabertura');

    let currentPage = 1;
    let totalPages = 1;
    let sessoesGlobal = [];
    let sessaoAtivaImpressao = null; 
    let usuarioLogadoId = 1;
    let mapUsuarios = {}; 

    // ==========================================
    // UTILITÁRIOS
    // ==========================================
    async function fetchSeguro(url, options = {}) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id); return response;
        } catch (error) { clearTimeout(id); throw error; }
    }

    function formatarMoeda(valor) {
        return parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatarData(dataString) {
        if (!dataString) return '--/--/----';
        return new Date(dataString).toLocaleDateString('pt-BR');
    }

    function formatarDataHora(dataString) {
        if (!dataString) return '--/--/---- --:--';
        const dt = new Date(dataString);
        return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    }

    function mostrarToast(msg, tipo = 'sucesso') {
        const t = document.getElementById('toast');
        document.getElementById('toast-msg').textContent = msg;
        document.getElementById('toast-icon').textContent = tipo === 'erro' ? 'error' : 'check_circle';
        document.getElementById('toast-icon').className = `material-icons ${tipo === 'erro' ? 'text-red-500' : 'text-black'}`;
        t.classList.remove('translate-y-20', 'opacity-0');
        setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 3500);
    }

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================
    async function init() {
        let tentativas = 0;
        while (typeof window.authManager === 'undefined' && tentativas < 30) {
            await new Promise(r => setTimeout(r, 100)); tentativas++;
        }
        
        try {
            const uStr = sessionStorage.getItem('usuario');
            if(uStr) {
                const uObj = JSON.parse(uStr);
                document.getElementById('topbar-user-name').textContent = uObj.nome_completo || 'Operador';
                document.getElementById('topbar-user-initial').textContent = (uObj.nome_completo || 'O').charAt(0).toUpperCase();
                usuarioLogadoId = uObj.id || 1;
            }

            await carregarFiltrosAPI();
            carregarSessoes();

        } catch (error) { 
            tabelaCaixas.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500 uppercase tracking-widest text-[10px]">Falha de Inicialização</td></tr>`;
        }
    }

    // CARREGAR DADOS DOS SELECTS DE FILTRO
    async function carregarFiltrosAPI() {
        try {
            const h = await window.authManager.getAuthHeaders();
            
            const resF = await fetchSeguro(`${window.authManager.apiUrl}/api/filiais`, { headers: h });
            const dF = await resF.json();
            if (dF.success && Array.isArray(dF.data)) {
                const sel = document.getElementById('filtro-filial');
                dF.data.forEach(f => {
                    const opt = document.createElement('option');
                    opt.value = f.id; opt.textContent = f.nome;
                    sel.appendChild(opt);
                });
            }

            const resU = await fetchSeguro(`${window.authManager.apiUrl}/api/usuarios`, { headers: h });
            const dU = await resU.json();
            const usuariosArray = dU.success ? (Array.isArray(dU.data) ? dU.data : (dU.data.itens || [])) : [];
            
            const selOp = document.getElementById('filtro-operador');
            usuariosArray.forEach(u => {
                mapUsuarios[u.id] = u.nome_completo || u.nome || `Op #${u.id}`;
                const opt = document.createElement('option');
                opt.value = u.id; opt.textContent = mapUsuarios[u.id];
                selOp.appendChild(opt);
            });

        } catch (e) { console.warn("Erro ao buscar filtros", e); }
    }

    // ==========================================
    // LISTAR SESSÕES (APLICANDO FILTROS)
    // ==========================================
    async function carregarSessoes() {
        tabelaCaixas.innerHTML = '<tr><td colspan="7" class="p-12 text-center text-gray-500 animate-pulse uppercase tracking-widest text-[10px]">Buscando caixas...</td></tr>';
        
        const dInicio = document.getElementById('filtro-data-inicio').value;
        const dFim = document.getElementById('filtro-data-fim').value;
        const fFilial = document.getElementById('filtro-filial').value;
        const fOperador = document.getElementById('filtro-operador').value;

        try {
            const h = await window.authManager.getAuthHeaders();
            let url = `${window.authManager.apiUrl}/api/caixa/sessoes?pageSize=100`;
            if (dInicio) url += `&data_inicio=${dInicio}`;
            if (dFim) url += `&data_fim=${dFim}`;
            if (fFilial) url += `&filial_id=${fFilial}`;

            const res = await fetchSeguro(url, { headers: h });
            const d = await res.json();

            if (d.success) {
                let lista = Array.isArray(d.data) ? d.data : (d.data && d.data.itens ? d.data.itens : []);
                
                if (fOperador) {
                    lista = lista.filter(s => String(s.usuario_id) === String(fOperador) || String(s.usuario_abertura_id) === String(fOperador));
                }

                sessoesGlobal = lista;
                
                // Exibe o botão de fechar caixa se houver um aberto
                const sessaoAberta = sessoesGlobal.find(s => String(s.status).toLowerCase() === 'aberto');
                
                if (sessaoAberta) {
                    sessionStorage.setItem('sessaoCaixaId', sessaoAberta.id);
                    btnAbrirFechamento.classList.remove('hidden');
                } else {
                    btnAbrirFechamento.classList.add('hidden');
                }

                renderizarSessoes(sessoesGlobal);
            } else { throw new Error(); }
        } catch (e) { 
            tabelaCaixas.innerHTML = `<tr><td colspan="7" class="p-12 text-center text-red-500 bg-red-900/10 uppercase tracking-widest text-[10px]">Erro ao buscar dados.</td></tr>`;
        }
    }
    window.carregarSessoes = carregarSessoes;

    function renderizarSessoes(sessoes) {
        if (sessoes.length === 0) {
            tabelaCaixas.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-gray-500 uppercase text-[10px]">Nenhum caixa corresponde aos filtros.</td></tr>';
            return;
        }
        tabelaCaixas.innerHTML = '';
        
        sessoes.forEach(s => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-white/5 transition-colors group";
            
            let statusHtml = '';
            const statusStr = String(s.status).toLowerCase();
            
            if (statusStr === 'aberto') statusHtml = '<span class="text-green-400 font-bold uppercase text-[9px]">Aberto</span>';
            else if (statusStr === 'pendente_aprovacao') statusHtml = '<span class="text-yellow-500 font-bold uppercase text-[9px]">Pendente</span>';
            else statusHtml = '<span class="text-gray-400 uppercase text-[9px]">Fechado</span>';

            const fundo = parseFloat(s.valor_abertura) || 0;
            const entradas = parseFloat(s.total_entradas) || 0;
            const saidas = parseFloat(s.total_saidas) || 0;
            const saldoCalculado = s.saldo_calculado !== undefined ? parseFloat(s.saldo_calculado) : (fundo + entradas - saidas);
            
            let quebra = 0;
            let quebraHtml = '<span class="text-gray-600 text-[10px]">-</span>';
            if (statusStr !== 'aberto') {
                const valorInformado = parseFloat(s.valor_fechamento_declarado) || 0;
                quebra = valorInformado - saldoCalculado;
                if (quebra < -0.01) quebraHtml = `<span class="text-red-400 font-bold tracking-widest">${formatarMoeda(quebra)}</span>`;
                else if (quebra > 0.01) quebraHtml = `<span class="text-green-400 font-bold tracking-widest">+${formatarMoeda(quebra)}</span>`;
                else quebraHtml = `<span class="text-gray-400 font-bold tracking-widest">Exato</span>`;
            }

            const nomeOperador = mapUsuarios[s.usuario_id] || s.usuario_id || 'Desconhecido';

            tr.innerHTML = `
                <td class="p-4 pl-6 text-center font-mono text-gray-300 font-bold">#${s.id}</td>
                <td class="p-4 text-xs text-white">${formatarData(s.criado_em)}</td>
                <td class="p-4 text-xs text-gray-300 truncate max-w-[100px]">${nomeOperador}</td>
                <td class="p-4">${statusHtml}</td>
                <td class="p-4 text-right font-bold text-white tracking-widest">${formatarMoeda(saldoCalculado)}</td>
                <td class="p-4 text-right">${quebraHtml}</td>
                <td class="p-4 text-right pr-6">
                    <button class="btn-ver-detalhes bg-white/10 hover:bg-white text-gray-300 hover:text-black border border-gray-700 px-4 py-1.5 rounded-sm text-[10px] uppercase font-bold tracking-widest transition-colors" data-id="${s.id}">
                        Detalhes
                    </button>
                </td>
            `;
            tabelaCaixas.appendChild(tr);
        });

        document.querySelectorAll('.btn-ver-detalhes').forEach(b => {
            b.addEventListener('click', (e) => abrirDetalhesCaixa(e.currentTarget.dataset.id));
        });
    }

    // ==========================================
    // DETALHES DO CAIXA E BUSCA GERAL DE LANÇAMENTOS
    // ==========================================
    async function abrirDetalhesCaixa(id) {
        document.getElementById('detalhe-id').textContent = `#${id}`;
        document.getElementById('detalhe-status').textContent = "Carregando...";
        abrirModal(modalDetalhes);

        try {
            const h = await window.authManager.getAuthHeaders();
            
            // 1. Busca os detalhes da sessão
            const resSessao = await fetchSeguro(`${window.authManager.apiUrl}/api/caixa/sessoes/${id}`, { headers: h });
            const dSessao = await resSessao.json();

            // 2. BUSCA TODOS OS LANÇAMENTOS DO BANCO (sem filtro na URL) para filtrar no FRONTEND
            const resLanc = await fetchSeguro(`${window.authManager.apiUrl}/api/caixa/lancamentos?pageSize=5000`, { headers: h });
            const dLanc = await resLanc.json();

            if (dSessao.success && dSessao.data) {
                const s = dSessao.data;
                
                let lancamentos = [];
                if (dLanc.success) {
                    const todosLancamentos = Array.isArray(dLanc.data) ? dLanc.data : (dLanc.data.itens || []);
                    
                    // FILTRO NO FRONTEND: Pega só os que têm o sessao_id igual ao clicado
                    lancamentos = todosLancamentos.filter(l => String(l.sessao_id) === String(id));
                } else if (s.lancamentos) {
                    lancamentos = s.lancamentos;
                }
                
                s.lancamentos = lancamentos; // Salva para enviar pra impressão

                let fundoCaixa = parseFloat(s.valor_abertura) || 0;
                let sumEntradas = 0; let sumSaidas = 0;

                lancamentos.forEach(l => {
                    const v = parseFloat(l.valor) || 0;
                    const tipoStr = String(l.tipo).toLowerCase();
                    if (tipoStr === 'entrada') sumEntradas += v;
                    else if (tipoStr === 'saida') sumSaidas += v;
                });

                const saldoAtual = fundoCaixa + sumEntradas - sumSaidas;
                
                // Quebra
                let quebra = 0;
                const statusStr = String(s.status).toLowerCase();
                if (statusStr !== 'aberto') {
                    const dec = parseFloat(s.valor_fechamento_declarado) || 0;
                    quebra = dec - saldoAtual;
                }

                s.calculo_forçado = { fundoCaixa, sumEntradas, sumSaidas, saldoAtual, quebra };
                sessaoAtivaImpressao = s;

                document.getElementById('detalhe-status').textContent = statusStr.replace('_', ' ');
                btnReabrirCaixa.classList.toggle('hidden', statusStr !== 'pendente_aprovacao');
                
                document.getElementById('detalhe-fundo').textContent = formatarMoeda(fundoCaixa);
                document.getElementById('detalhe-entradas').textContent = formatarMoeda(sumEntradas);
                document.getElementById('detalhe-saidas').textContent = formatarMoeda(sumSaidas);
                
                const qbEl = document.getElementById('detalhe-quebra');
                if(statusStr === 'aberto') {
                    qbEl.textContent = "-";
                    qbEl.className = "text-lg font-bold text-gray-400";
                } else if (quebra < -0.01) { 
                    qbEl.textContent = formatarMoeda(quebra); qbEl.className = "text-lg font-bold text-red-500"; 
                } else if (quebra > 0.01) { 
                    qbEl.textContent = "+" + formatarMoeda(quebra); qbEl.className = "text-lg font-bold text-green-400"; 
                } else { 
                    qbEl.textContent = "Exato"; qbEl.className = "text-lg font-bold text-gray-400"; 
                }
            }
        } catch (e) { mostrarToast("Erro ao ler os dados do caixa.", "erro"); }
    }

    document.getElementById('btn-fechar-modal').addEventListener('click', () => fecharModal(modalDetalhes));

    // ==========================================
    // REABRIR CAIXA
    // ==========================================
    btnReabrirCaixa.addEventListener('click', () => abrirModal(modalMotivoReabertura));
    document.getElementById('btn-cancelar-reabertura').addEventListener('click', () => { fecharModal(modalMotivoReabertura); formMotivoReabertura.reset(); });

    formMotivoReabertura.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-confirmar-reabertura'); btn.disabled = true;
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetchSeguro(`${window.authManager.apiUrl}/api/financeiro/caixas/${sessaoAtivaImpressao.id}/rejeitar`, {
                method: 'POST', headers: h, body: JSON.stringify({ motivo: document.getElementById('r-motivo').value, usuario_financeiro_id: usuarioLogadoId })
            });
            const d = await res.json();
            if (d.success) {
                mostrarToast("Caixa reaberto!");
                fecharModal(modalMotivoReabertura); fecharModal(modalDetalhes); carregarSessoes();
            } else { mostrarToast(d.message, "erro"); }
        } catch (err) { mostrarToast("Falha de rede.", "erro"); } 
        finally { btn.disabled = false; }
    });

    // ==========================================
    // FECHAMENTO NORMAL
    // ==========================================
    btnAbrirFechamento.addEventListener('click', () => { abrirModal(modalFecharCaixa); });
    document.getElementById('btn-cancelar-fechamento').addEventListener('click', () => fecharModal(modalFecharCaixa));

    formFecharCaixa.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idSessao = sessionStorage.getItem('sessaoCaixaId'); if (!idSessao) return;
        const btn = document.getElementById('btn-confirmar-fechamento'); btn.disabled = true;

        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetchSeguro(`${window.authManager.apiUrl}/api/caixa/${idSessao}/fechar`, {
                method: 'POST', headers: h, body: JSON.stringify({ usuario_id: usuarioLogadoId, valor_fechamento_declarado: parseFloat(document.getElementById('c-valor-fechamento').value)||0, observacoes: document.getElementById('c-obs-fechamento').value })
            });
            const d = await res.json();
            if (d.success) { mostrarToast("Caixa Fechado!"); fecharModal(modalFecharCaixa); carregarSessoes(); } 
            else { mostrarToast(d.message, "erro"); }
        } catch(err) { mostrarToast("Falha de rede.", "erro"); } 
        finally { btn.disabled = false; }
    });

    // ==========================================
    // RELATÓRIO A4 DEITADO (LANDSCAPE)
    // ==========================================
    document.getElementById('btn-imprimir-relatorio').addEventListener('click', () => {
        if (!sessaoAtivaImpressao) return;

        const s = sessaoAtivaImpressao;
        const c = s.calculo_forçado; 
        const lancamentos = s.lancamentos || [];
        
        const pag = { dinheiro: 0, cartao: 0, pix: 0, outros: 0 };
        lancamentos.forEach(l => {
            if (String(l.tipo).toLowerCase() === 'entrada') {
                const pg = String(l.forma_pagamento||'').toLowerCase();
                const v = parseFloat(l.valor)||0;
                if (pg.includes('dinheiro')) pag.dinheiro += v;
                else if (pg.includes('cartao') || pg.includes('credit') || pg.includes('debit')) pag.cartao += v;
                else if (pg.includes('pix')) pag.pix += v;
                else pag.outros += v;
            }
        });

        const opNome = mapUsuarios[s.usuario_id] || s.usuario_id || '--';
        const valorDeclarado = parseFloat(s.valor_fechamento_declarado) || 0;
        
        let quebraText = "N/A (Caixa Aberto)";
        if(String(s.status).toLowerCase() !== 'aberto') {
            if(c.quebra < -0.01) quebraText = `<span style="color:#dc2626; font-weight:bold;">FALTA: ${formatarMoeda(c.quebra)}</span>`;
            else if(c.quebra > 0.01) quebraText = `<span style="color:#16a34a; font-weight:bold;">SOBRA: +${formatarMoeda(c.quebra)}</span>`;
            else quebraText = `Exato (R$ 0,00)`;
        }

        let linhasHtml = '';
        lancamentos.forEach(l => {
            const dataL = formatarDataHora(l.criado_em);
            const isE = String(l.tipo).toLowerCase() === 'entrada';
            const cor = isE ? 'color: #16a34a;' : 'color: #dc2626;';
            linhasHtml += `
                <tr>
                    <td style="padding:8px; border-bottom:1px solid #eee;">${dataL}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee; text-transform:uppercase;">${isE ? 'Entrada' : 'Saída'}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">${l.descricao || '--'}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee; text-transform:uppercase;">${l.forma_pagamento || '--'}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee; text-align:right; font-weight:bold; ${cor}">${isE ? '+' : '-'}${formatarMoeda(l.valor)}</td>
                </tr>
            `;
        });

        if(lancamentos.length === 0) {
            linhasHtml = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #666;">Nenhum lançamento registrado nesta sessão.</td></tr>`;
        }

        areaImpressao.innerHTML = `
            <div style="font-family: 'Inter', sans-serif; padding: 20px; color: #000;">
                <div style="display:flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px;">
                    <div>
                        <h1 style="font-size: 24px; font-weight: 800; margin: 0; text-transform: uppercase;">Boutique Diniz</h1>
                        <p style="margin: 4px 0 0 0; font-size: 14px; color: #555;">Relatório Analítico de Caixa</p>
                    </div>
                    <div style="text-align: right; font-size: 12px; line-height: 1.6;">
                        <strong>Sessão #${s.id}</strong><br>
                        Abertura: ${formatarDataHora(s.criado_em)}<br>
                        Fechamento: ${String(s.status).toLowerCase() === 'aberto' ? '--' : formatarDataHora(s.fechado_em)}<br>
                        Operador: ${opNome.toUpperCase()}
                    </div>
                </div>

                <div style="display: flex; gap: 15px; margin-bottom: 25px;">
                    <div style="flex:1; border: 1px solid #ddd; border-radius: 8px; padding: 15px; text-align: center; background: #fafafa;">
                        <div style="font-size: 10px; text-transform: uppercase; color: #666; margin-bottom: 5px;">Fundo Inicial</div>
                        <div style="font-size: 18px; font-weight: 700;">${formatarMoeda(c.fundoCaixa)}</div>
                    </div>
                    <div style="flex:1; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; text-align: center; background: #f0fdf4;">
                        <div style="font-size: 10px; text-transform: uppercase; color: #16a34a; margin-bottom: 5px;">(+) Entradas Totais</div>
                        <div style="font-size: 18px; font-weight: 700; color: #15803d;">${formatarMoeda(c.sumEntradas)}</div>
                    </div>
                    <div style="flex:1; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; text-align: center; background: #fef2f2;">
                        <div style="font-size: 10px; text-transform: uppercase; color: #dc2626; margin-bottom: 5px;">(-) Saídas Totais</div>
                        <div style="font-size: 18px; font-weight: 700; color: #b91c1c;">${formatarMoeda(c.sumSaidas)}</div>
                    </div>
                    <div style="flex:1; border: 2px solid #000; border-radius: 8px; padding: 15px; text-align: center; background: #fff;">
                        <div style="font-size: 10px; text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">(=) Saldo Calculado</div>
                        <div style="font-size: 20px; font-weight: 800;">${formatarMoeda(c.saldoAtual)}</div>
                    </div>
                </div>

                <div style="display: flex; gap: 20px; margin-bottom: 30px;">
                    <div style="flex: 2; border: 1px solid #ccc; padding: 15px; border-radius: 8px;">
                        <h3 style="font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 5px;">Resumo por Forma de Pagamento (Entradas)</h3>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;"><span>Cartão de Crédito/Débito:</span> <strong>${formatarMoeda(pag.cartao)}</strong></div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;"><span>PIX:</span> <strong>${formatarMoeda(pag.pix)}</strong></div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;"><span>Dinheiro em Espécie:</span> <strong>${formatarMoeda(pag.dinheiro)}</strong></div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px;"><span>Outros (Gift Card, etc):</span> <strong>${formatarMoeda(pag.outros)}</strong></div>
                    </div>
                    
                    <div style="flex: 1; border: 1px solid #ccc; padding: 15px; border-radius: 8px; background: #fdfdfd; display: flex; flex-col; justify-content: center;">
                        <div style="width: 100%;">
                            <h3 style="font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 5px;">Fechamento (Quebra de Caixa)</h3>
                            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px;">
                                <span>Valor Declarado Físico:</span> <strong>${String(s.status).toLowerCase() === 'aberto' ? '--' : formatarMoeda(valorDeclarado)}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold;">
                                <span>Diferença Sistêmica:</span> <span>${quebraText}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <h3 style="font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase;">Lista de Lançamentos da Sessão</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
                    <thead>
                        <tr style="background-color: #000; color: #fff;">
                            <th style="padding: 10px; font-weight: 600;">Data / Hora</th>
                            <th style="padding: 10px; font-weight: 600;">Movimento</th>
                            <th style="padding: 10px; font-weight: 600; width: 40%;">Descrição / Produto</th>
                            <th style="padding: 10px; font-weight: 600;">Método</th>
                            <th style="padding: 10px; font-weight: 600; text-align: right;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhasHtml}
                    </tbody>
                </table>
                
                <div style="margin-top: 50px; text-align: center; font-size: 10px; color: #555;">
                    <div style="width: 300px; border-top: 1px solid #000; margin: 0 auto 10px auto;"></div>
                    Assinatura do Responsável (${opNome})<br>
                    Impresso via Sistema Atlas em ${new Date().toLocaleString('pt-BR')}
                </div>
            </div>
        `;

        setTimeout(() => window.print(), 500);
    });

    function abrirModal(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); setTimeout(() => modal.classList.remove('opacity-0'), 10); }
    function fecharModal(modal) { modal.classList.add('opacity-0'); setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300); }

    init();
});
