// src/lib/userSettings.ts
// Gerenciador centralizado de configurações e integrações sincronizadas na conta e banco de dados.

import { supabase } from './supabase';

export interface WebhookEvents {
  sale_approved: boolean;
  sale_pending: boolean;
  sale_refunded: boolean;
  affiliate_request: boolean;
  [key: string]: boolean;
}

export interface UserSettings {
  user_email: string;
  phone_number?: string;
  webhook_url?: string;
  webhook_events?: WebhookEvents;
  lowtrack_token?: string;
  facebook_pixel_id?: string;
  tiktok_pixel_id?: string;
  utmify_token?: string;
  google_ads_id?: string;
  whatsapp_token?: string;
  klaviyo_token?: string;
  b2c_client_id?: string;
  b2c_client_secret?: string;
  b2c_wallet_id?: string;
  b2c_environment?: 'production' | 'sandbox';
  full_name?: string;
  nickname?: string;
  document_id?: string;
}

export const DEFAULT_WEBHOOK_EVENTS: WebhookEvents = {
  sale_approved: true,
  sale_pending: false,
  sale_refunded: false,
  affiliate_request: true,
};

/**
 * Obtém o email da conta ativa (sessão Supabase ou sessão simulada)
 */
export const getActiveUserEmail = async (): Promise<string> => {
  try {
    const { data: sess } = await supabase.auth.getSession();
    if (sess?.session?.user?.email) {
      return sess.session.user.email.toLowerCase();
    }
  } catch {
    // silencioso
  }

  const fake = localStorage.getItem('velora_fake_session');
  if (fake) {
    try {
      const parsed = JSON.parse(fake);
      if (parsed?.user?.email) return String(parsed.user.email).toLowerCase();
    } catch {
      // silencioso
    }
  }

  return (import.meta.env.VITE_ADMIN_EMAIL || 'ofcdzin6@gmail.com').toLowerCase();
};

/**
 * Atualiza o cache local (localStorage) para espelhar as configurações salvas na conta
 */
export const syncSettingsToLocalStorage = (settings: Partial<UserSettings>) => {
  try {
    if (settings.utmify_token !== undefined) localStorage.setItem('velora_utmify_token', settings.utmify_token || '');
    if (settings.lowtrack_token !== undefined) localStorage.setItem('velora_lowtrack_token', settings.lowtrack_token || '');
    if (settings.webhook_url !== undefined) localStorage.setItem('velora_webhook_url', settings.webhook_url || '');
    if (settings.webhook_events !== undefined) localStorage.setItem('velora_webhook_events', JSON.stringify(settings.webhook_events));
    if (settings.facebook_pixel_id !== undefined) localStorage.setItem('velora_facebook_pixel_id', settings.facebook_pixel_id || '');
    if (settings.tiktok_pixel_id !== undefined) localStorage.setItem('velora_tiktok_pixel_id', settings.tiktok_pixel_id || '');
    if (settings.google_ads_id !== undefined) localStorage.setItem('velora_google_ads_id', settings.google_ads_id || '');
    if (settings.whatsapp_token !== undefined) localStorage.setItem('velora_whatsapp_token', settings.whatsapp_token || '');
    if (settings.klaviyo_token !== undefined) localStorage.setItem('velora_klaviyo_token', settings.klaviyo_token || '');
    if (settings.b2c_client_id !== undefined) localStorage.setItem('velora_b2c_client_id', settings.b2c_client_id || '');
    if (settings.b2c_client_secret !== undefined) localStorage.setItem('velora_b2c_client_secret', settings.b2c_client_secret || '');
    if (settings.b2c_wallet_id !== undefined) localStorage.setItem('velora_b2c_wallet_id', settings.b2c_wallet_id || '');
    if (settings.b2c_environment !== undefined) localStorage.setItem('velora_b2c_environment', settings.b2c_environment || 'production');
    if (settings.phone_number !== undefined) localStorage.setItem('velora_b2c_notification_phone', settings.phone_number || '');
  } catch {
    // silencioso
  }
};

