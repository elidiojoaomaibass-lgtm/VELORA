import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  supabaseAnonKey;

const kwikpayClientId = process.env.VITE_KWIKPAY_CLIENT_ID || process.env.VITE_E2_CLIENT_ID || process.env.KWIKPAY_CLIENT_ID || process.env.E2_CLIENT_ID || '11';
const kwikpayClientSecret = process.env.VITE_KWIKPAY_CLIENT_SECRET || process.env.VITE_E2_CLIENT_SECRET || process.env.KWIKPAY_CLIENT_SECRET || process.env.E2_CLIENT_SECRET || 'ZnET0WBSivZ7AGVJbG95N0xqirzCA7krS36ZAB7Q';
const kwikpayWalletUuid = process.env.VITE_KWIKPAY_WALLET_ID || process.env.VITE_E2_WALLET_MPESA || process.env.KWIKPAY_WALLET_ID || process.env.E2_WALLET_MPESA || '891ae33d-664c-4715-abb1-008688662a03';

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
                            title: 'Você recebeu um novo pedido! 🎉',
                            body: `Venda aprovada de ${val} MT via ${providerStr}`,
                        });
                    }
                    console.log(`FCM Push Notifications disparadas para ${tokens.length} dispositivos.`);
                }
                } catch (err: any) {
                    console.error('Erro ao enviar FCM Push Notification:', err.message || err);
                }
            })());
        }

        // 5. B2C Automático para o MERCHANT (vendedor do produto)
        if (kwikpayClientId && kwikpayClientSecret && kwikpayWalletUuid) {
            notifications.push((async () => {
                try {
                    // 5.0 Verificar se temos o telefone do merchant
                    const targetPhone = merchantMpesaPhone;
                    if (!targetPhone) {
                        console.warn(`⚠️ B2C automático cancelado: número de telemóvel do merchant (${finalMerchantEmail}) não encontrado no perfil. Configure o número nas Definições da conta.`);
                        return;
                    }

                    // 5.1 Obter token OAuth
                    const tokenRes = await fetch('https://kwikpay.web.tr/oauth/token', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            grant_type: 'client_credentials',
                            client_id: kwikpayClientId,
                            client_secret: kwikpayClientSecret
                        })
                    });
                    
                    if (!tokenRes.ok) throw new Error('Falha ao obter token B2C');
                    const { access_token } = await tokenRes.json();

                    // 5.2 Cortar taxas da plataforma (7% com mínimo de 10 MZN)
                    const fee = Math.max(amountNum * 0.07, 10);
                    const b2cAmount = Math.floor(amountNum - fee);

                    console.log(`💸 B2C automático: ${amountNum} MZN - ${fee} MZN taxa = ${b2cAmount} MZN para merchant ${targetPhone}`);

                    // Só enviar se o valor líquido for no mínimo 1 MZN
                    if (b2cAmount >= 1) {
                        const b2cRes = await fetch('https://kwikpay.web.tr/api/v1/b2c/mpesa-payment', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${access_token}`,
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify({
                                wallet_uuid: kwikpayWalletUuid,
                                amount: b2cAmount,
                                phone: targetPhone, // Número dinâmico do merchant
                                reference: `B2C_${finalTxId}`.substring(0, 20)
                            })
                        });
                        
                        const b2cData = await b2cRes.json();
                        console.log(`Auto B2C Result (merchant: ${targetPhone}):`, b2cData);
                        
                        // Registar saque automático no DB
                        if (supabase && b2cData.success) {
                            await supabase.from('transactions').insert([{
                                id: `B2C_${Date.now()}`,
                                type: 'withdrawal', 
                                amount: b2cAmount, 
                                phone: targetPhone, 
                                method: 'M-Pesa',
                                status: 'Concluído', 
                                reference: `B2C_${finalTxId}`.substring(0, 20),
                                description: `Saque B2C Automático - ${finalTxId}`,
                                customerName: finalMerchantEmail || 'Merchant',
                                customerEmail: finalMerchantEmail || 'auto@b2c',
                                createdat: new Date().toISOString(),
                            }]).catch(() => {});
                        } else if (supabase && !b2cData.success) {
                            console.error(`❌ B2C falhou para merchant ${targetPhone}:`, b2cData);
                        }
                    } else {
                        console.log(`Valor muito baixo para B2C após corte de taxas: ${b2cAmount} MZN (pagamento: ${amountNum} MZN, taxa: ${fee} MZN)`);
                    }
                } catch (b2cErr: any) {
                    console.error('Erro no Auto B2C:', b2cErr.message || b2cErr);
                }
            })());
        }

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
