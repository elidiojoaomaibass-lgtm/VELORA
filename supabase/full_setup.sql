-- ==============================================================================
-- EVOLUX PROD / INFROPAY - SQL SETUP DEFINITIVO (CORRIGIDO)
-- ==============================================================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA DE PRODUTOS
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    sales INTEGER NOT NULL DEFAULT 0,
    revenue NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Ativo',
    description TEXT,
    phone TEXT,
    salesLink TEXT,
    pixel TEXT,
    isMarketplaceEnabled BOOLEAN NOT NULL DEFAULT true,
    commission NUMERIC NOT NULL DEFAULT 0,
    affiliationType TEXT NOT NULL DEFAULT 'Automatica',
    image TEXT,
    deliveryLink TEXT,
    enableCountdown BOOLEAN DEFAULT false,
    user_email TEXT,
    enableScarcity BOOLEAN DEFAULT false,
    enableScarcityNotification BOOLEAN DEFAULT false,
    barColor TEXT,
    createdat TIMESTAMPTZ DEFAULT now()
);

-- 3. TABELA DE IMAGENS DE PRODUTOS
CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABELA DE TRANSAÇÕES
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    phone TEXT,
    method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendente',
    reference TEXT,
    description TEXT,
    customerName TEXT,
    customerEmail TEXT,
    createdat TIMESTAMPTZ DEFAULT now(),
    device TEXT,
    failureReason TEXT
);

-- 5. TABELA DE AFILIADOS
CREATE TABLE IF NOT EXISTS public.affiliate_requests (
    id TEXT PRIMARY KEY,
    productId TEXT,
    productName TEXT,
    userName TEXT,
    userEmail TEXT,
    status TEXT NOT NULL DEFAULT 'Pendente',
    requestedAt TEXT,
    commission NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TABELA DE CUPONS
CREATE TABLE IF NOT EXISTS public.coupons (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    discount NUMERIC NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'Percentage',
    productId TEXT NOT NULL DEFAULT 'all',
    status TEXT NOT NULL DEFAULT 'Ativo',
    uses INTEGER NOT NULL DEFAULT 0,
    enableScarcity BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. TABELA DE CAMPANHAS DE MARKETING
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Ativo',
    leads INTEGER NOT NULL DEFAULT 0,
    conversions INTEGER NOT NULL DEFAULT 0,
    spend NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. TABELA DE NOTIFICAÇÕES PUSH
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. TABELA DE CONFIGURAÇÕES DE USUÁRIO / INTEGRAÇÕES
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

-- 10. HABILITAR SEGURANÇA RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- 11. LIMPAR POLÍTICAS ANTERIORES
DROP POLICY IF EXISTS "Public access for products" ON public.products;
DROP POLICY IF EXISTS "Public access for product_images" ON public.product_images;
DROP POLICY IF EXISTS "Public access for transactions" ON public.transactions;
DROP POLICY IF EXISTS "Public access for affiliate_requests" ON public.affiliate_requests;
DROP POLICY IF EXISTS "Public access for coupons" ON public.coupons;
DROP POLICY IF EXISTS "Public access for marketing_campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Public access for push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Public access for user_settings" ON public.user_settings;

-- 12. CRIAR POLÍTICAS DE ACESSO
CREATE POLICY "Public access for products" ON public.products FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access for product_images" ON public.product_images FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access for transactions" ON public.transactions FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access for affiliate_requests" ON public.affiliate_requests FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access for coupons" ON public.coupons FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access for marketing_campaigns" ON public.marketing_campaigns FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access for push_subscriptions" ON public.push_subscriptions FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access for user_settings" ON public.user_settings FOR ALL TO public USING (true) WITH CHECK (true);