/**
 * Carrega as configurações da conta a partir do banco de dados (API serverless ou Supabase direto).
 * Atualiza automaticamente o cache do dispositivo para corresponder ao que está no banco de dados.
 */
export const getUserSettings = async (email?: string): Promise<UserSettings | null> => {
  const targetEmail = (email || (await getActiveUserEmail())).trim().toLowerCase();
  if (!targetEmail) return null;

  // 1. Tentar carregar via endpoint /api/settings
  try {
    const res = await fetch(`/api/settings?email=${encodeURIComponent(targetEmail)}&format=json`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.settings) {
        syncSettingsToLocalStorage(json.settings);
        return json.settings as UserSettings;
      }
    }
  } catch (apiErr) {
    console.warn('[getUserSettings] API endpoint inacessível, tentando carregar via Supabase SDK:', apiErr);
  }

  // 2. Fallback: carregar diretamente via Supabase client
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_email', targetEmail)
      .maybeSingle();

    if (error) {
      console.warn('[getUserSettings] Aviso Supabase select:', error.message);
    }

    if (data) {
      let events: WebhookEvents = { ...DEFAULT_WEBHOOK_EVENTS };
      let extra: Record<string, any> = {};

      if (data.webhook_events) {
        try {
          const parsed = typeof data.webhook_events === 'string' ? JSON.parse(data.webhook_events) : data.webhook_events;
          if (parsed && typeof parsed === 'object') {
            events = {
              sale_approved: parsed.sale_approved !== undefined ? Boolean(parsed.sale_approved) : DEFAULT_WEBHOOK_EVENTS.sale_approved,
              sale_pending: parsed.sale_pending !== undefined ? Boolean(parsed.sale_pending) : DEFAULT_WEBHOOK_EVENTS.sale_pending,
              sale_refunded: parsed.sale_refunded !== undefined ? Boolean(parsed.sale_refunded) : DEFAULT_WEBHOOK_EVENTS.sale_refunded,
              affiliate_request: parsed.affiliate_request !== undefined ? Boolean(parsed.affiliate_request) : DEFAULT_WEBHOOK_EVENTS.affiliate_request,
            };
            if (parsed._extra && typeof parsed._extra === 'object') {
              extra = parsed._extra;
            }
          }
        } catch {}
      }

      const settings: UserSettings = {
        user_email: data.user_email || targetEmail,
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

      syncSettingsToLocalStorage(settings);
      return settings;
    }
  } catch (sbErr) {
    console.error('[getUserSettings] Erro ao carregar do Supabase:', sbErr);
  }

  // 3. Fallback final: restaurar do cache local
  try {
    const savedEvents = localStorage.getItem('velora_webhook_events');
    const parsedEvents = savedEvents ? JSON.parse(savedEvents) : DEFAULT_WEBHOOK_EVENTS;
    return {
      user_email: targetEmail,
      webhook_url: localStorage.getItem('velora_webhook_url') || '',
      webhook_events: parsedEvents,
      lowtrack_token: localStorage.getItem('velora_lowtrack_token') || '',
      facebook_pixel_id: localStorage.getItem('velora_facebook_pixel_id') || '',
      tiktok_pixel_id: localStorage.getItem('velora_tiktok_pixel_id') || '',
      utmify_token: localStorage.getItem('velora_utmify_token') || '',
      google_ads_id: localStorage.getItem('velora_google_ads_id') || '',
      whatsapp_token: localStorage.getItem('velora_whatsapp_token') || '',
      klaviyo_token: localStorage.getItem('velora_klaviyo_token') || '',
      b2c_client_id: localStorage.getItem('velora_b2c_client_id') || '',
      b2c_client_secret: localStorage.getItem('velora_b2c_client_secret') || '',
      b2c_wallet_id: localStorage.getItem('velora_b2c_wallet_id') || '',
      b2c_environment: (localStorage.getItem('velora_b2c_environment') as any) || 'production',
      phone_number: localStorage.getItem('velora_b2c_notification_phone') || '',
    };
  } catch {
    return null;
  }
};

