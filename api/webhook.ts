// Enable CORS for any origin (adjust as needed)
export const config = {
  api: {
    bodyParser: true,
    externalResolver: true,
  },
};
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { sendPushNotificationV1 as sendPushNotification, getUserTokens } from '../src/lib/push_v1.js';
import { getLowtrackToken } from '../src/lib/lowtrack.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const globalLowtrakApiKey = process.env.VITE_LOWTRAK_API_KEY || process.env.LOWTRAK_API_KEY || '';
const lowtrackEndpoint = process.env.VITE_LOWTRAK_ENDPOINT || process.env.LOWTRAK_ENDPOINT || 'https://lowtrack.com.br/api/webhook';
const defaultMerchantWebhookUrl = process.env.VITE_MERCHANT_WEBHOOK_URL || '';
const defaultMerchantWebhookEvents = process.env.VITE_MERCHANT_WEBHOOK_EVENTS || '{}';
const pushcutEndpoint = process.env.VITE_PUSHCUT_ENDPOINT || process.env.PUSHCUT_ENDPOINT || '';
const pushcutApiKey = process.env.VITE_PUSHCUT_API_KEY || process.env.PUSHCUT_API_KEY || '';

const kwikpayClientId = process.env.VITE_KWIKPAY_CLIENT_ID || process.env.VITE_E2_CLIENT_ID || process.env.KWIKPAY_CLIENT_ID || process.env.E2_CLIENT_ID || '11';
const kwikpayClientSecret = process.env.VITE_KWIKPAY_CLIENT_SECRET || process.env.VITE_E2_CLIENT_SECRET || process.env.KWIKPAY_CLIENT_SECRET || process.env.E2_CLIENT_SECRET || 'ZnET0WBSivZ7AGVJbG95N0xqirzCA7krS36ZAB7Q';
const kwikpayWalletUuid = process.env.VITE_KWIKPAY_WALLET_ID || process.env.VITE_E2_WALLET_MPESA || process.env.KWIKPAY_WALLET_ID || process.env.E2_WALLET_MPESA || '891ae33d-664c-4715-abb1-008688662a03';

let supabase: any = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (e) {
    console.error('Erro ao inicializar Supabase no webhook:', e);
  }
}

function parseNotifMeta(description: string | null): { webhook_url: string; webhook_events: string; lowtrack_token: string } | null {
  if (!description) return null;
  const marker = '||NOTIF_META||';
  const idx = description.indexOf(marker);
  if (idx === -1) return null;
  try {
    return JSON.parse(description.substring(idx + marker.length));
  } catch (e) {
    return null;
  }
}

