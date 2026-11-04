-- ==============================================================================
-- INFROPAY / VELORA - EXPANSÃO DEFINITIVA DA TABELA user_settings
-- Execute este script no Dashboard do Supabase -> SQL Editor para aplicar
-- todas as novas colunas e garantir acesso público/autenticado sem bloqueios.
-- ==============================================================================

-- 1. Garante a criação da tabela user_settings caso ainda não exista
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    webhook_url TEXT,
    webhook_events TEXT,
    lowtrack_token TEXT,
    facebook_pixel_id TEXT,
    tiktok_pixel_id TEXT,
    utmify_token TEXT,
    google_ads_id TEXT,
    whatsapp_token TEXT,
    klaviyo_token TEXT,
    b2c_client_id TEXT,
    b2c_client_secret TEXT,
    b2c_wallet_id TEXT,
    b2c_environment TEXT DEFAULT 'production',
    full_name TEXT,
    nickname TEXT,
    document_id TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Adiciona colunas se a tabela já existir com esquema anterior
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS webhook_events TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS lowtrack_token TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS facebook_pixel_id TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS tiktok_pixel_id TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS utmify_token TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS google_ads_id TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS whatsapp_token TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS klaviyo_token TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS b2c_client_id TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS b2c_client_secret TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS b2c_wallet_id TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS b2c_environment TEXT DEFAULT 'production';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS document_id TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Garante constraint UNIQUE em user_email para operações de upsert sem erro
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_user_email_key'
    ) THEN
        ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_user_email_key UNIQUE (user_email);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 4. Habilita RLS e cria política de acesso aberta como nas outras tabelas do sistema
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can upsert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Public access for user_settings" ON public.user_settings;

CREATE POLICY "Public access for user_settings" 
ON public.user_settings 
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

