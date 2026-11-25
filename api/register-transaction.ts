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
    const { action, id, type, amount, phone, method, status, reference, description, customerName, customerEmail, device, failureReason } = body;

    if (!id) {
      return res.status(400).json({ error: 'id é obrigatório.' });
    }

    // Atualização de status (ex: Pendente -> Falhou após erro de PIN/saldo) contornando RLS
    if (action === 'update_status') {
      const updatePayload: Record<string, any> = {
        status: status || 'Falhou',
      };
      if (failureReason) {
        updatePayload.failurereason = failureReason;
      }

      const { data: updatedRows, error: updateErr } = await supabase
        .from('transactions')
        .update(updatePayload)
        .eq('id', id)
        .select('id');

      if (updateErr) {
        console.error('Erro ao atualizar status da transação:', updateErr);
        return res.status(500).json({ error: updateErr.message });
      }

      if (updatedRows && updatedRows.length > 0) {
        return res.status(200).json({ success: true, id, updated: true });
      }
      // Se não existia ainda e temos amount, continua para inserir abaixo
      if (!amount) {
        return res.status(200).json({ success: true, id, updated: false });
      }
    }

    if (!amount) {
      return res.status(400).json({ error: 'id e amount são obrigatórios.' });
    }

    const rowPayload: Record<string, any> = {
      id,
      type: type || 'payment',
      amount: Number(amount),
      phone: phone || '',
      method: method || 'e-Mola',
      status: status || 'Pendente',
      reference: reference || id,
      description: description || '',
      customername: customerName || 'Cliente',
      customeremail: customerEmail || '',
      device: device || 'Desktop',
      createdat: new Date().toISOString(),
    };
    if (failureReason) {
      rowPayload.failurereason = failureReason;
    }

    const { error } = await supabase.from('transactions').upsert([rowPayload], { onConflict: 'id' });

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
