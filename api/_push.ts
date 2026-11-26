import fetch from 'node-fetch';
import { GoogleAuth } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';

const getProjectId = () =>
  process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'evolux-b9300';

async function getAccessToken(): Promise<string | null> {
  const projectId = getProjectId();
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  let credentials: any = null;
  if (serviceAccountJson) {
    try {
      credentials = JSON.parse(serviceAccountJson);
    } catch {
      console.warn('[_push] FIREBASE_SERVICE_ACCOUNT não é um JSON válido.');
      return null;
    }
  } else if (credPath) {
    try {
      const fs = await import('node:fs/promises');
      credentials = JSON.parse(await fs.readFile(credPath, 'utf8'));
    } catch {
      console.warn('[_push] Não foi possível ler GOOGLE_APPLICATION_CREDENTIALS.');
      return null;
    }
  } else {
    // Service account not provided in env
    return null;
  }

  try {
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const client = await auth.getClient();
    const tokenInfo = await client.getAccessToken();
    return tokenInfo?.token || null;
  } catch (err: any) {
    console.warn('[_push] Erro ao obter access token do FCM:', err.message || err);
    return null;
  }
}

export async function sendPushNotificationV1(
  token: string,
  payload: { title: string; body: string; url?: string; background?: boolean }
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn('[_push] FCM desativado no servidor: FIREBASE_SERVICE_ACCOUNT não configurada.');
      return false;
    }

    const projectId = getProjectId();
    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const body = {
      message: {
        token,
        ...(payload.background
          ? { data: { title: payload.title, body: payload.body } }
          : { notification: { title: payload.title, body: payload.body } }),
        webpush: {
          headers: { Urgency: 'high' },
          ...(payload.url && { fcmOptions: { link: payload.url } }),
          notification: {
            icon: '/logo.png',
          },
        },
        android: { priority: 'high' },
        apns: { payload: { aps: { 'content-available': 1 } }, headers: { 'apns-priority': '10' } },
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn(`[_push] Falha ao enviar FCM v1 (${res.status}):`, errorText);
      return false;
    }

    console.log('[_push] Notificação FCM enviada com sucesso');
    return true;
  } catch (err: any) {
    console.warn('[_push] Exceção ao enviar notificação FCM:', err.message || err);
    return false;
  }
}

export function buildWebhookRequest(rawUrl: string): {
  url: string;
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const match = rawUrl.match(/^https:\/\/api\.pushcut\.io\/([^/]+)\/notifications\/(.+)$/);
  if (match && match[1] !== 'v1') {
    return {
      url: `https://api.pushcut.io/v1/notifications/${match[2]}`,
      headers: { ...headers, 'API-Key': match[1] },
    };
  }
  return { url: rawUrl, headers };
}

export async function getUserTokens(userEmail: string): Promise<string[]> {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';

    if (!supabaseUrl || !supabaseKey) return [];

    const supabase = createClient(supabaseUrl, supabaseKey);
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    if (!cleanEmail) return [];

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('token')
      .eq('user_email', cleanEmail);

    if (error) {
      console.warn('[_push] Erro ao buscar tokens de push:', error.message);
      return [];
    }

    return (data || []).map((row: any) => row.token).filter(Boolean);
  } catch (err: any) {
    console.warn('[_push] Exceção ao buscar tokens no Supabase:', err.message || err);
    return [];
  }
}

