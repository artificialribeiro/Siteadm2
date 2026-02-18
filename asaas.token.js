/**
 * ╔══════════════════════════════════════════════════════════╗
 *  CONFIGURAÇÃO ASAAS — BOUTIQUE DINIZ
 *  Substitua o valor abaixo pela sua chave de PRODUÇÃO.
 *  Nunca exponha este arquivo publicamente (adicione ao .gitignore).
 * ╚══════════════════════════════════════════════════════════╝
 */
window.ASAAS_KEY = "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmNmZmFmZGQ2LTg2NDktNDJmMi1hOGY3LWRkYmE1OWI2MGI5Yzo6JGFhY2hfOGZkOGIwNmYtMWU4MS00NDdmLWE0MjMtNzY4ZDg2MDhlMTk0";

/**
 * ──────────────────────────────────────────────────────────
 *  COMO OBTER A CHAVE:
 *  1. Acesse https://www.asaas.com
 *  2. Minha Conta → Integrações → Gerar nova chave de API
 *  3. Copie a chave que começa com $aact_
 *
 *  SEGURANÇA EM PRODUÇÃO:
 *  Este arquivo expõe a chave no client-side (browser).
 *  Para máxima segurança, implemente um endpoint de backend
 *  (Node.js, PHP, etc.) que faça o proxy das requisições
 *  ao Asaas sem expor a chave ao usuário final.
 *
 *  Exemplo de proxy em Node.js (Express):
 *  ─────────────────────────────────────
 *  app.use('/api/asaas', async (req, res) => {
 *    const url = 'https://www.asaas.com/api/v3' + req.path;
 *    const resp = await fetch(url, {
 *      method: req.method,
 *      headers: { 'access_token': process.env.ASAAS_KEY, 'Content-Type': 'application/json' },
 *      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
 *    });
 *    const data = await resp.json();
 *    res.json(data);
 *  });
 * ──────────────────────────────────────────────────────────
 */


