import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  supabaseAnonKey;

const paymentClientId = process.env.VITE_PAYMENT_CLIENT_ID || process.env.PAYMENT_CLIENT_ID || '';
const paymentClientSecret = process.env.VITE_PAYMENT_CLIENT_SECRET || process.env.PAYMENT_CLIENT_SECRET || '';
const paymentWalletUuid = process.env.VITE_PAYMENT_WALLET_ID || process.env.PAYMENT_WALLET_ID || '';

let supabase: any = null;
if (supabaseUrl && supabaseAnonKey) {
  try { supabase = createClient(supabaseUrl, supabaseAnonKey); } catch {}
}

let supabaseAdmin: any = null;
if (supabaseUrl && supabaseServiceKey) {
  try { supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey); } catch {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS for the checkout page
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const body = req.body || {};
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;

    const {
      transactionId,
      phone,
      amount,
      reference,
      customerName,
      product_id,
      product_name,
      merchant_user_email,
      method
    } = parsed;

    if (!transactionId || !phone || !amount) {
      return res.status(400).json({ error: 'transactionId, phone and amount are required.' });
    }

    const finalTxId = transactionId || reference;
    const amountNum = Number(amount);
    const msisdn = phone;
    const providerStr = method || 'M-Pesa';

    let finalMerchantEmail = merchant_user_email;
    const dbClient = supabaseAdmin || supabase;

    // Load merchant settings from Supabase (device-independent)
    let supabaseWebhookUrl = '';
    let supabaseWebhookEvents = '{}';
    let supabaseLowtrackToken = '';
    let merchantMpesaPhone = '';  // will be resolved from user metadata

    if (dbClient) {
        // If email not provided, try to find it via product
        if (!finalMerchantEmail && product_id) {
           try {
             const { data: prodData } = await dbClient.from('products').select('user_email').eq('id', product_id).single();
             if (prodData && prodData.user_email) {
               finalMerchantEmail = prodData.user_email;
             }
           } catch (e) {
             console.warn('Failed to fetch user_email from product:', e);
           }
        }

        if (finalMerchantEmail) {
            try {
                const { data: userSettings } = await dbClient
                .from('user_settings')
                .select('webhook_url, webhook_events, lowtrack_token')
                .eq('user_email', finalMerchantEmail)
                .single();

                if (userSettings) {
                    if (userSettings.webhook_url) supabaseWebhookUrl = userSettings.webhook_url;
                    if (userSettings.webhook_events)
                        supabaseWebhookEvents = typeof userSettings.webhook_events === 'string'
                            ? userSettings.webhook_events
                            : JSON.stringify(userSettings.webhook_events);
                    if (userSettings.lowtrack_token) supabaseLowtrackToken = userSettings.lowtrack_token;
                    console.log(`Configurações carregadas do Supabase para: ${finalMerchantEmail}`);
                }
            } catch (e) {
                console.warn('Erro ao carregar user_settings:', e);
            }

            // Fetch merchant phone number from user_settings (populated when merchant saves profile)
            try {
                const { data: phoneSetting } = await dbClient
                    .from('user_settings')
                    .select('phone_number')
                    .eq('user_email', finalMerchantEmail)
                    .single();
                if (phoneSetting?.phone_number) {
                    let cleaned = String(phoneSetting.phone_number).replace(/\D/g, '');
                    if (cleaned.startsWith('258') && cleaned.length > 9) cleaned = cleaned.substring(3);
                    merchantMpesaPhone = cleaned.slice(-9);
                    console.log(`📞 Telefone M-Pesa do merchant: ${merchantMpesaPhone}`);
                } else {
                    console.warn(`⚠️ Nenhum número de telemóvel em user_settings para: ${finalMerchantEmail}`);
                }
            } catch (phoneErr: any) {
                console.warn('Erro ao obter phone_number do merchant:', phoneErr.message);
            }
        }
    }

    const finalWebhookUrl = supabaseWebhookUrl || process.env.VITE_MERCHANT_WEBHOOK_URL || '';
    const finalWebhookEvents = supabaseWebhookEvents !== '{}' ? supabaseWebhookEvents : process.env.VITE_MERCHANT_WEBHOOK_EVENTS || '{}';
    const finalLowtrackToken = supabaseLowtrackToken || process.env.VITE_MERCHANT_LOWTRACK_TOKEN || '';

    // Persist successful transaction to Supabase
    if (supabase) {
      try {
        const notifMeta = JSON.stringify({
          webhook_url: finalWebhookUrl,
          webhook_events: finalWebhookEvents,
          lowtrack_token: finalLowtrackToken,
        });

        await supabase.from('transactions').upsert([{
          id: finalTxId,
          type: 'payment',
          amount: amountNum,
          phone: msisdn,
          method: providerStr,
          status: 'Concluído',
          reference: reference || finalTxId,
          description: `${product_name || 'Compra online'}||NOTIF_META||${notifMeta}`,
          customerName: customerName || 'Cliente',
          customerEmail: finalMerchantEmail || '',
          device: 'Desktop/Mobile',
          createdat: new Date().toISOString(),
        }]);
        console.log('Transação salva no Supabase:', finalTxId);

        // Update product sales and revenue
        if (product_id) {
           try {
             const { data: prod } = await supabase.from('products').select('sales, revenue').eq('id', product_id).single();
             if (prod) {
                 await supabase.from('products').update({
                     sales: (prod.sales || 0) + 1,
                     revenue: (prod.revenue || 0) + amountNum
                 }).eq('id', product_id);
                 console.log(`Produto ${product_id} atualizado: +1 venda, +${amountNum} receita.`);
             }
           } catch (e) { console.error('Erro ao atualizar vendas do produto:', e); }
        }

        // ── Fire notifications ──────────────────────────────────────────────
        const notifications: Promise<any>[] = [];

        // 1. Pushcut Global
        const pushcutEndpoint = process.env.VITE_PUSHCUT_ENDPOINT || process.env.PUSHCUT_ENDPOINT || '';
        const pushcutApiKey = process.env.VITE_PUSHCUT_API_KEY || process.env.PUSHCUT_API_KEY || '';
        if (pushcutEndpoint && pushcutApiKey) {
          notifications.push((async () => {
            try {
              const r = await fetch(pushcutEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pushcutApiKey}` },
                body: JSON.stringify({ transaction_id: finalTxId, amount: amountNum, status: 'Concluído', user_id: finalMerchantEmail }),
              });
              console.log('Pushcut Global:', r.status);
            } catch (e: any) { console.error('Pushcut Global erro:', e.message); }
          })());
        }

        // 2. Merchant Webhook (Pushcut / custom)
        if (finalWebhookUrl) {
          notifications.push((async () => {
            try {
              const r = await fetch(finalWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: 'sale_approved',
                  timestamp: new Date().toISOString(),
                  transaction_id: finalTxId,
                  reference: reference || finalTxId,
                  amount: amountNum,
                  method: providerStr,
                  customer: { name: customerName || 'Cliente', phone: msisdn },
                  status: 'Concluído',
                }),
              });
              const resText = await r.text().catch(() => '');
              console.log('Merchant Webhook:', r.status, resText.slice(0, 100));

              // Debug log in DB
              await supabase.from('transactions').insert([{
                id: `DBG_${Date.now()}`,
                type: 'payment', amount: 0, phone: '000', method: 'Debug',
                status: 'Debug', reference: 'Debug',
                description: `Webhook res: ${r.status} - ${resText.slice(0, 100)}`,
              }]).catch(() => {});
            } catch (e: any) {
              console.error('Merchant Webhook erro:', e.message);
              await supabase.from('transactions').insert([{
                id: `DBG_ERR_${Date.now()}`,
                type: 'payment', amount: 0, phone: '000', method: 'Debug',
                status: 'Debug', reference: 'Debug',
                description: `Webhook err: ${e.message}`,
              }]).catch(() => {});
            }
          })());
        }

        // 3. LowTrack
        const activeLowtrackToken = finalLowtrackToken || process.env.VITE_LOWTRAK_API_KEY || process.env.LOWTRAK_API_KEY || '';
        if (activeLowtrackToken) {
          notifications.push((async () => {
            try {
              const r = await fetch('https://lowtrack.com.br/api/webhook', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${activeLowtrackToken}`,
                  'User-Agent': 'Mozilla/5.0',
                },
                body: JSON.stringify({
                  event: 'sale.approved',
                  transaction_id: finalTxId,
                  reference: reference || finalTxId,
                  amount: amountNum,
                  method: providerStr,
                  status: 'Concluído',
                  customer: { name: customerName || 'Cliente', phone: msisdn },
                }),
              });
              console.log('LowTrack:', r.status);
            } catch (e: any) { console.error('LowTrack erro:', e.message); }
          })());
        }

        // 4. Firebase Cloud Messaging (FCM) Push Notifications
        if (finalMerchantEmail) {
            notifications.push((async () => {
                try {
                // Dynamically import to not break edge functions if missing dependencies
                const { sendPushNotificationV1, getUserTokens } = await import('../src/lib/push_v1.js');
                const tokens = await getUserTokens(finalMerchantEmail);
                if (tokens && tokens.length > 0) {
                    const val = amountNum.toLocaleString('pt-PT');
                    for (const token of tokens) {
                        await sendPushNotificationV1(token, {
                            title: 'VELORA — Nova Venda! 🎉',
                            body: `Venda aprovada: ${val} MT via ${providerStr}`,
                        });
                    }
                    console.log(`FCM Push Notifications disparadas para ${tokens.length} dispositivos.`);
                }
                } catch (err: any) {
                    console.error('Erro ao enviar FCM Push Notification:', err.message || err);
                }
            })());
        }

        // 5. B2C Automático DESATIVADO (deixando normal igual ao e-Mola)
        // O fluxo de pagamento agora é exclusivamente C2B normal, sem disparar saques automáticos.


        await Promise.allSettled(notifications);
        console.log('Todas as notificações processadas.');
      } catch (dbErr) {
        console.error('Erro ao salvar transação/disparar notificações:', dbErr);
      }
    }

    return res.status(200).json({
      success: true,
      transactionId: finalTxId,
      message: 'Payment finalized successfully!',
    });

  } catch (error: any) {
    console.error('Erro no finalize-payment:', error);
    return res.status(500).json({
      error: 'Fatal error finalizing payment.',
      message: error.message,
    });
  }
}