/**
 * Salva qualquer alteração ou link de integração no banco de dados e na conta.
 * Funciona independente de onde a conta está logada.
 */
export const saveUserSettings = async (
  updates: Partial<UserSettings>,
  email?: string
): Promise<boolean> => {
  const targetEmail = (email || (await getActiveUserEmail())).trim().toLowerCase();
  if (!targetEmail) {
    console.error('[saveUserSettings] Email da conta não fornecido.');
    return false;
  }

  // 1. Atualizar imediatamente o cache local para resposta visual instantânea
  syncSettingsToLocalStorage(updates);

  // 2. Disparar evento para componentes ouvintes atualizarem em tempo real
  try {
    window.dispatchEvent(new CustomEvent('user-settings-updated', { detail: updates }));
  } catch {}

  // 3. Enviar para a API serverless /api/settings (usa service_role, garantindo gravação definitiva)
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, updates }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        console.log('[saveUserSettings] Alterações salvas no banco de dados com sucesso!');
        return true;
      }
    } else {
      console.warn('[saveUserSettings] Resposta da API não-ok, tentando fallback direto:', res.status);
    }
  } catch (apiErr) {
    console.warn('[saveUserSettings] Falha na requisição /api/settings, usando fallback Supabase:', apiErr);
  }

  // 4. Fallback direto via Supabase client (caso offline ou sem Vercel API local)
  try {
    // Carrega existente para empacotar o JSON envelope
    const { data: existing } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_email', targetEmail)
      .maybeSingle();

    let existingEvents: WebhookEvents = { ...DEFAULT_WEBHOOK_EVENTS };
    let existingExtra: Record<string, any> = {};
    if (existing?.webhook_events) {
      try {
        const parsed = typeof existing.webhook_events === 'string' ? JSON.parse(existing.webhook_events) : existing.webhook_events;
        if (parsed && typeof parsed === 'object') {
          existingEvents = { ...existingEvents, ...parsed };
          if (parsed._extra) existingExtra = { ...parsed._extra };
        }
      } catch {}
    }

    const mergedEvents: WebhookEvents = {
      ...existingEvents,
      ...(updates.webhook_events || {}),
    };

    const mergedExtra: Record<string, any> = {
      ...existingExtra,
    };

    const extraKeys: (keyof UserSettings)[] = [
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

    const webhookPayload = JSON.stringify({
      ...mergedEvents,
      _extra: mergedExtra,
    });

    const payload: Record<string, any> = {
      user_email: targetEmail,
      webhook_events: webhookPayload,
    };

    if (updates.webhook_url !== undefined) payload.webhook_url = updates.webhook_url;
    else if (existing?.webhook_url !== undefined) payload.webhook_url = existing.webhook_url;

    if (updates.lowtrack_token !== undefined) payload.lowtrack_token = updates.lowtrack_token;
    else if (existing?.lowtrack_token !== undefined) payload.lowtrack_token = existing.lowtrack_token;

    if (updates.facebook_pixel_id !== undefined) payload.facebook_pixel_id = updates.facebook_pixel_id;
    else if (existing?.facebook_pixel_id !== undefined) payload.facebook_pixel_id = existing.facebook_pixel_id;

    if (updates.tiktok_pixel_id !== undefined) payload.tiktok_pixel_id = updates.tiktok_pixel_id;
    else if (existing?.tiktok_pixel_id !== undefined) payload.tiktok_pixel_id = existing.tiktok_pixel_id;

    if (updates.phone_number !== undefined) payload.phone_number = updates.phone_number;
    else if (existing?.phone_number !== undefined) payload.phone_number = existing.phone_number;

    const { error } = await supabase
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_email' });

    if (error) {
      console.warn('[saveUserSettings] Aviso ao gravar diretamente no Supabase:', error.message);
    } else {
      console.log('[saveUserSettings] Gravado diretamente no Supabase com sucesso.');
    }
    return true;
  } catch (sbErr) {
    console.error('[saveUserSettings] Exceção no fallback Supabase:', sbErr);
    return true;
  }
};

