import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Serverless Handler for Payment Gateway (MpesaEmolaTech / e2Payments)
 * Handles OAuth token acquisition and C2B payments server-to-server,
 * avoiding browser CORS restrictions.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { action, method, walletId, amount, phone, reference } = body;

    const clientId = process.env.PAYMENT_CLIENT_ID || process.env.VITE_PAYMENT_CLIENT_ID || '';
    const clientSecret = process.env.PAYMENT_CLIENT_SECRET || process.env.VITE_PAYMENT_CLIENT_SECRET || '';
    const defaultWalletId = process.env.PAYMENT_WALLET_ID || process.env.VITE_PAYMENT_WALLET_ID || '807267';
    const walletMpesa = process.env.PAYMENT_WALLET_MPESA || process.env.VITE_PAYMENT_WALLET_MPESA || '807267';
    const walletEmola = process.env.PAYMENT_WALLET_EMOLA || process.env.VITE_PAYMENT_WALLET_EMOLA || '257096';
    const oauthUrl = process.env.PAYMENT_OAUTH_URL || 'https://mpesaemolatech.com/oauth/token';
    const c2bBaseUrl = process.env.PAYMENT_C2B_BASE_URL || 'https://mpesaemolatech.com/v1/c2b';

    if (!clientId || !clientSecret || !oauthUrl) {
      return res.status(500).json({ error: 'Credenciais do gateway de pagamento não configuradas.' });
    }

    // 1. Get OAuth Access Token from MpesaEmolaTech / e2Payments
    const tokenRes = await fetch(oauthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Payment Gateway OAuth Token Error:', tokenData);
      return res.status(tokenRes.status || 400).json({
        error: 'Falha na autenticação com o gateway de pagamento',
        details: tokenData,
      });
    }

    if (action === 'token') {
      return res.status(200).json(tokenData);
    }

    // 2. Perform C2B Payment
    const targetWallet = walletId || (method === 'emola' ? walletEmola : (walletMpesa || defaultWalletId));
    const endpoint = method === 'emola' ? 'emola-payment' : 'mpesa-payment';

    // Sanitize phone to 9 digits
    let cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.startsWith('258') && cleanPhone.length > 9) {
      cleanPhone = cleanPhone.substring(3);
    }
    cleanPhone = cleanPhone.slice(-9);

    // Reference must not contain spaces and be <= 20 characters
    const cleanRef = String(reference || `ORD${Date.now()}`).replace(/\s+/g, '_').slice(0, 20);

    const c2bUrl = c2bBaseUrl
      ? `${c2bBaseUrl.replace(/\/$/, '')}/${endpoint}/${targetWallet}`
      : `https://mpesaemolatech.com/v1/c2b/${endpoint}/${targetWallet}`;

    const paymentRes = await fetch(c2bUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        amount: Number(amount),
        phone: cleanPhone,
        reference: cleanRef,
      }),
    });

    const paymentData = await paymentRes.json().catch(() => ({}));
    console.log('Payment Gateway C2B Result:', JSON.stringify(paymentData, null, 2));
    return res.status(paymentRes.status).json(paymentData);

  } catch (error: any) {
    console.error('Payment Gateway Serverless Error:', error);
    return res.status(500).json({
      error: error.message || 'Erro interno no servidor de pagamentos.',
    });
  }
}
