document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. VERIFICAÇÃO DE DADOS DO USUÁRIO ---
    const usuarioStr = sessionStorage.getItem('usuario');
    if (usuarioStr) {
        const usuario = JSON.parse(usuarioStr);
        document.getElementById('topbar-user-name').textContent = usuario.nome_completo.split(' ')[0];
        document.getElementById('topbar-user-initial').textContent = usuario.nome_completo.charAt(0).toUpperCase();
        document.getElementById('topbar-user-role').textContent = usuario.grupo_acesso_id === 1 ? "Administrador" : "Equipe Vendas";
    }

    // --- 2. ELEMENTOS DA INTERFACE ---
    const tabelaFiliais = document.getElementById('tabela-filiais');
    const filtroStatus = document.getElementById('filtro-status');
    const modalForm = document.getElementById('modal-form');
    const formFilial = document.getElementById('form-filial');
    const modalTitulo = document.getElementById('modal-titulo');
    const modalDelete = document.getElementById('modal-delete');
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    const toastIcon = document.getElementById('toast-icon');

    let listaFiliaisGlobal = [];

    // --- 3. 🟢 FUNÇÃO DE ESPERA REFORÇADA DO TOKEN.JS ---
    async function garantirAuthManager() {
        let tentativas = 0;
        // Tenta encontrar o módulo de segurança 30 vezes (3 segundos no total)
        while (typeof window.authManager === 'undefined' && tentativas < 30) {
            console.log(`[Segurança] Aguardando módulo... tentativa ${tentativas + 1}`);
            await new Promise(resolve => setTimeout(resolve, 100));
            tentativas++;
        }
        
        if (typeof window.authManager === 'undefined' || !window.authManager) {
            throw new Error("Módulo de segurança crítico não carregado. Verifique o arquivo token.js.");
        }
    }

    // --- 4. FUNÇÕES DE LISTAGEM (GET) ---
    async function carregarFiliais() {
        tabelaFiliais.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-500"><span class="material-icons animate-spin">refresh</span> Iniciando conexão segura...</td></tr>';
        
        try {
            await garantirAuthManager();
            const urlBase = window.authManager.apiUrl;
            const headersSeguros = await window.authManager.getAuthHeaders();

            let url = `${urlBase}/api/filiais`;
            const statusValue = filtroStatus.value;
            if (statusValue !== "") {
                url += `?ativo=${statusValue}`;
            }

            const response = await fetch(url, { method: 'GET', headers: headersSeguros });
            const data = await response.json();

            if (!response.ok || !data.success) throw new Error(data.message || "Erro ao buscar filiais.");

            listaFiliaisGlobal = data.data || [];
            renderizarTabela(listaFiliaisGlobal);

        } catch (error) {
            tabelaFiliais.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500">Falha na conexão: ${error.message}</td></tr>`;
            mostrarToast(error.message, 'erro');
        }
    }

    function renderizarTabela(filiais) {
        if (filiais.length === 0) {
            tabelaFiliais.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-500">Nenhuma filial encontrada.</td></tr>';
            return;
        }

        tabelaFiliais.innerHTML = '';
        filiais.forEach(f => {
            const statusBadge = f.ativo 
                ? `<span class="px-2 py-1 bg-white/10 text-white text-[10px] rounded-sm border border-white/20">Ativa</span>` 
                : `<span class="px-2 py-1 bg-red-900/30 text-red-400 text-[10px] rounded-sm border border-red-900/50">Inativa</span>`;
            
            let iconeTipo = 'storefront';
            if(f.tipo === 'site') iconeTipo = 'language';
            if(f.tipo === 'deposito') iconeTipo = 'inventory_2';
            if(f.tipo === 'escritorio') iconeTipo = 'business';

            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-900/30 transition-colors group";
            tr.innerHTML = `
                <td class="p-4 text-white font-medium">
                    ${f.nome}
                    <div class="text-[10px] text-gray-500 tracking-widest uppercase mt-1">Cód: ${f.codigo || 'N/A'}</div>
                </td>
                <td class="p-4 text-gray-400 uppercase text-[10px] tracking-widest flex items-center gap-2 mt-2">
                    <span class="material-icons text-sm text-gray-500">${iconeTipo}</span> ${f.tipo}
                </td>
                <td class="p-4 text-gray-400 hidden md:table-cell text-xs">
                    ${f.cidade ? `${f.cidade} - ${f.estado}` : 'Não informado'}
                </td>
                <td class="p-4">
                    ${statusBadge}
                </td>
                <td class="p-4 text-right">
                    <button class="btn-editar text-gray-500 hover:text-white transition-colors mr-3" data-id="${f.id}" title="Editar">
                        <span class="material-icons text-sm">edit</span>
                    </button>
                    ${f.ativo ? `
                    <button class="btn-desativar text-gray-500 hover:text-red-500 transition-colors" data-id="${f.id}" title="Desativar">
                        <span class="material-icons text-sm">block</span>
                    </button>
                    ` : ''}
                </td>
            `;
            tabelaFiliais.appendChild(tr);
        });

        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', (e) => abrirModalEdicao(e.currentTarget.dataset.id));
        });
        document.querySelectorAll('.btn-desativar').forEach(btn => {
            btn.addEventListener('click', (e) => abrirModalDelete(e.currentTarget.dataset.id));
        });
    }

    // --- 5. FUNÇÕES DE MODAL ---
    function abrirModal(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => modal.classList.remove('opacity-0'), 10);
    }

    function fecharModal(modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
            formFilial.reset();
        }, 300);
    }

    function mostrarToast(mensagem, tipo = 'sucesso') {
        toastMsg.textContent = mensagem;
        if (tipo === 'erro') {
            toastIcon.textContent = 'error';
            toastIcon.className = 'material-icons text-red-600';
        } else {
            toastIcon.textContent = 'check_circle';
            toastIcon.className = 'material-icons text-green-600';
        }
        toast.classList.remove('translate-y-20', 'opacity-0');
        setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
    }

    // --- 6. CRIAR / EDITAR FILIAL (POST / PUT) ---
    document.getElementById('btn-nova-filial').addEventListener('click', () => {
        modalTitulo.textContent = "Nova Filial";
        document.getElementById('filial-id').value = ""; 
        document.getElementById('filial-ativo').value = "true";
        abrirModal(modalForm);
    });

    function abrirModalEdicao(idStr) {
        const id = parseInt(idStr);
        const filial = listaFiliaisGlobal.find(f => f.id === id);
        if(!filial) return;

        modalTitulo.textContent = "Editar Filial";
        document.getElementById('filial-id').value = filial.id;
        document.getElementById('filial-nome').value = filial.nome || "";
        document.getElementById('filial-tipo').value = filial.tipo || "loja";
        document.getElementById('filial-codigo').value = filial.codigo || "";
        document.getElementById('filial-ativo').value = (filial.ativo === 1 || filial.ativo === true) ? "true" : "false";
        document.getElementById('filial-telefone').value = filial.telefone || "";
        document.getElementById('filial-email').value = filial.email || "";
        document.getElementById('filial-rua').value = filial.rua || "";
        document.getElementById('filial-cep').value = filial.cep || "";
        document.getElementById('filial-cidade').value = filial.cidade || "";
        document.getElementById('filial-estado').value = filial.estado || "";
        document.getElementById('filial-horario').value = filial.horario_funcionamento || "";

        abrirModal(modalForm);
    }

    document.getElementById('btn-salvar-filial').addEventListener('click', async (e) => {
        e.preventDefault();
        
        const nome = document.getElementById('filial-nome').value.trim();
        const tipo = document.getElementById('filial-tipo').value;
        if (!nome || !tipo) {
            mostrarToast("Preencha o Nome e o Tipo.", 'erro');
            return;
        }

        const id = document.getElementById('filial-id').value;
        const payload = {
            nome: nome,
            tipo: tipo,
            codigo: document.getElementById('filial-codigo').value,
            telefone: document.getElementById('filial-telefone').value,
            email: document.getElementById('filial-email').value,
            rua: document.getElementById('filial-rua').value,
            cep: document.getElementById('filial-cep').value,
            cidade: document.getElementById('filial-cidade').value,
            estado: document.getElementById('filial-estado').value,
            horario_funcionamento: document.getElementById('filial-horario').value,
            ativo: document.getElementById('filial-ativo').value === "true"
        };

        const btnSalvar = document.getElementById('btn-salvar-filial');
        const iconOriginal = document.getElementById('icon-salvar').textContent;
        btnSalvar.disabled = true;
        document.getElementById('icon-salvar').textContent = 'autorenew';
        document.getElementById('icon-salvar').classList.add('animate-spin');

        try {
            const headersSeguros = await window.authManager.getAuthHeaders();
            const urlBase = window.authManager.apiUrl;

            let url = `${urlBase}/api/filiais`;
            let method = 'POST';

            if (id) {
                url += `/${id}`;
                method = 'PUT';
            }

            const response = await fetch(url, {
                method: method,
                headers: headersSeguros,
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Erro ao salvar.");

            fecharModal(modalForm);
            mostrarToast(id ? "Filial atualizada com sucesso!" : "Filial criada com sucesso!");
            carregarFiliais();

        } catch (error) {
            mostrarToast(error.message, 'erro');
        } finally {
            btnSalvar.disabled = false;
            document.getElementById('icon-salvar').textContent = iconOriginal;
            document.getElementById('icon-salvar').classList.remove('animate-spin');
        }
    });

    // --- 7. DESATIVAR FILIAL (DELETE) ---
    function abrirModalDelete(id) {
        document.getElementById('delete-id').value = id;
        abrirModal(modalDelete);
    }

    document.getElementById('btn-confirmar-delete').addEventListener('click', async () => {
        const id = document.getElementById('delete-id').value;
        const btnDelete = document.getElementById('btn-confirmar-delete');
        btnDelete.disabled = true;
        btnDelete.innerHTML = "Processando...";

        try {
            const headersSeguros = await window.authManager.getAuthHeaders();
            const urlBase = window.authManager.apiUrl;

            const response = await fetch(`${urlBase}/api/filiais/${id}`, {
                method: 'DELETE',
                headers: headersSeguros
            });

            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Erro ao desativar.");

            fecharModal(modalDelete);
            mostrarToast("Filial desativada com sucesso.");
            carregarFiliais();

        } catch (error) {
            mostrarToast(error.message, 'erro');
        } finally {
            btnDelete.disabled = false;
            btnDelete.innerHTML = "Desativar";
        }
    });

    // --- 8. EVENTOS EXTRAS ---
    document.getElementById('btn-fechar-modal').addEventListener('click', () => fecharModal(modalForm));
    document.getElementById('btn-cancelar-modal').addEventListener('click', () => fecharModal(modalForm));
    document.getElementById('btn-cancelar-delete').addEventListener('click', () => fecharModal(modalDelete));
    filtroStatus.addEventListener('change', carregarFiliais);

    // --- INICIALIZAÇÃO ---
    carregarFiliais();
});
