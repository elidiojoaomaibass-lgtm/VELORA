import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY || '';

let supabase: any = null;
if (supabaseUrl && supabaseServiceKey) {
  try { supabase = createClient(supabaseUrl, supabaseServiceKey); } catch {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'id obrigatório' });

  if (!supabase) return res.status(500).json({ error: 'Supabase não configurado' });

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, status, amount, method')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao verificar status:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ status: data?.status || null, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