/**
 * Webhook Handler for Payment Gateway
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).setHeader('Access-Control-Allow-Origin', '*').json({ error: 'Method Not Allowed' });
  }

  if (!supabase) {
    console.error('Supabase client is not configured in webhook.');
    return res.status(500).setHeader('Access-Control-Allow-Origin', '*').json({ error: 'Supabase environment variables are missing on Vercel.' });
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e) {
        return res.status(400).setHeader('Access-Control-Allow-Origin', '*').json({ error: 'Invalid JSON payload' });
      }
    }
    console.log('Webhook Received:', JSON.stringify(payload, null, 2));

    // Webhook structure support + fallback for other formats
    const status = payload.status || payload.event;
    const transaction_id = payload.txid || payload.transaction_id || payload.id || payload.transactionId;
    const reference = payload.reference || transaction_id;
    const amount = payload.valor_bruto || payload.amount;
    const phone = payload.pagador || payload.phone;
    const customerName = payload.nome_pagador || payload.customerName || 'Cliente';
    const method = payload.canal === 'emola' ? 'e-Mola' : (payload.canal === 'mpesa' ? 'M-Pesa' : payload.method);

    if (!transaction_id) {
      return res.status(400).setHeader('Access-Control-Allow-Origin', '*').json({ error: 'Missing txid / transaction_id' });
    }

    const isSuccess = (status === 'success' || status === 'payment.success' || String(status).toUpperCase() === 'CONCLUÍDO');
    const finalStatus = isSuccess ? 'Concluído' : 'Falhou';

    console.log(`Atualizando transação ${transaction_id} para status: ${finalStatus}`);

    const { data: updatedTx, error } = await supabase
      .from('transactions')
      .update({ status: finalStatus })
      .eq('id', transaction_id)
      .select()
      .single();

    if (!error) {
      console.log('Sucesso ao atualizar a transação no Supabase:', transaction_id, '->', finalStatus);

      // ── Atualizar vendas + receita do produto (server-side, funciona sem browser) ──
      if (isSuccess && updatedTx) {
        const desc: string = updatedTx.description || '';

        // Extrair product_id do campo description (formato: "Compra: Nome||PRODUCT_ID||prod-xxx")
        const pidMarker = '||PRODUCT_ID||';
        const pidIdx = desc.indexOf(pidMarker);
        const productId = pidIdx !== -1 ? desc.substring(pidIdx + pidMarker.length).split('||')[0].trim() : null;

        if (productId) {
          try {
            const { data: prod } = await supabase.from('products').select('sales, revenue').eq('id', productId).single();
            if (prod) {
              await supabase.from('products').update({
                sales: (prod.sales || 0) + 1,
                revenue: (prod.revenue || 0) + Number(amount || 0)
              }).eq('id', productId);
              console.log(`✅ Produto ${productId} atualizado: +1 venda, +${amount} receita.`);
            }
          } catch (prodErr) {
            console.error('Erro ao atualizar vendas do produto no webhook:', prodErr);
          }
        }
      }

      // ── Determinar o email do merchant para enviar push ──
      // Tenta primeiro o customerEmail guardado na transação,
      // depois procura o produto pelo product_id para obter o user_email do merchant.
      let merchantEmail = payload.user_id || payload.userId || updatedTx?.customerEmail || '';

      if (!merchantEmail && updatedTx?.description) {
        const desc: string = updatedTx.description;
        const pidMarker = '||PRODUCT_ID||';
        const pidIdx = desc.indexOf(pidMarker);
        const productId = pidIdx !== -1 ? desc.substring(pidIdx + pidMarker.length).split('||')[0].trim() : null;
        if (productId) {
          try {
            const { data: prodData } = await supabase.from('products').select('user_email').eq('id', productId).single();
            if (prodData?.user_email) merchantEmail = prodData.user_email;
          } catch {}
        }
      }

      const userId = merchantEmail;
      const notifications: Promise<void>[] = [];

      // Resolve merchant M-Pesa phone from user_settings (populated when merchant saves profile)
      let merchantMpesaPhone = '';
      if (merchantEmail && supabase) {
        try {
          const { data: phoneSetting } = await supabase
            .from('user_settings')
            .select('phone_number')
            .eq('user_email', merchantEmail)
            .single();
          if (phoneSetting?.phone_number) {
            let cleaned = String(phoneSetting.phone_number).replace(/\D/g, '');
            if (cleaned.startsWith('258') && cleaned.length > 9) cleaned = cleaned.substring(3);
            merchantMpesaPhone = cleaned.slice(-9);
            console.log(`📞 Telefone do merchant: ${merchantMpesaPhone}`);
          } else {
            console.warn(`⚠️ Nenhum número de telemóvel em user_settings para: ${merchantEmail}`);
          }
        } catch (phoneErr: any) {
          console.warn('Erro ao obter phone_number do merchant:', phoneErr.message);
        }
      }


      // 1. Push notification (Pushcut/FCM)
      if (userId) {
        notifications.push((async () => {
          try {
            const tokens = await getUserTokens(userId);
            const val = amount ? Number(amount).toLocaleString('pt-PT') : '';
            for (const token of tokens) {
              await sendPushNotification(token, {
                title: isSuccess ? '🤑 Venda Aprovada!' : '⚠️ Venda Falhada',
                body: isSuccess ? `Você realizou uma nova venda no valor de ${val} (Via ${method || 'Gateway'})` : `A transação de ${val} falhou.`,
              });
            }
          } catch (e) { console.error('Erro ao enviar notificação push', e); }
        })());
      }

      // 2. Pushcut notification (global)
      if (pushcutEndpoint && pushcutApiKey) {
        notifications.push((async () => {
          try {
            await fetch(pushcutEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${pushcutApiKey}` },
              body: JSON.stringify({ transaction_id, amount, status: finalStatus, user_id: userId }),
            });
          } catch (pcErr) { console.error('Erro ao notificar Pushcut', pcErr); }
        })());
      }

      // 3. Merchant Webhook & LowTrack
      const notifMeta = parseNotifMeta(updatedTx?.description || null);
      const merchantWebhookUrl = notifMeta?.webhook_url || defaultMerchantWebhookUrl;
      const merchantLowtrackToken = notifMeta?.lowtrack_token || globalLowtrakApiKey;

      if (merchantWebhookUrl && merchantWebhookUrl.startsWith('http')) {
        notifications.push((async () => {
          try {
            let webhookEvents: Record<string, boolean> = { sale_approved: true };
            if (notifMeta?.webhook_events) { try { webhookEvents = JSON.parse(notifMeta.webhook_events); } catch {} }
            const eventName = isSuccess ? 'sale_approved' : 'sale_failed';

            if ((isSuccess && webhookEvents.sale_approved !== false) || !isSuccess) {
              await fetch(merchantWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: eventName,
                  timestamp: new Date().toISOString(),
                  transaction_id, reference, amount, method,
                  customer: { name: customerName, phone },
                  status: finalStatus
                })
              });
            }
          } catch (whErr) { console.error('Erro Merchant Webhook', whErr); }
        })());
      }

      if (merchantLowtrackToken && lowtrackEndpoint) {
        notifications.push((async () => {
          try {
            await fetch(lowtrackEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${merchantLowtrackToken}`, 'User-Agent': 'Mozilla/5.0' },
              body: JSON.stringify({
                event: isSuccess ? 'sale.approved' : 'sale.failed',
                transaction_id, reference, amount, method, status: finalStatus,
                customer: { name: customerName, phone },
                user_id: userId
              })
            });
          } catch (lowErr) { console.error('Erro LowTrack', lowErr); }
        })());
      }


      // --- 5. B2C Automático para o MERCHANT (vendedor do produto) ---
      if (isSuccess && kwikpayClientId && kwikpayClientSecret && kwikpayWalletUuid) {
          notifications.push((async () => {
              try {
                  // 5.0 Verificar se temos o telefone do merchant
                  const targetPhone = merchantMpesaPhone;
                  if (!targetPhone) {
                      console.warn(`⚠️ B2C automático (webhook) cancelado: número de telemóvel do merchant (${userId}) não encontrado. Configure o número nas Definições da conta.`);
                      return;
                  }

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

                  const amountNum = Number(amount);
                  const fee = Math.max(amountNum * 0.07, 10);
                  const b2cAmount = Math.floor(amountNum - fee);

                  console.log(`💸 B2C webhook: ${amountNum} MZN - ${fee} MZN taxa = ${b2cAmount} MZN para merchant ${targetPhone}`);

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
                              reference: `B2CW_${transaction_id}`.substring(0, 20)
                          })
                      });
                      
                      const b2cData = await b2cRes.json();
                      console.log(`Webhook Auto B2C Result (merchant: ${targetPhone}):`, b2cData);
                      
                      if (supabase && b2cData.success) {
                          await supabase.from('transactions').insert([{
                              id: `B2CW_${Date.now()}`,
                              type: 'withdrawal', 
                              amount: b2cAmount, 
                              phone: targetPhone, 
                              method: 'M-Pesa',
                              status: 'Concluído', 
                              reference: `B2CW_${transaction_id}`.substring(0, 20),
                              description: `Saque B2C Automático (Webhook) - ${transaction_id}`,
                              customerName: userId || 'Merchant',
                              customerEmail: userId || 'auto@b2c',
                              createdat: new Date().toISOString(),
                          }]).catch(() => {});
                      } else if (supabase && !b2cData.success) {
                          console.error(`❌ B2C webhook falhou para merchant ${targetPhone}:`, b2cData);
                      }
                  } else {
                      console.log(`Valor muito baixo para B2C webhook após taxas: ${b2cAmount} MZN`);
                  }
              } catch (b2cErr: any) {
                  console.error('Erro no Auto B2C (Webhook):', b2cErr.message || b2cErr);
              }
          })());
      }


      await Promise.allSettled(notifications);

      return res.status(200).json({
        message: 'Webhook processed successfully',
        updated: { transaction_id, status: finalStatus, reference }
      });
    } else {
        // Even if tx update fails, respond 200 to gateway so it doesn't retry infinitely
        console.error('Failed to update tx in DB:', error);
        return res.status(200).json({ message: 'Received, but failed to update DB.', error: error });
    }

  } catch (error: any) {
    console.error('Webhook Error:', error.message);
    return res.status(500).setHeader('Access-Control-Allow-Origin', '*').json({ error: 'Internal Server Error' });
  }
}
