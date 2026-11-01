import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY || '';

let supabase: any = null;
if (supabaseUrl && supabaseServiceKey) {
  try { supabase = createClient(supabaseUrl, supabaseServiceKey); } catch {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase não configurado no servidor.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { id, type, amount, phone, method, status, reference, description, customerName, customerEmail, device } = body;

    if (!id || !amount) {
      return res.status(400).json({ error: 'id e amount são obrigatórios.' });
    }

    const { error } = await supabase.from('transactions').upsert([{
      id,
      type: type || 'payment',
      amount: Number(amount),
      phone: phone || '',
      method: method || 'e-Mola',
      status: status || 'Pendente',
      reference: reference || id,
      description: description || '',
      customerName: customerName || 'Cliente',
      customerEmail: customerEmail || '',
      device: device || 'Desktop',
      createdat: new Date().toISOString(),
    }], { onConflict: 'id', ignoreDuplicates: false });

    if (error) {
      console.error('Erro ao registar transação:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, id });
  } catch (err: any) {
    console.error('Erro no register-transaction:', err.message);
    return res.status(500).json({ error: 'Erro interno.' });
  }
}
