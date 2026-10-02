import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  supabaseAnonKey;

let supabaseAdmin: any = null;
if (supabaseUrl && (supabaseServiceKey || supabaseAnonKey)) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
  } catch (e) {
    console.warn('Supabase init failed in b2c.ts:', e);
  }
}

const ERROR_DESCRIPTIONS: Record<string, string> = {
  'INS-0': 'Sucesso',
  'INS-2': 'API Key ou credenciais inválidas',
  'INS-6': 'Transação falhou no provedor M-Pesa',
  'INS-10': 'Transação duplicada (referência já processada)',
  'INS-13': 'Shortcode inválido ou inativo',
  'INS-15': 'Valor inválido para envio (mínimo 1 MZN)',
  'INS-2006': 'Saldo insuficiente na carteira KwikPay',
  'INS-2051': 'MSISDN (número de telefone) inválido',
};

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const tokenRes = await fetch('https://kwikpay.web.tr/oauth/token', {
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
    const errorMsg = tokenData.message || tokenData.error || 'Falha ao autenticar com KwikPay';
    throw new Error(errorMsg);
  }

  return tokenData.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const clientId =
    process.env.KWIKPAY_CLIENT_ID ||
    process.env.VITE_KWIKPAY_CLIENT_ID ||
    process.env.E2_CLIENT_ID ||
    process.env.VITE_E2_CLIENT_ID ||
    '11';

  const clientSecret =
    process.env.KWIKPAY_CLIENT_SECRET ||
    process.env.VITE_KWIKPAY_CLIENT_SECRET ||
    process.env.E2_CLIENT_SECRET ||
    process.env.VITE_E2_CLIENT_SECRET ||
    'ZnET0WBSivZ7AGVJbG95N0xqirzCA7krS36ZAB7Q';

  const defaultWalletUuid =
    process.env.KWIKPAY_WALLET_ID ||
    process.env.VITE_KWIKPAY_WALLET_ID ||
    process.env.E2_WALLET_MPESA ||
    process.env.VITE_E2_WALLET_MPESA ||
    '891ae33d-664c-4715-abb1-008688662a03';

  try {
    const query = req.query || {};
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const action = (query.action as string) || body.action || (req.method === 'GET' ? 'balance' : 'payout');

    // ── 1. CONSULTAR SALDO (GET /api/v1/wallet/{wallet_uuid}/balance) ──
    if (action === 'balance') {
      const walletUuid = (query.wallet_uuid as string) || body.wallet_uuid || defaultWalletUuid;
      const token = await getAccessToken(clientId, clientSecret);

      const balanceRes = await fetch(`https://kwikpay.web.tr/api/v1/wallet/${walletUuid}/balance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      const balanceData = await balanceRes.json().catch(() => ({}));
      return res.status(balanceRes.status || 200).json(balanceData);
    }

    // ── 2. LISTAR TRANSAÇÕES (GET /api/v1/transactions) ──
    if (action === 'transactions') {
      const token = await getAccessToken(clientId, clientSecret);
      const params = new URLSearchParams();

      if (query.status) params.set('status', String(query.status));
      if (query.type) params.set('type', String(query.type));
      if (query.per_page) params.set('per_page', String(query.per_page));

      const txUrl = `https://kwikpay.web.tr/api/v1/transactions${params.toString() ? `?${params.toString()}` : ''}`;
      const txRes = await fetch(txUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      const txData = await txRes.json().catch(() => ({}));
      return res.status(txRes.status || 200).json(txData);
    }

    // ── 3. PAGAMENTO B2C (POST /api/v1/b2c/mpesa-payment) ──
    if (action === 'payout' || req.method === 'POST') {
      let { amount, phone, reference, wallet_uuid, recipient_name, user_email } = body;

      // Se o phone não foi enviado mas temos o user_email, buscar no banco de dados
      if (!phone && user_email && supabaseAdmin) {
        try {
          const { data: settings } = await supabaseAdmin
            .from('user_settings')
            .select('phone_number')
            .eq('user_email', user_email)
            .maybeSingle();
          if (settings?.phone_number) {
            phone = String(settings.phone_number).replace(/\D/g, '').slice(-9);
          }
        } catch (lookupErr) {
          console.warn('Erro ao buscar phone de user_settings:', lookupErr);
        }
      }

      // Fallback final: variável de ambiente B2C_DEFAULT_PHONE
      if (!phone) {
        const envPhone = process.env.B2C_DEFAULT_PHONE || process.env.VITE_B2C_DEFAULT_PHONE;
        if (envPhone) {
          phone = String(envPhone).replace(/\D/g, '').slice(-9);
          console.log('Usando B2C_DEFAULT_PHONE como fallback:', phone);
        }
      }

      const numAmount = Number(amount);
      if (!numAmount || isNaN(numAmount) || numAmount < 1) {
        return res.status(400).json({
          success: false,
          error: 'Valor inválido. O valor mínimo para saque B2C é de 1 MZN.',
          code: 'INS-15',
        });
      }

      if (!phone) {
        return res.status(400).json({
          success: false,
          error: 'Número de telefone do destinatário é obrigatório.',
          code: 'INS-2051',
        });
      }

      // Sanitize phone to 9 digits (format: 842848202 / 856195186)
      let cleanPhone = String(phone).replace(/\D/g, '');
      if (cleanPhone.startsWith('258') && cleanPhone.length > 9) {
        cleanPhone = cleanPhone.substring(3);
      }
      cleanPhone = cleanPhone.slice(-9);

      if (cleanPhone.length !== 9) {
        return res.status(400).json({
          success: false,
          error: 'Número de telefone deve conter 9 dígitos válidos de Moçambique.',
          code: 'INS-2051',
        });
      }

      const wallet = wallet_uuid || defaultWalletUuid;
      const ref = (reference || `B2C_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);

      // Taxa KwikPay B2C: 7% (mínimo 10 MZN)
      const fee = Math.max(numAmount * 0.07, 10);
      const netAmount = Math.max(0, numAmount - fee);

      const token = await getAccessToken(clientId, clientSecret);

      const b2cRes = await fetch('https://kwikpay.web.tr/api/v1/b2c/mpesa-payment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          wallet_uuid: wallet,
          amount: numAmount,
          phone: cleanPhone,
          reference: ref,
        }),
      });

      const b2cData = await b2cRes.json().catch(() => ({}));
      console.log('KwikPay B2C API Response:', b2cData);

      // Check for KwikPay error codes or response structure
      const errorCode = b2cData.code || b2cData.data?.code || b2cData.data?.response_code;
      const friendlyError = errorCode && ERROR_DESCRIPTIONS[errorCode] ? ERROR_DESCRIPTIONS[errorCode] : null;

      if (!b2cRes.ok || b2cData.success === false) {
        const errorMsg = friendlyError || b2cData.message || b2cData.error || b2cData.data?.response_description || 'Erro ao processar saque B2C.';
        return res.status(b2cRes.status || 400).json({
          success: false,
          error: errorMsg,
          code: errorCode,
          details: b2cData,
        });
      }

      // Registrar transação no Supabase
      if (supabaseAdmin) {
        try {
          const finalTxId = b2cData.data?.transaction_id || `B2C_${Date.now()}`;
          await supabaseAdmin.from('transactions').insert([
            {
              id: finalTxId,
              type: 'withdrawal',
              amount: numAmount,
              phone: cleanPhone,
              method: 'M-Pesa',
              status: 'Concluído',
              reference: ref,
              description: `Saque B2C KwikPay - M-Pesa (${cleanPhone})`,
              customerName: recipient_name || (cleanPhone === '856195186' ? 'Joao Maibass' : 'Beneficiário B2C'),
              customerEmail: user_email || 'b2c@kwikpay.web.tr',
              createdat: new Date().toISOString(),
            },
          ]);
        } catch (dbErr) {
          console.warn('Erro ao salvar transação de saque no Supabase:', dbErr);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Pagamento B2C processado com sucesso!',
        data: {
          ...b2cData.data,
          calculated_fees: {
            fee_percent: 7,
            min_fee: 10,
            fee_amount: fee,
            net_amount: netAmount,
          },
        },
      });
    }

    return res.status(400).json({ error: 'Ação não reconhecida.' });
  } catch (err: any) {
    console.error('Erro na API B2C:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro interno no servidor de saques B2C.',
    });
  }
}
