import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Lightweight endpoint to dispatch push notifications after a successful payment.
 * Called from the browser after payment via SDK succeeds.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { merchant_user_email, amount, method, product_name, reference } = body;

    if (!merchant_user_email) {
      return res.status(400).json({ error: 'merchant_user_email é obrigatório.' });
    }

    const results: string[] = [];

    // 1. Firebase Cloud Messaging (FCM) Push Notifications
    try {
      const { sendPushNotificationV1, getUserTokens } = await import('../src/lib/push_v1.js');
      const tokens = await getUserTokens(merchant_user_email);

      if (tokens && tokens.length > 0) {
        const val = Number(amount || 0).toLocaleString('pt-PT');
        const methodStr = method || 'M-Pesa';

        for (const token of tokens) {
          await sendPushNotificationV1(token, {
            title: 'VELORA — Nova Venda! 🎉',
            body: `Venda aprovada: ${val} MT via ${methodStr}`,
          });
        }
        results.push(`FCM: ${tokens.length} dispositivo(s) notificado(s).`);
      } else {
        results.push('FCM: Nenhum token encontrado.');
      }
    } catch (err: any) {
      console.error('Erro FCM:', err.message || err);
      results.push(`FCM: Erro - ${err.message || 'desconhecido'}`);
    }

    return res.status(200).json({ success: true, results });
  } catch (error: any) {
    console.error('Erro no /api/notify:', error);
    return res.status(500).json({ error: error.message || 'Erro interno.' });
  }
}
