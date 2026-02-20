/**
 * MÓDULO DE AUTENTICAÇÃO E CONEXÃO - BOUTIQUE DINIZ
 * Gerencia a URL da API, a API Key e o Token de Integração com segurança máxima.
 */

class AuthManager {
  // Campos privados (iniciados com #) não podem ser acessados fora desta classe.
  // Isso impede que curiosos usem o F12 (Console) para ler ou roubar o Token ativo.
  #apiUrl;
  #apiKey;
  #currentToken;
  #expiresAt;

  constructor() {
    // Credenciais da sua API
    this.#apiUrl = 'https://botiquedinizsistema.onrender.com';
    this.#apiKey = '1526';
    
    this.#currentToken = null;
    this.#expiresAt = null;
  }

  /**
   * Getter público: Permite que outras páginas saibam qual é a URL da API
   * sem expor ou permitir a modificação da variável privada #apiUrl.
   */
  get apiUrl() {
    return this.#apiUrl;
  }

  /**
   * Método Privado: Verifica internamente se o token atual ainda é válido
   */
  #isTokenValid() {
    if (!this.#currentToken || !this.#expiresAt) return false;
    // Adiciona uma margem de segurança de 60 segundos antes de expirar
    return Date.now() < (this.#expiresAt - 60000);
  }

  /**
   * POST /api/token — Gera e armazena o token de integração
   */
  async generateToken() {
    try {
      const response = await fetch(`${this.#apiUrl}/api/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.#apiKey
        }
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Falha ao gerar token de segurança.');
      }

      // Armazena o token de forma segura nos campos privados
      this.#currentToken = data.data.token;
      
      // Calcula o tempo exato de expiração em milissegundos
      const expiresInMs = data.data.expires_in_seconds * 1000;
      this.#expiresAt = Date.now() + expiresInMs;

      console.log('✅ Token de integração gerado e blindado na memória.');
      return true;

    } catch (error) {
      console.error('❌ Erro na geração do token:', error.message);
      return false;
    }
  }

  /**
   * Retorna os cabeçalhos obrigatórios para qualquer requisição protegida.
   * A MÁGICA: Se o token não existir ou estiver expirando, ele gera um novo automaticamente antes de devolver!
   */
  async getAuthHeaders() {
    if (!this.#isTokenValid()) {
      const success = await this.generateToken();
      if (!success) {
        throw new Error('Falha de comunicação de segurança com o servidor principal.');
      }
    }

    return {
      'Content-Type': 'application/json',
      'x-api-key': this.#apiKey,
      'x-api-token': this.#currentToken
    };
  }

  /**
   * POST /api/token/revoke — Revoga o token atual (Útil no momento do Logout)
   */
  async revokeToken() {
    if (!this.#currentToken) {
      return true; // Se não tem token, já está "revogado" na prática
    }

    try {
      const response = await fetch(`${this.#apiUrl}/api/token/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.#apiKey,
          'x-api-token': this.#currentToken 
        },
        body: JSON.stringify({
          token: this.#currentToken 
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Falha ao revogar token');
      }

      // Limpa os dados da memória por segurança
      this.#currentToken = null;
      this.#expiresAt = null;

      console.log('✅ Token revogado e destruído com sucesso.');
      return true;

    } catch (error) {
      console.error('❌ Erro ao revogar token:', error.message);
      return false;
    }
  }
}

// Exporta uma única instância global (Singleton) para o navegador.
// Ao importar este arquivo no HTML, as outras páginas poderão usar: window.authManager
window.authManager = new AuthManager();
