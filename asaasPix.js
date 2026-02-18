/**
 * =====================================================
 *  AsaasPix.js - Sistema de Pagamento via Pix com Asaas
 * =====================================================
 * Autor: Sistema AsaasPix
 * Versão: 1.0.0
 * Descrição: Geração de cobranças Pix, QR Code Base64,
 *            polling de status e webhook de confirmação
 * =====================================================
 */

const https = require("https");
const http = require("http");
const url = require("url");
const crypto = require("crypto");

// =====================================================
// CONFIGURAÇÃO
// =====================================================
const CONFIG = {
  API_KEY: process.env.ASAAS_API_KEY || "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmNmZmFmZGQ2LTg2NDktNDJmMi1hOGY3LWRkYmE1OWI2MGI5Yzo6JGFhY2hfOGZkOGIwNmYtMWU4MS00NDdmLWE0MjMtNzY4ZDg2MDhlMTk0",
  AMBIENTE: process.env.ASAAS_AMBIENTE || "production", // 'sandbox' ou 'production'
  POLLING_INTERVAL_MS: 5000,   // checar status a cada 5 segundos
  POLLING_MAX_TENTATIVAS: 60,  // máximo de 5 minutos
  WEBHOOK_PORT: process.env.PORT || 3000,
};

// URL base conforme ambiente
const BASE_URL =
  CONFIG.AMBIENTE === "production"
    ? "api.asaas.com"
    : "sandbox.asaas.com";

// =====================================================
// UTILITÁRIOS HTTP
// =====================================================

/**
 * Faz requisição HTTPS para a API do Asaas
 */
function asaasRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: `/api/v3${path}`,
      method: method,
      headers: {
        "Content-Type": "application/json",
        access_token: CONFIG.API_KEY,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(
              new Error(
                `Asaas API erro ${res.statusCode}: ${JSON.stringify(json)}`
              )
            );
          }
        } catch (e) {
          reject(new Error(`Resposta inválida da API: ${data}`));
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// =====================================================
// 1. CRIAR OU BUSCAR CLIENTE
// =====================================================

/**
 * Cria um cliente no Asaas
 * @param {Object} dadosCliente - { nome, cpfCnpj, email, telefone }
 * @returns {Object} cliente criado
 */
async function criarCliente(dadosCliente) {
  const payload = {
    name: dadosCliente.nome,
    cpfCnpj: dadosCliente.cpfCnpj.replace(/\D/g, ""), // limpa máscara
    email: dadosCliente.email || undefined,
    phone: dadosCliente.telefone || undefined,
    notificationDisabled: false,
  };

  console.log(`[AsaasPix] Criando cliente: ${dadosCliente.nome}`);
  const cliente = await asaasRequest("POST", "/customers", payload);
  console.log(`[AsaasPix] Cliente criado com ID: ${cliente.id}`);
  return cliente;
}

/**
 * Busca cliente existente por CPF/CNPJ
 * @param {string} cpfCnpj
 * @returns {Object|null} cliente encontrado ou null
 */
async function buscarClientePorCpfCnpj(cpfCnpj) {
  const doc = cpfCnpj.replace(/\D/g, "");
  const resultado = await asaasRequest(
    "GET",
    `/customers?cpfCnpj=${doc}`
  );
  if (resultado.data && resultado.data.length > 0) {
    console.log(`[AsaasPix] Cliente encontrado: ${resultado.data[0].id}`);
    return resultado.data[0];
  }
  return null;
}

/**
 * Cria cliente se não existir, ou retorna o existente
 */
async function criarOuBuscarCliente(dadosCliente) {
  const existente = await buscarClientePorCpfCnpj(dadosCliente.cpfCnpj);
  if (existente) return existente;
  return await criarCliente(dadosCliente);
}

// =====================================================
// 2. GERAR COBRANÇA PIX
// =====================================================

/**
 * Cria uma cobrança Pix no Asaas
 * @param {string} clienteId   - ID do cliente no Asaas
 * @param {number} valor       - Valor em reais (ex: 150.00)
 * @param {string} descricao   - Descrição da cobrança
 * @param {number} diasVencto  - Dias para vencimento (padrão: 1)
 * @returns {Object} cobrança criada
 */
async function criarCobrancaPix(clienteId, valor, descricao, diasVencto = 1) {
  const hoje = new Date();
  hoje.setDate(hoje.getDate() + diasVencto);
  const vencimento = hoje.toISOString().split("T")[0]; // YYYY-MM-DD

  const payload = {
    customer: clienteId,
    billingType: "PIX",
    value: valor,
    dueDate: vencimento,
    description: descricao,
    externalReference: `PIX-${Date.now()}`, // referência interna
  };

  console.log(`[AsaasPix] Criando cobrança Pix: R$ ${valor.toFixed(2)}`);
  const cobranca = await asaasRequest("POST", "/payments", payload);
  console.log(`[AsaasPix] Cobrança criada com ID: ${cobranca.id}`);
  return cobranca;
}

// =====================================================
// 3. OBTER QR CODE PIX
// =====================================================

/**
 * Obtém o QR Code Pix da cobrança
 * @param {string} cobrancaId - ID da cobrança
 * @returns {Object} { encodedImage (base64), payload (copia e cola) }
 */
async function obterQrCodePix(cobrancaId) {
  console.log(`[AsaasPix] Obtendo QR Code para cobrança: ${cobrancaId}`);
  const qrCode = await asaasRequest(
    "GET",
    `/payments/${cobrancaId}/pixQrCode`
  );

  return {
    cobrancaId,
    base64: qrCode.encodedImage,        // imagem QR Code em Base64 (PNG)
    copiaCola: qrCode.payload,           // texto "Pix Copia e Cola"
    dataExpiracao: qrCode.expirationDate,
  };
}

// =====================================================
// 4. CONSULTAR STATUS DO PAGAMENTO
// =====================================================

/**
 * Consulta o status atual de uma cobrança
 * @param {string} cobrancaId
 * @returns {string} status: PENDING | RECEIVED | CONFIRMED | OVERDUE | REFUNDED
 */
async function consultarStatusPagamento(cobrancaId) {
  const cobranca = await asaasRequest("GET", `/payments/${cobrancaId}`);
  return cobranca.status;
}

// =====================================================
// 5. POLLING AUTOMÁTICO DE STATUS
// =====================================================

/**
 * Aguarda o pagamento via polling até receber confirmação ou timeout
 * @param {string} cobrancaId
 * @param {Function} onPago    - callback(cobrancaId) chamado quando pago
 * @param {Function} onTimeout - callback(cobrancaId) chamado se expirar
 * @param {Function} onErro    - callback(erro) em caso de falha
 */
function aguardarPagamento(cobrancaId, onPago, onTimeout, onErro) {
  let tentativas = 0;
  const statusPagos = ["RECEIVED", "CONFIRMED"];

  console.log(
    `[AsaasPix] Iniciando polling para cobrança: ${cobrancaId}`
  );

  const intervalo = setInterval(async () => {
    tentativas++;

    try {
      const status = await consultarStatusPagamento(cobrancaId);
      console.log(
        `[AsaasPix] [${tentativas}/${CONFIG.POLLING_MAX_TENTATIVAS}] Status: ${status}`
      );

      if (statusPagos.includes(status)) {
        clearInterval(intervalo);
        console.log(`[AsaasPix] ✅ Pagamento confirmado!`);
        onPago && onPago(cobrancaId, status);
        return;
      }

      if (tentativas >= CONFIG.POLLING_MAX_TENTATIVAS) {
        clearInterval(intervalo);
        console.log(`[AsaasPix] ⏰ Timeout de polling atingido`);
        onTimeout && onTimeout(cobrancaId);
      }
    } catch (erro) {
      clearInterval(intervalo);
      console.error(`[AsaasPix] ❌ Erro no polling:`, erro.message);
      onErro && onErro(erro);
    }
  }, CONFIG.POLLING_INTERVAL_MS);

  // Retorna função para cancelar o polling manualmente
  return () => {
    clearInterval(intervalo);
    console.log(`[AsaasPix] Polling cancelado para: ${cobrancaId}`);
  };
}

// =====================================================
// 6. FLUXO COMPLETO: GERAR PIX
// =====================================================

/**
 * Fluxo completo: cria cliente → cria cobrança → obtém QR Code
 *
 * @param {Object} dadosCliente  - { nome, cpfCnpj, email, telefone }
 * @param {number} valor         - Valor em reais
 * @param {string} descricao     - Descrição do pagamento
 * @param {Object} opcoes        - { diasVencto, polling, onPago, onTimeout }
 *
 * @returns {Object} {
 *   cliente, cobranca, qrCode: { base64, copiaCola, dataExpiracao },
 *   cancelarPolling
 * }
 */
async function gerarPix(dadosCliente, valor, descricao, opcoes = {}) {
  const { diasVencto = 1, polling = true, onPago, onTimeout, onErro } = opcoes;

  // 1. Cria ou busca cliente
  const cliente = await criarOuBuscarCliente(dadosCliente);

  // 2. Cria cobrança Pix
  const cobranca = await criarCobrancaPix(
    cliente.id,
    valor,
    descricao,
    diasVencto
  );

  // 3. Obtém QR Code Base64 + Copia e Cola
  const qrCode = await obterQrCodePix(cobranca.id);

  // 4. (Opcional) Inicia polling de status
  let cancelarPolling = null;
  if (polling) {
    cancelarPolling = aguardarPagamento(
      cobranca.id,
      onPago || ((id, status) =>
        console.log(`[AsaasPix] Pago! Cobrança ${id} - Status: ${status}`)
      ),
      onTimeout || ((id) =>
        console.log(`[AsaasPix] Timeout para cobrança ${id}`)
      ),
      onErro || ((e) => console.error(`[AsaasPix] Erro polling:`, e))
    );
  }

  return { cliente, cobranca, qrCode, cancelarPolling };
}

// =====================================================
// 7. SERVIDOR WEBHOOK (receber notificações do Asaas)
// =====================================================

/**
 * Sobe um servidor HTTP simples para receber webhooks do Asaas
 * Configure no painel Asaas: https://SEU-DOMINIO/webhook/asaas
 *
 * @param {Function} onEvento - callback({ evento, cobrancaId, status, dados })
 */
function iniciarServidorWebhook(onEvento) {
  const server = http.createServer((req, res) => {
    const rota = url.parse(req.url).pathname;

    // Rota de saúde
    if (req.method === "GET" && rota === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", sistema: "AsaasPix" }));
      return;
    }

    // Rota do webhook
    if (req.method === "POST" && rota === "/webhook/asaas") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const dados = JSON.parse(body);
          const evento = dados.event;
          const cobranca = dados.payment || {};

          console.log(
            `[Webhook] Evento recebido: ${evento} | Cobrança: ${cobranca.id} | Status: ${cobranca.status}`
          );

          // Dispara callback com os dados
          if (onEvento) {
            onEvento({
              evento,
              cobrancaId: cobranca.id,
              status: cobranca.status,
              valor: cobranca.value,
              dataHora: cobranca.paymentDate || new Date().toISOString(),
              dados,
            });
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ recebido: true }));
        } catch (e) {
          console.error("[Webhook] Erro ao processar:", e.message);
          res.writeHead(400);
          res.end("Bad Request");
        }
      });
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  server.listen(CONFIG.WEBHOOK_PORT, () => {
    console.log(
      `[AsaasPix] Servidor Webhook rodando em http://localhost:${CONFIG.WEBHOOK_PORT}`
    );
    console.log(
      `[AsaasPix] Configure no Asaas: POST https://SEU-DOMINIO/webhook/asaas`
    );
  });

  return server;
}

