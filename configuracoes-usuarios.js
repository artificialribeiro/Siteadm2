document.addEventListener("DOMContentLoaded", () => {
    
    // --- ELEMENTOS DA INTERFACE ---
    const tabelaUsuarios = document.getElementById('tabela-usuarios');
    const selectGrupo = document.getElementById('select-grupo-id');
    const selectFilial = document.getElementById('select-filial-id');
    const modalUsuario = document.getElementById('modal-usuario');
    const formUsuario = document.getElementById('form-usuario');
    const avisoSenha = document.getElementById('aviso-senha');
    
    let listaGrupos = [];
    let listaFiliais = [];
    let listaUsuarios = [];

    // --- MOTOR DE INICIALIZAÇÃO ---
    async function init() {
        // Aguarda o AuthManager do token.js carregar
        if (!window.authManager) return setTimeout(init, 100);
        
        // Preenche info do usuário logado no topo
        const usuarioStr = sessionStorage.getItem('usuario');
        if (usuarioStr) {
            const u = JSON.parse(usuarioStr);
            document.getElementById('topbar-user-name').textContent = u.nome_completo.split(' ')[0];
            document.getElementById('topbar-user-initial').textContent = u.nome_completo.charAt(0).toUpperCase();
            document.getElementById('topbar-user-role').textContent = u.grupo_acesso_id === 1 ? "Administrador" : "Equipe";
        }

        await carregarGrupos();
        await carregarFiliais();
        await carregarUsuarios();
    }

    // --- BUSCAR GRUPOS ---
    async function carregarGrupos() {
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetch(`${window.authManager.apiUrl}/api/grupos`, { headers: h });
            const d = await res.json();
            if (d.success) {
                listaGrupos = d.data;
                selectGrupo.innerHTML = '<option value="" disabled selected>Escolha o nível de acesso</option>';
                listaGrupos.forEach(g => {
                    selectGrupo.innerHTML += `<option value="${g.id}">${g.nome}</option>`;
                });
            }
        } catch (e) { console.error("Erro grupos:", e); }
    }

    // --- BUSCAR FILIAIS ---
    async function carregarFiliais() {
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetch(`${window.authManager.apiUrl}/api/filiais`, { headers: h });
            const d = await res.json();
            if (d.success) {
                listaFiliais = d.data;
                selectFilial.innerHTML = '<option value="">Matriz / Sem Filial</option>';
                listaFiliais.forEach(f => {
                    selectFilial.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
                });
            }
        } catch (e) { console.error("Erro filiais:", e); }
    }

    // --- LISTAR USUÁRIOS ---
    async function carregarUsuarios() {
        tabelaUsuarios.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-600 animate-pulse text-xs tracking-widest uppercase">Buscando Equipe...</td></tr>';
        try {
            const h = await window.authManager.getAuthHeaders();
            const res = await fetch(`${window.authManager.apiUrl}/api/usuarios`, { headers: h });
            const d = await res.json();

            if (d.success) {
                listaUsuarios = d.data.itens || [];
                tabelaUsuarios.innerHTML = '';
                
                listaUsuarios.forEach(u => {
                    const gNome = listaGrupos.find(x => x.id == u.grupo_acesso_id)?.nome || `Grupo ${u.grupo_acesso_id}`;
                    const fNome = listaFiliais.find(x => x.id == u.filial_id)?.nome || 'Matriz';
                    
                    const tr = document.createElement('tr');
                    tr.className = "hover:bg-gray-900/30 transition-all group";
                    tr.innerHTML = `
                        <td class="p-4 pl-6 flex items-center gap-3">
                            <div class="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[11px] text-gray-400 font-bold group-hover:border-white transition-all">${u.nome_completo.charAt(0)}</div>
                            <div>
                                <p class="text-white font-medium">${u.nome_completo}</p>
                                <p class="text-[10px] text-gray-500 tracking-wider">@${u.login}</p>
                            </div>
                        </td>
                        <td class="p-4 text-[10px] text-brand-gold font-medium uppercase tracking-widest">${gNome}</td>
                        <td class="p-4 text-xs text-gray-400">${fNome}</td>
                        <td class="p-4"><span class="px-2 py-0.5 rounded-full text-[9px] uppercase border ${u.ativo ? 'border-green-900 text-green-500 bg-green-950/20' : 'border-red-900 text-red-500 bg-red-950/20'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                        <td class="p-4 text-right pr-6">
                            <button class="btn-edit-u text-gray-500 hover:text-white transition-colors" data-id="${u.id}">
                                <span class="material-icons text-sm">edit</span>
                            </button>
                        </td>
                    `;
                    tabelaUsuarios.appendChild(tr);
                });

                document.querySelectorAll('.btn-edit-u').forEach(b => {
                    b.onclick = () => abrirEdicaoUsuario(b.dataset.id);
                });
            }
        } catch (e) { 
            tabelaUsuarios.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-red-500 text-xs">Erro ao carregar lista de usuários.</td></tr>';
        }
    }

    // --- ABRIR MODAL PARA EDIÇÃO ---
    function abrirEdicaoUsuario(id) {
        const u = listaUsuarios.find(x => x.id == id);
        if (!u) return;

        document.getElementById('modal-usuario-titulo').textContent = "Editar Usuário";
        document.getElementById('usuario-id').value = u.id;
        document.getElementById('usuario-nome').value = u.nome_completo;
        document.getElementById('usuario-login').value = u.login;
        document.getElementById('usuario-ativo').value = u.ativo ? "true" : "false";
        document.getElementById('select-grupo-id').value = u.grupo_acesso_id;
        document.getElementById('select-filial-id').value = u.filial_id || "";
        
        // Limpa campo de senha na edição
        document.getElementById('usuario-senha').value = "";
        document.getElementById('usuario-senha').required = false;
        avisoSenha.classList.remove('hidden');

        abrirModal(modalUsuario);
    }

    // --- SALVAR (POST ou PUT) ---
    formUsuario.onsubmit = async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('usuario-id').value;
        const senha = document.getElementById('usuario-senha').value;
        
        // Payload base
        const payload = {
            nome_completo: document.getElementById('usuario-nome').value,
            login: document.getElementById('usuario-login').value,
            grupo_acesso_id: parseInt(document.getElementById('select-grupo-id').value),
            filial_id: document.getElementById('select-filial-id').value ? parseInt(document.getElementById('select-filial-id').value) : null,
            ativo: document.getElementById('usuario-ativo').value === "true"
        };

        // AJUSTE SOLICITADO: Inclui senha no payload apenas se foi preenchida
        if (senha.trim() !== "") {
            payload.senha = senha;
        }

        try {
            const h = await window.authManager.getAuthHeaders();
            const method = id ? 'PUT' : 'POST';
            const url = id ? `${window.authManager.apiUrl}/api/usuarios/${id}` : `${window.authManager.apiUrl}/api/usuarios`;

            const res = await fetch(url, {
                method: method,
                headers: h,
                body: JSON.stringify(payload)
            });

            const d = await res.json();

            if (d.success) {
                mostrarToast(id ? "Dados e Senha atualizados!" : "Usuário criado com sucesso!");
                fecharModal(modalUsuario);
                carregarUsuarios();
            } else {
                mostrarToast(d.message || "Erro ao salvar", 'erro');
            }
        } catch (e) {
            mostrarToast("Falha na conexão com o servidor", 'erro');
        }
    };

    // --- AUXILIARES ---
    function abrirModal(m) { 
        m.classList.remove('hidden'); 
        m.classList.add('flex'); 
        setTimeout(() => m.classList.add('opacity-100'), 10); 
    }
    
    function fecharModal(m) { 
        m.classList.remove('opacity-100'); 
        setTimeout(() => { 
            m.classList.add('hidden'); 
            m.classList.remove('flex'); 
            formUsuario.reset();
            avisoSenha.classList.add('hidden');
        }, 300); 
    }

    document.getElementById('btn-novo-usuario').onclick = () => {
        document.getElementById('modal-usuario-titulo').textContent = "Novo Usuário";
        document.getElementById('usuario-id').value = "";
        document.getElementById('usuario-senha').required = true;
        avisoSenha.classList.add('hidden');
        abrirModal(modalUsuario);
    };

    document.getElementById('btn-fechar-usuario').onclick = () => fecharModal(modalUsuario);
    document.getElementById('btn-cancelar-usuario').onclick = () => fecharModal(modalUsuario);

    function mostrarToast(msg, tipo = 'sucesso') {
        const t = document.getElementById('toast');
        document.getElementById('toast-msg').textContent = msg;
        document.getElementById('toast-icon').textContent = tipo === 'erro' ? 'error' : 'check_circle';
        document.getElementById('toast-icon').className = `material-icons ${tipo === 'erro' ? 'text-red-500' : 'text-green-600'}`;
        t.classList.remove('translate-y-20', 'opacity-0');
        setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 3000);
    }

    init();
});
