import fs from 'fs';
import path from 'path';

function loadEnv() {
  try {
    const envPath = path.resolve('.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...vals] = trimmed.split('=');
          process.env[key.trim()] = vals.join('=').trim();
        }
      }
    }
  } catch (e) {
    console.error('Erro ao ler .env:', e);
  }
}

loadEnv();

const clientId = process.env.PAYMENT_CLIENT_ID || '';
const clientSecret = process.env.PAYMENT_CLIENT_SECRET || '';
const walletId = process.env.PAYMENT_WALLET_ID || '807267';
const phone = process.argv[2] || '841234567'; 
const amount = 1;

async function test() {
  if (!clientId || !clientSecret || !walletId) {
    console.error('⚠️ Credenciais não preenchidas no .env (PAYMENT_CLIENT_ID, PAYMENT_CLIENT_SECRET, PAYMENT_WALLET_ID)');
    return;
  }

  try {
    console.log('1. A obter Token de Acesso em https://mpesaemolatech.com/oauth/token ...');
    const tokenRes = await fetch('https://mpesaemolatech.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
        console.error('Falha na autenticação:', tokenData);
        return;
    }
    console.log('✅ Token obtido com sucesso!');

    console.log(`2. A enviar requisição C2B para a carteira ${walletId} (telefone: ${phone}, valor: ${amount} MT)...`);
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-9);
    const paymentRes = await fetch(`https://mpesaemolatech.com/v1/c2b/mpesa-payment/${walletId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        amount,
        phone: cleanPhone,
        reference: 'TEST' + Date.now()
      }),
    });

    const status = paymentRes.status;
    const body = await paymentRes.text();
    console.log(`Status HTTP: ${status}`);
    console.log(`Resposta da API: ${body}`);
  } catch(e) {
    console.error('Erro:', e);
  }
}

test();
