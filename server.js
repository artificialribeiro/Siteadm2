const express = require('express');
const cors = require('cors');

// 🟢 Importa o seu arquivo asaasPix.js que está na mesma pasta!
const asaasPix = require('./asaasPix'); 

const app = express();
app.use(cors());
app.use(express.json());

// 1. Rota para Criar/Buscar Cliente no Asaas
app.post('/api/v1/customers', async (req, res) => {
    try {
        const { name, cpfCnpj, email, mobilePhone } = req.body;
        const cliente = await asaasPix.criarOuBuscarCliente({
            nome: name,
            cpfCnpj: cpfCnpj,
            email: email,
            telefone: mobilePhone
        });
        res.json({ success: true, data: cliente });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// 2. Rota para Gerar a Cobrança PIX
app.post('/api/v1/payments', async (req, res) => {
    try {
        const { customer, value, description } = req.body;
        
        // Cria a cobrança com vencimento para 1 dia
        const cobranca = await asaasPix.criarCobrancaPix(customer, value, description, 1);
        
        // Pega o QR Code da cobrança
        const qrCode = await asaasPix.obterQrCodePix(cobranca.id);
        
        // Devolve no formato EXATO que o nosso pdv.js está esperando
        res.json({ 
            success: true, 
            data: { 
                id: cobranca.id, 
                pix: {
                    encodedImage: `data:image/png;base64,${qrCode.base64}`,
                    payload: qrCode.copiaCola
                }
            } 
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// 3. Rota para o "Radar" do PDV verificar se o PIX foi pago
app.get('/api/v1/payments/:id/status', async (req, res) => {
    try {
        const status = await asaasPix.consultarStatusPagamento(req.params.id);
        res.json({ success: true, data: { status: status } });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Inicia o servidor na porta 1536
const PORT = 1536;
app.listen(PORT, () => {
    console.log(`Servidor da Boutique Diniz rodando na porta ${PORT}`);
    console.log(`Pronto para gerar PIX com o Asaas!`);
});


