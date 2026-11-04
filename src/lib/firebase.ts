import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// TODO: Substitua pelos valores reais de configuração do Firebase ou use variáveis de ambiente.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

/**
 * Recupera o token FCM do dispositivo atual.
 * Chame isso depois que o usuário conceder permissão de Notificação.
 */
export const getFcmToken = async (registration?: ServiceWorkerRegistration): Promise<string | null> => {
  try {
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token;
  } catch (err) {
    console.error('Erro ao buscar token FCM', err);
    return null;
  }
};

// Opcional: escuta mensagens em primeiro plano.
export const onFcmMessage = (callback: (payload: any) => void) => {
  return onMessage(messaging, (payload) => {
    console.log('Mensagem FCM em primeiro plano', payload);
    callback(payload);
  });
};

import { supabase } from './supabase';
import { getActiveUserEmail } from './userSettings';

/**
 * Persiste o token FCM no Supabase na tabela push_subscriptions.
 * Chame após getFcmToken quando o usuário estiver autenticado.
 */
export const storeFcmToken = async (uidOrEmail: string, token: string) => {
  try {
    const cleanEmail = (uidOrEmail || '').trim().toLowerCase();
    if (!cleanEmail) return;
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ user_email: cleanEmail, token }, { onConflict: 'token' });
    if (error) throw error;
    console.log('Token FCM armazenado no Supabase para email', cleanEmail);
  } catch (err) {
    console.error('Erro ao armazenar token FCM', err);
  }
};

/**
 * Solicita permissão de notificação ao navegador, obtém o token FCM e o armazena no Supabase.
 * Se um email de usuário for fornecido, o token será associado a esse usuário.
 */
export const requestPermissionAndStoreToken = async (email?: string): Promise<void> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  // Solicita permissão ao navegador
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('Permissão de notificação não concedida');
    return;
  }

  // Obtém o token FCM
  const token = await getFcmToken();
  if (!token) {
    console.warn('Falha ao obter token FCM');
    return;
  }

  // Armazena o token para o usuário ativo
  const targetEmail = email || (await getActiveUserEmail());
  if (targetEmail) {
    await storeFcmToken(targetEmail, token);
  } else {
    localStorage.setItem('fcm_token', token);
  }
};

