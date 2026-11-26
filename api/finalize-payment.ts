import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendPushNotificationV1, getUserTokens, buildWebhookRequest } from './_push.js';

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
             const { data: prodData } = await dbClient.from('products').select('user_email').eq('id', product_id).maybeSingle();
             if (prodData && prodData.user_email) {
               finalMerchantEmail = prodData.user_email;
             }
           } catch (e) {
             console.warn('Failed to fetch user_email from product:', e);
           }
        }

        if (!finalMerchantEmail) {
           finalMerchantEmail = process.env.VITE_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'ofcdzin6@gmail.com';
        }

        if (finalMerchantEmail) {
            try {
                const { data: userSettings } = await dbClient
                .from('user_settings')
                .select('*')
                .eq('user_email', finalMerchantEmail)
                .maybeSingle();

                if (userSettings) {
                    if (userSettings.webhook_url) supabaseWebhookUrl = userSettings.webhook_url;
                    if (userSettings.lowtrack_token) supabaseLowtrackToken = userSettings.lowtrack_token;
                    if (userSettings.webhook_events) {
                        const parsed = typeof userSettings.webhook_events === 'string'
                            ? JSON.parse(userSettings.webhook_events)
                            : userSettings.webhook_events;
                        if (parsed && typeof parsed === 'object') {
                            if (!supabaseWebhookUrl && parsed._extra?.webhook_url) {
                                supabaseWebhookUrl = parsed._extra.webhook_url;
                            }
                        }
                        supabaseWebhookEvents = JSON.stringify(parsed || {});
                    }
                    console.log(`Configurações carregadas do Supabase para: ${finalMerchantEmail} (webhook=${supabaseWebhookUrl ? 'SIM' : 'NÃO'})`);
                } else {
                    console.log(`[finalize-payment] Nenhum user_settings encontrado para: ${finalMerchantEmail}`);
                }

                // Se o email do produto não tem user_settings com webhook, tentar o admin como fallback
                const adminEmail = (process.env.VITE_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'ofcdzin6@gmail.com').toLowerCase();
                if (!supabaseWebhookUrl && finalMerchantEmail.toLowerCase() !== adminEmail) {
                    console.log(`[finalize-payment] Fallback: procurando webhook nas configurações do admin (${adminEmail})`);
                    try {
                        const { data: adminSettings } = await dbClient
                            .from('user_settings')
                            .select('webhook_url, webhook_events, lowtrack_token')
                            .eq('user_email', adminEmail)
                            .maybeSingle();
                        if (adminSettings) {
                            if (adminSettings.webhook_url) supabaseWebhookUrl = adminSettings.webhook_url;
                            if (adminSettings.lowtrack_token && !supabaseLowtrackToken) supabaseLowtrackToken = adminSettings.lowtrack_token;
                            if (adminSettings.webhook_events && supabaseWebhookEvents === '{}') {
                                const parsed = typeof adminSettings.webhook_events === 'string'
                                    ? JSON.parse(adminSettings.webhook_events)
                                    : adminSettings.webhook_events;
                                if (parsed && typeof parsed === 'object') {
                                    if (!supabaseWebhookUrl && parsed._extra?.webhook_url) {
                                        supabaseWebhookUrl = parsed._extra.webhook_url;
                                    }
                                }
                                supabaseWebhookEvents = JSON.stringify(parsed || {});
                            }
                            console.log(`[finalize-payment] Admin fallback: webhook=${supabaseWebhookUrl ? 'SIM' : 'NÃO'}`);
                        }
                    } catch (adminErr) {
                        console.warn('[finalize-payment] Erro ao carregar admin user_settings:', adminErr);
                    }
                    // Usar o admin email para push notifications também
                    finalMerchantEmail = adminEmail;
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
    if (dbClient) {
      try {
        const notifMeta = JSON.stringify({
          webhook_url: finalWebhookUrl,
          webhook_events: finalWebhookEvents,
          lowtrack_token: finalLowtrackToken,
        });

        const txPayload = {
          id: finalTxId,
          type: 'payment',
          amount: amountNum,
          phone: msisdn,
          method: providerStr,
          status: 'Concluído',
          reference: reference || finalTxId,
          description: `Compra: ${product_name || 'Produto'}||PRODUCT_ID||${product_id || ''}${notifMeta ? '||NOTIF_META||' + notifMeta : ''}`,
          customername: customerName || 'Cliente',
          customeremail: finalMerchantEmail || '',
          device: 'Desktop/Mobile',
          createdat: new Date().toISOString(),
        };

        // Bloqueio atómico: garantir que apenas UMA requisição processa a transição para Concluído
        const { data: existingTx } = await dbClient
          .from('transactions')
          .select('id, status')
          .eq('id', finalTxId)
          .maybeSingle();

        if (existingTx) {
          if (existingTx.status === 'Concluído') {
            console.log(`[finalize-payment] Transação ${finalTxId} já estava Concluída. Ignorando disparo duplicado.`);
            return res.status(200).json({
              success: true,
              alreadyProcessed: true,
              transactionId: finalTxId,
              message: 'Payment already finalized.',
            });
          }
          // UPDATE atómico condicional: só ganha quem alterar de != 'Concluído' para 'Concluído'
          const { data: claimedRows, error: claimErr } = await dbClient
            .from('transactions')
            .update({
              amount: amountNum,
              phone: msisdn,
              method: providerStr,
              status: 'Concluído',
              reference: reference || finalTxId,
              description: txPayload.description,
              customername: txPayload.customername,
              customeremail: txPayload.customeremail,
              device: 'Desktop/Mobile',
            })
            .eq('id', finalTxId)
            .neq('status', 'Concluído')
            .select('id');

          if (claimErr) {
            console.error('[finalize-payment] Erro no update atómico:', claimErr.message);
          }
          if (!claimedRows || claimedRows.length === 0) {
            console.log(`[finalize-payment] Concorrência detetada para ${finalTxId}. Outra requisição já processou.`);
            return res.status(200).json({
              success: true,
              alreadyProcessed: true,
              transactionId: finalTxId,
              message: 'Payment already claimed by another request.',
            });
          }
          console.log('[finalize-payment] Transação atualizada atomicamente no Supabase:', finalTxId);
        } else {
          // INSERT atómico: se der conflito de chave primária (23505), outra requisição inseriu primeiro
          const { error: insertErr } = await dbClient.from('transactions').insert([txPayload]);
          if (insertErr) {
            if (insertErr.code === '23505') {
              console.log(`[finalize-payment] Concorrência no insert para ${finalTxId}. Ignorando disparo duplicado.`);
              return res.status(200).json({
                success: true,
                alreadyProcessed: true,
                transactionId: finalTxId,
                message: 'Payment already inserted by another request.',
              });
            }
            console.error('[finalize-payment] Erro ao gravar transação no Supabase:', insertErr.message);
          } else {
            console.log('[finalize-payment] Transação salva com sucesso no Supabase:', finalTxId);
          }
        }

        // Update product sales and revenue
        if (product_id) {
           try {
             const { data: prod } = await dbClient.from('products').select('sales, revenue').eq('id', product_id).maybeSingle();
             if (prod) {
                 await dbClient.from('products').update({
                     sales: (prod.sales || 0) + 1,
                     revenue: (prod.revenue || 0) + amountNum
                 }).eq('id', product_id);
                 console.log(`Produto ${product_id} atualizado: +1 venda, +${amountNum} receita.`);
             }
           } catch (e) { console.error('Erro ao atualizar vendas do produto:', e); }
        }

        // ── Fire notifications ──────────────────────────────────────────────
        const notifications: Promise<any>[] = [];
        let webhookStatus: number | null = null;
        let pushTokensFound = 0;
        let pushSentCount = 0;

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
              const val = amountNum.toLocaleString('pt-PT');
              const notifTitle = '🎉 Venda aprovada!';
              const notifText = `Venda de ${val} MT via ${providerStr}`;
              const { url: targetWebhookUrl, headers: targetWebhookHeaders } = buildWebhookRequest(finalWebhookUrl);

              const r = await fetch(targetWebhookUrl, {
                method: 'POST',
                headers: targetWebhookHeaders,
                body: JSON.stringify({
                  title: notifTitle,
                  text: notifText,
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
              webhookStatus = r.status;
              const resText = await r.text().catch(() => '');
              console.log('Merchant Webhook:', r.status, resText.slice(0, 100));
            } catch (e: any) {
              console.error('Merchant Webhook erro:', e.message);
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
                const tokens = await getUserTokens(finalMerchantEmail);
                pushTokensFound = tokens?.length || 0;
                if (tokens && tokens.length > 0) {
                    const val = amountNum.toLocaleString('pt-PT');
                    const results = await Promise.allSettled(
                        tokens.map((token) =>
                            sendPushNotificationV1(token, {
                                title: '🎉 Venda aprovada!',
                                body: `Venda de ${val} MT via ${providerStr}`,
                            })
                        )
                    );
                    pushSentCount = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
                    console.log(`FCM Push Notifications disparadas para ${pushSentCount}/${tokens.length} dispositivos.`);
                } else {
                    console.log(`FCM: Nenhum token de push encontrado para ${finalMerchantEmail}.`);
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
        return res.status(200).json({
          success: true,
          transactionId: finalTxId,
          message: 'Payment finalized successfully!',
          diagnostics: {
            hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY),
            hasFirebaseAdmin: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS),
            merchantEmail: finalMerchantEmail,
            webhookFound: Boolean(finalWebhookUrl),
            webhookStatus,
            pushTokensFound,
            pushSentCount,
          },
        });
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
