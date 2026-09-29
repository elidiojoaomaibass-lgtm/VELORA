-- 1. Criar a tabela user_settings se não existir
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_email TEXT UNIQUE NOT NULL,
    webhook_url TEXT,
    webhook_events TEXT,
    lowtrack_token TEXT,
    facebook_pixel_id TEXT,
    tiktok_pixel_id TEXT,
    phone_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Garantir que a coluna phone_number existe caso a tabela já existisse antes
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- 3. Guardar o número M-Pesa do merchant diretamente na tabela
INSERT INTO user_settings (user_email, phone_number)
VALUES ('ofcdzin6@gmail.com', '856195186')
ON CONFLICT (user_email)
DO UPDATE SET phone_number = '856195186';