// =====================================================
// EXPORTAÇÕES
// =====================================================
module.exports = {
  gerarPix,
  criarCliente,
  criarOuBuscarCliente,
  criarCobrancaPix,
  obterQrCodePix,
  consultarStatusPagamento,
  aguardarPagamento,
  iniciarServidorWebhook,
  CONFIG,
};

// =====================================================
// EXEMPLO DE USO DIRETO (node AsaasPix.js)
// =====================================================
if (require.main === module) {
  (async () => {
    console.log("=".repeat(50));
    console.log("  AsaasPix.js - Exemplo de Uso");
    console.log("=".repeat(50));

    try {
      const resultado = await gerarPix(
        {
          nome: "João Silva",
          cpfCnpj: "123.456.789-09",
          email: "joao@email.com",
          telefone: "(11) 99999-9999",
        },
        150.0,
        "Pedido #1001 - Produto XYZ",
        {
          diasVencto: 1,
          polling: true,
          onPago: (id, status) => {
            console.log(`\n✅ PAGAMENTO CONFIRMADO!`);
            console.log(`   Cobrança: ${id}`);
            console.log(`   Status: ${status}`);
          },
          onTimeout: (id) => {
            console.log(`\n⏰ Tempo esgotado. Cobrança: ${id}`);
          },
        }
      );

      console.log("\n--- RESULTADO ---");
      console.log(`Cliente ID   : ${resultado.cliente.id}`);
      console.log(`Cobrança ID  : ${resultado.cobranca.id}`);
      console.log(`Valor        : R$ ${resultado.cobranca.value.toFixed(2)}`);
      console.log(`Vencimento   : ${resultado.cobranca.dueDate}`);
      console.log(
        `\nPix Copia e Cola:\n${resultado.qrCode.copiaCola}`
      );
      console.log(
        `\nQR Code Base64 (primeiros 80 chars):\n${resultado.qrCode.base64?.substring(0, 80)}...`
      );
      console.log("\nAguardando pagamento via polling...");
    } catch (erro) {
      console.error("\n❌ Erro:", erro.message);
    }
  })();
}


