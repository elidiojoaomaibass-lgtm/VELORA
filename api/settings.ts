import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

let supabaseAdmin: any = null;
if (supabaseUrl && supabaseServiceKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  } catch (err) {
    console.error('[api/settings] Falha ao inicializar Supabase client:', err);
  }
}

interface WebhookEventsObj {
  sale_approved?: boolean;
  sale_pending?: boolean;
  sale_refunded?: boolean;
  affiliate_request?: boolean;
  [key: string]: any;
}

const DEFAULT_EVENTS: WebhookEventsObj = {
  sale_approved: true,
  sale_pending: false,
  sale_refunded: false,
  affiliate_request: true,
};

function parseWebhookEventsAndExtra(raw: any): { events: WebhookEventsObj; extra: Record<string, any> } {
  if (!raw) return { events: { ...DEFAULT_EVENTS }, extra: {} };

  let parsed: any = {};
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { events: { ...DEFAULT_EVENTS }, extra: {} };
    }
  } else if (typeof raw === 'object' && raw !== null) {
    parsed = raw;
  }

  const extra = parsed._extra && typeof parsed._extra === 'object' ? parsed._extra : {};
  const events: WebhookEventsObj = {
    sale_approved: parsed.sale_approved !== undefined ? Boolean(parsed.sale_approved) : DEFAULT_EVENTS.sale_approved,
    sale_pending: parsed.sale_pending !== undefined ? Boolean(parsed.sale_pending) : DEFAULT_EVENTS.sale_pending,
    sale_refunded: parsed.sale_refunded !== undefined ? Boolean(parsed.sale_refunded) : DEFAULT_EVENTS.sale_refunded,
    affiliate_request: parsed.affiliate_request !== undefined ? Boolean(parsed.affiliate_request) : DEFAULT_EVENTS.affiliate_request,
  };

  return { events, extra };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase não configurado no servidor.' });
  }

  // ─────────────────────────────────────────────────────────────
  // GET: Obter configurações sincronizadas da conta do utilizador
  // ─────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const emailParam = String(req.query.email || '').trim().toLowerCase();
    if (!emailParam) {
      return res.status(400).json({ error: 'Parâmetro email é obrigatório.' });
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('user_settings')
        .select('*')
        .eq('user_email', emailParam)
        .maybeSingle();

      if (error) {
        console.error('[api/settings] Erro ao carregar user_settings:', error);
        return res.status(500).json({ error: error.message });
      }

      if (!data) {
        return res.status(200).json({
          success: true,
          settings: {
            user_email: emailParam,
            webhook_url: '',
            webhook_events: { ...DEFAULT_EVENTS },
            lowtrack_token: '',
            facebook_pixel_id: '',
            tiktok_pixel_id: '',
            utmify_token: '',
            google_ads_id: '',
            whatsapp_token: '',
            klaviyo_token: '',
            b2c_client_id: '',
            b2c_client_secret: '',
            b2c_wallet_id: '',
            b2c_environment: 'production',
            phone_number: '',
          },
        });
      }

      const { events, extra } = parseWebhookEventsAndExtra(data.webhook_events);

      const unifiedSettings = {
        user_email: data.user_email || emailParam,
        webhook_url: data.webhook_url || '',
        webhook_events: events,
        lowtrack_token: data.lowtrack_token || '',
        facebook_pixel_id: data.facebook_pixel_id || '',
        tiktok_pixel_id: data.tiktok_pixel_id || '',
        utmify_token: data.utmify_token ?? extra.utmify_token ?? '',
        google_ads_id: data.google_ads_id ?? extra.google_ads_id ?? '',
        whatsapp_token: data.whatsapp_token ?? extra.whatsapp_token ?? '',
        klaviyo_token: data.klaviyo_token ?? extra.klaviyo_token ?? '',
        b2c_client_id: data.b2c_client_id ?? extra.b2c_client_id ?? '',
        b2c_client_secret: data.b2c_client_secret ?? extra.b2c_client_secret ?? '',
        b2c_wallet_id: data.b2c_wallet_id ?? extra.b2c_wallet_id ?? '',
        b2c_environment: data.b2c_environment ?? extra.b2c_environment ?? 'production',
        phone_number: data.phone_number || '',
        full_name: data.full_name ?? extra.full_name ?? '',
        nickname: data.nickname ?? extra.nickname ?? '',
        document_id: data.document_id ?? extra.document_id ?? '',
      };

      return res.status(200).json({ success: true, settings: unifiedSettings });
    } catch (err: any) {
      console.error('[api/settings] Exceção no GET:', err);
      return res.status(500).json({ error: err.message || 'Erro interno.' });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // POST: Guardar/Atualizar configurações sincronizadas da conta
  // ─────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const email = String(body.email || body.user_email || '').trim().toLowerCase();
      const updates = body.updates || body || {};

      if (!email) {
        return res.status(400).json({ error: 'O email da conta é obrigatório para guardar alterações.' });
      }

      // 1. Carrega dados existentes para merge seguro
      const { data: existing } = await supabaseAdmin
        .from('user_settings')
        .select('*')
        .eq('user_email', email)
        .maybeSingle();

      const { events: existingEvents, extra: existingExtra } = parseWebhookEventsAndExtra(existing?.webhook_events);

      // 2. Mescla eventos de webhook
      const mergedEvents: WebhookEventsObj = {
        ...existingEvents,
        ...(updates.webhook_events || {}),
      };

      // 3. Mescla configurações extras (que são compatíveis tanto em coluna dedicada quanto em JSON fallback)
      const mergedExtra: Record<string, any> = {
        ...existingExtra,
      };

      const extraKeys = [
        'utmify_token',
        'google_ads_id',
        'whatsapp_token',
        'klaviyo_token',
        'b2c_client_id',
        'b2c_client_secret',
        'b2c_wallet_id',
        'b2c_environment',
        'full_name',
        'nickname',
        'document_id',
      ];

      for (const key of extraKeys) {
        if (updates[key] !== undefined) {
          mergedExtra[key] = updates[key];
        }
      }

      // Envelope JSON que garante persistência imediata mesmo antes de migração de colunas
      const combinedWebhookEventsPayload = JSON.stringify({
        ...mergedEvents,
        _extra: mergedExtra,
      });

      // 4. Payload com as colunas nativas existentes no Supabase
      const basePayload: Record<string, any> = {
        user_email: email,
        webhook_events: combinedWebhookEventsPayload,
      };

      if (updates.webhook_url !== undefined) basePayload.webhook_url = updates.webhook_url;
      else if (existing?.webhook_url !== undefined) basePayload.webhook_url = existing.webhook_url;

      if (updates.lowtrack_token !== undefined) basePayload.lowtrack_token = updates.lowtrack_token;
      else if (existing?.lowtrack_token !== undefined) basePayload.lowtrack_token = existing.lowtrack_token;

      if (updates.facebook_pixel_id !== undefined) basePayload.facebook_pixel_id = updates.facebook_pixel_id;
      else if (existing?.facebook_pixel_id !== undefined) basePayload.facebook_pixel_id = existing.facebook_pixel_id;

      if (updates.tiktok_pixel_id !== undefined) basePayload.tiktok_pixel_id = updates.tiktok_pixel_id;
      else if (existing?.tiktok_pixel_id !== undefined) basePayload.tiktok_pixel_id = existing.tiktok_pixel_id;

      if (updates.phone_number !== undefined) basePayload.phone_number = updates.phone_number;
      else if (existing?.phone_number !== undefined) basePayload.phone_number = existing.phone_number;

      // 5. Tenta incluir as novas colunas caso a tabela já tenha sido alterada (se não, faz fallback)
      const fullPayload: Record<string, any> = { ...basePayload };
      for (const key of extraKeys) {
        if (updates[key] !== undefined) {
          fullPayload[key] = updates[key];
        } else if (existing && existing[key] !== undefined) {
          fullPayload[key] = existing[key];
        }
      }

      // Tentativa 1: upsert com colunas completas
      let { error: upsertError } = await supabaseAdmin
        .from('user_settings')
        .upsert(fullPayload, { onConflict: 'user_email' });

      // Se falhou por coluna inexistente, faz upsert com basePayload (que usa o JSON envelope)
      if (upsertError && (upsertError.message?.includes('column') || upsertError.code === '42703')) {
        console.warn('[api/settings] Colunas estendidas ainda não migradas na DB, usando JSON envelope fallback.');
        const retry = await supabaseAdmin
          .from('user_settings')
          .upsert(basePayload, { onConflict: 'user_email' });
        upsertError = retry.error;
      }

      if (upsertError) {
        console.error('[api/settings] Erro ao gravar user_settings:', upsertError);
        return res.status(500).json({ error: upsertError.message });
      }

      const unifiedSettings = {
        user_email: email,
        webhook_url: basePayload.webhook_url || '',
        webhook_events: mergedEvents,
        lowtrack_token: basePayload.lowtrack_token || '',
        facebook_pixel_id: basePayload.facebook_pixel_id || '',
        tiktok_pixel_id: basePayload.tiktok_pixel_id || '',
        utmify_token: mergedExtra.utmify_token || '',
        google_ads_id: mergedExtra.google_ads_id || '',
        whatsapp_token: mergedExtra.whatsapp_token || '',
        klaviyo_token: mergedExtra.klaviyo_token || '',
        b2c_client_id: mergedExtra.b2c_client_id || '',
        b2c_client_secret: mergedExtra.b2c_client_secret || '',
        b2c_wallet_id: mergedExtra.b2c_wallet_id || '',
        b2c_environment: mergedExtra.b2c_environment || 'production',
        phone_number: basePayload.phone_number || '',
        full_name: mergedExtra.full_name || '',
        nickname: mergedExtra.nickname || '',
        document_id: mergedExtra.document_id || '',
      };

      console.log(`[api/settings] Configurações salvas no Supabase para ${email}`);
      return res.status(200).json({ success: true, settings: unifiedSettings });
    } catch (err: any) {
      console.error('[api/settings] Exceção no POST:', err);
      return res.status(500).json({ error: err.message || 'Erro interno.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

