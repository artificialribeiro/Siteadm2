/**
 * MÓDULO DE MENU LATERAL - BOUTIQUE DINIZ
 * Injeta a barra lateral e gerencia permissões de acesso por Grupo (Admin, Vendas, Financeiro).
 */

const MenuGlobal = (function() {
    
    const menuCSS = `
    <style>
        .submenu-transition { transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out; max-height: 0; opacity: 0; overflow: hidden; }
        .submenu-open { max-height: 500px; opacity: 1; }
        .menu-btn { border-left: 2px solid transparent; transition: all 0.3s ease; }
        .menu-btn:hover { border-left: 2px solid #FFFFFF; background: linear-gradient(90deg, rgba(30,30,30,1) 0%, rgba(10,10,10,0) 100%); }
        .menu-btn:hover .icon-bounce { transform: scale(1.1); color: #FFFFFF; }
        .submenu-item { position: relative; transition: color 0.3s ease; display: block; }
        .submenu-item::before { content: ''; position: absolute; left: -15px; top: 50%; width: 4px; height: 4px; border-radius: 50%; background-color: #FFFFFF; transform: translateY(-50%) scale(0); transition: transform 0.3s ease; }
        .submenu-item:hover::before { transform: translateY(-50%) scale(1); }
        #sidebar ::-webkit-scrollbar { width: 3px; }
        #sidebar ::-webkit-scrollbar-track { background: transparent; }
        #sidebar ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        #sidebar ::-webkit-scrollbar-thumb:hover { background: #fff; }
    </style>
    `;

    const menuHTML = `
    <div id="mobile-overlay" class="fixed inset-0 bg-black/95 backdrop-blur-sm z-40 hidden md:hidden transition-opacity opacity-0"></div>

    <aside id="sidebar" class="fixed md:static inset-y-0 left-0 z-50 w-[280px] bg-brand-gray/90 backdrop-blur-xl border-r border-gray-900/80 transform -translate-x-full md:translate-x-0 transition-transform duration-500 ease-in-out flex flex-col h-full shadow-2xl md:shadow-none shrink-0">
        
        <div class="h-32 shrink-0 flex items-center justify-center relative border-b border-gray-900/50 bg-brand-black/50">
            <img src="logo.png" alt="Boutique Diniz" class="h-24 w-auto object-contain">
            <button id="btn-close-menu" class="md:hidden absolute right-4 top-4 text-gray-400 hover:text-white transition-colors">
                <span class="material-icons">close</span>
            </button>
        </div>

        <nav class="flex-1 overflow-y-auto py-6 px-4 space-y-2 text-sm font-medium z-10">
            
            <a href="dashboard.html" id="menu-dashboard" class="flex items-center px-4 py-3 text-white bg-gradient-to-r from-gray-800 to-transparent rounded-lg group border-l-2 border-white shadow-md">
                <span class="material-icons mr-3 text-white">dashboard</span>
                Visão Geral
            </a>

            <div id="menu-vendas">
                <button class="menu-btn w-full flex items-center justify-between px-4 py-3 text-gray-400 rounded-lg group">
                    <div class="flex items-center">
                        <span class="material-icons mr-3 icon-bounce transition-all duration-300">point_of_sale</span> Vendas
                    </div>
                    <span class="material-icons text-sm transition-transform duration-300 chevron">expand_more</span>
                </button>
                <div class="submenu-transition flex flex-col pl-14 pr-4 space-y-3 mt-2 mb-2">
                    <a href="pdv.html" id="link-pdv" class="submenu-item text-gray-500 hover:text-white">PDV (Frente de Caixa)</a>
                    <a href="meus-caixas.html" id="link-meus-caixas" class="submenu-item text-gray-500 hover:text-white">Meus Caixas</a>
                    <a href="saldo-detalhado.html" id="link-saldo-detalhado" class="submenu-item text-gray-500 hover:text-white">Saldo Detalhado</a>
                </div>
            </div>

            <div id="menu-produtos">
                <button class="menu-btn w-full flex items-center justify-between px-4 py-3 text-gray-400 rounded-lg group">
                    <div class="flex items-center">
                        <span class="material-icons mr-3 icon-bounce transition-all duration-300">inventory_2</span> Produtos
                    </div>
                    <span class="material-icons text-sm transition-transform duration-300 chevron">expand_more</span>
                </button>
                <div class="submenu-transition flex flex-col pl-14 pr-4 space-y-3 mt-2 mb-2">
                    <a href="cadastro-produtos.html" id="link-cadastro-produtos" class="submenu-item text-gray-500 hover:text-white">Cadastro de Produtos</a>
                    <a href="estoque.html" id="link-estoque" class="submenu-item text-gray-500 hover:text-white">Estoque</a>
                    <a href="gerar-etiquetas.html" id="link-gerar-etiquetas" class="submenu-item text-gray-500 hover:text-white">Gerar Etiquetas</a>
                </div>
            </div>

            <div id="menu-ecommerce">
                <button class="menu-btn w-full flex items-center justify-between px-4 py-3 text-gray-400 rounded-lg group">
                    <div class="flex items-center">
                        <span class="material-icons mr-3 icon-bounce transition-all duration-300">shopping_cart</span> E-commerce
                    </div>
                    <span class="material-icons text-sm transition-transform duration-300 chevron">expand_more</span>
                </button>
                <div class="submenu-transition flex flex-col pl-14 pr-4 space-y-3 mt-2 mb-2">
                    <a href="vendas-ecommerce.html" class="submenu-item text-gray-500 hover:text-white">Vendas E-commerce</a>
                    <a href="gerenciar-rastreio.html" class="submenu-item text-gray-500 hover:text-white">Gerenciar Rastreio</a>
                    <a href="carrossel-site.html" class="submenu-item text-gray-500 hover:text-white">Carrossel Site</a>
                    <a href="notificacoes-ecommerce.html" class="submenu-item text-gray-500 hover:text-white">Notificações</a>
                    <a href="cartao-presente.html" class="submenu-item text-gray-500 hover:text-white">Cartão Presente</a>
                </div>
            </div>

            <div id="menu-caixa">
                <button class="menu-btn w-full flex items-center justify-between px-4 py-3 text-gray-400 rounded-lg group">
                    <div class="flex items-center">
                        <span class="material-icons mr-3 icon-bounce transition-all duration-300">account_balance_wallet</span> Caixa
                    </div>
                    <span class="material-icons text-sm transition-transform duration-300 chevron">expand_more</span>
                </button>
                <div class="submenu-transition flex flex-col pl-14 pr-4 space-y-3 mt-2 mb-2">
                    <a href="validar-caixas.html" class="submenu-item text-gray-500 hover:text-white">Validar Caixas</a>
                    <a href="correcao-lancamentos.html" class="submenu-item text-gray-500 hover:text-white">Correção Lançamentos</a>
                    <a href="caixa-geral.html" class="submenu-item text-gray-500 hover:text-white">Caixa Geral</a>
                    <a href="imprimir-caixas.html" class="submenu-item text-gray-500 hover:text-white">Imprimir Caixas</a>
                </div>
            </div>

            <div id="menu-relatorio">
                <button class="menu-btn w-full flex items-center justify-between px-4 py-3 text-gray-400 rounded-lg group">
                    <div class="flex items-center">
                        <span class="material-icons mr-3 icon-bounce transition-all duration-300">bar_chart</span> Relatório
                    </div>
                    <span class="material-icons text-sm transition-transform duration-300 chevron">expand_more</span>
                </button>
                <div class="submenu-transition flex flex-col pl-14 pr-4 space-y-3 mt-2 mb-2">
                    <a href="relatorio-vendas-site.html" class="submenu-item text-gray-500 hover:text-white">Vendas Site</a>
                    <a href="relatorio-vendas-loja.html" class="submenu-item text-gray-500 hover:text-white">Vendas Loja</a>
                </div>
            </div>

            <div class="h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent my-6"></div>

            <div id="menu-configuracoes">
                <button class="menu-btn w-full flex items-center justify-between px-4 py-3 text-gray-400 rounded-lg group">
                    <div class="flex items-center">
                        <span class="material-icons mr-3 icon-bounce transition-all duration-300">tune</span> Configurações
                    </div>
                    <span class="material-icons text-sm transition-transform duration-300 chevron">expand_more</span>
                </button>
                <div class="submenu-transition flex flex-col pl-14 pr-4 space-y-3 mt-2 mb-2">
                    <a href="configuracoes-usuarios.html" class="submenu-item text-gray-500 hover:text-white">Usuários</a>
                    <a href="configuracoes-lojas.html" class="submenu-item text-gray-500 hover:text-white">Lojas e Filiais</a>
                    <a href="configuracoes-backups.html" class="submenu-item text-gray-500 hover:text-white">Backups</a>
                </div>
            </div>
        </nav>

        <div class="shrink-0 p-4 border-t border-gray-900 bg-brand-black/80 z-10">
            <button class="menu-btn w-full flex items-center justify-between px-4 py-3 text-gray-400 rounded-lg group">
                <div class="flex items-center">
                    <span class="material-icons mr-3 icon-bounce">account_circle</span> Minha Conta
                </div>
                <span class="material-icons text-sm transition-transform duration-300 chevron">expand_more</span>
            </button>
            <div class="submenu-transition flex flex-col pl-14 pr-4 mt-2">
                <button id="btn-logout-sidebar" class="py-2 text-left text-gray-500 hover:text-white transition-colors flex items-center group">
                    <span class="material-icons text-sm mr-2 group-hover:-translate-x-1 transition-transform">logout</span> Sair do Sistema
                </button>
            </div>
        </div>
    </aside>
    `;

    function init() {
        document.head.insertAdjacentHTML('beforeend', menuCSS);
        document.body.insertAdjacentHTML('afterbegin', menuHTML);
        bindEvents();
        marcarMenuAtivo();
        aplicarPermissoes(); // Chama a função de segurança visual
    }

    function aplicarPermissoes() {
        const usuarioStr = sessionStorage.getItem('usuario');
        if (!usuarioStr) return;
        
        const usuario = JSON.parse(usuarioStr);
        const grupo = parseInt(usuario.grupo_acesso_id);

        // 1 = Administrador (Vê absolutamente tudo)
        // 2 = Equipe de Vendas / Atendente
        // 3 = Financeiro / Administrativo
        
        if (grupo === 2) {
            // Vendedora não vê Caixa Geral, Relatórios e Configurações do Sistema
            document.getElementById('menu-caixa').style.display = 'none';
            document.getElementById('menu-relatorio').style.display = 'none';
            document.getElementById('menu-configuracoes').style.display = 'none';
            
            // Oculta links específicos de cadastro que vendedor não deve acessar
            const linkSaldo = document.getElementById('link-saldo-detalhado');
            if(linkSaldo) linkSaldo.style.display = 'none';
            
            const linkCadastroProd = document.getElementById('link-cadastro-produtos');
            if(linkCadastroProd) linkCadastroProd.style.display = 'none';
            
            // NOTE: E-commerce (menu-ecommerce) continua totalmente visível para as vendedoras!
        }
        
        if (grupo === 3) {
            // Financeiro não faz frente de caixa (PDV)
            document.getElementById('menu-vendas').style.display = 'none'; 
            // Financeiro não gerencia Lojas, Usuários do Sistema e Backups
            document.getElementById('menu-configuracoes').style.display = 'none'; 
            
            // NOTE: E-commerce (menu-ecommerce) continua totalmente visível para o financeiro!
        }
    }

    function bindEvents() {
        // MOBILE MENU
        const sidebar = document.getElementById('sidebar');
        const mobileOverlay = document.getElementById('mobile-overlay');
        const btnOpenMenu = document.getElementById('btn-open-menu');
        const btnCloseMenu = document.getElementById('btn-close-menu');

        function openMenu() {
            sidebar.classList.remove('-translate-x-full');
            mobileOverlay.classList.remove('hidden');
            setTimeout(() => { mobileOverlay.classList.remove('opacity-0'); }, 10);
        }

        function closeMenu() {
            sidebar.classList.add('-translate-x-full');
            mobileOverlay.classList.add('opacity-0');
            setTimeout(() => { mobileOverlay.classList.add('hidden'); }, 300); 
        }

        if(btnOpenMenu) btnOpenMenu.addEventListener('click', openMenu);
        if(btnCloseMenu) btnCloseMenu.addEventListener('click', closeMenu);
        if(mobileOverlay) mobileOverlay.addEventListener('click', closeMenu);

        // SANFONA
        const menuButtons = document.querySelectorAll('.menu-btn');
        menuButtons.forEach(button => {
            button.addEventListener('click', function() {
                const submenu = this.nextElementSibling;
                if(!submenu || !submenu.classList.contains('submenu-transition')) return;

                const chevron = this.querySelector('.chevron');
                const isOpen = submenu.classList.contains('submenu-open');

                document.querySelectorAll('.submenu-transition').forEach(el => el.classList.remove('submenu-open'));
                document.querySelectorAll('.chevron').forEach(el => el.style.transform = 'rotate(0deg)');
                document.querySelectorAll('.menu-btn').forEach(el => el.classList.remove('border-white'));

                if (!isOpen) {
                    submenu.classList.add('submenu-open');
                    chevron.style.transform = 'rotate(180deg)';
                    this.classList.add('border-white'); 
                }
            });
        });

        // LOGOUT
        document.getElementById('btn-logout-sidebar').addEventListener('click', () => {
            if(typeof Seguranca !== 'undefined') {
                sessionStorage.clear();
                window.location.replace('login.html');
            } else {
                sessionStorage.clear();
                window.location.href = 'login.html';
            }
        });
    }

    function marcarMenuAtivo() {
        const urlAtual = window.location.pathname.split('/').pop();
        if (!urlAtual || urlAtual === '') return;

        const links = document.querySelectorAll('.submenu-item');
        links.forEach(link => {
            const linkHref = link.getAttribute('href');
            if (linkHref === urlAtual) {
                link.classList.add('text-white', 'font-medium');
                link.classList.remove('text-gray-500');
                
                const submenu = link.closest('.submenu-transition');
                if (submenu) {
                    submenu.classList.add('submenu-open');
                    const btnPai = submenu.previousElementSibling;
                    if (btnPai) {
                        btnPai.classList.add('border-white');
                        const chevron = btnPai.querySelector('.chevron');
                        if (chevron) chevron.style.transform = 'rotate(180deg)';
                    }
                }
            }
        });
    }

    return { init };
})();

document.addEventListener("DOMContentLoaded", MenuGlobal.init);
