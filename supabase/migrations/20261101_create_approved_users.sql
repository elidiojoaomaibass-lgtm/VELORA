-- ============================================================
-- PASSO 1: Criar a tabela approved_users
-- Cola este bloco no SQL Editor do Supabase e clica em "Run"
-- ============================================================

CREATE TABLE IF NOT EXISTS public.approved_users (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email       text NOT NULL UNIQUE,
    full_name   text,
    active      boolean NOT NULL DEFAULT true,
    notes       text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PASSO 2: Activar Row Level Security
-- ============================================================

ALTER TABLE public.approved_users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PASSO 3: Policy — qualquer utilizador autenticado pode
--          verificar se o SEU próprio email está aprovado
-- ============================================================

DROP POLICY IF EXISTS "Users can check own approval" ON public.approved_users;

CREATE POLICY "Users can check own approval"
    ON public.approved_users
    FOR SELECT
    TO authenticated
    USING (true);

-- ============================================================
-- PASSO 4: Inserir o utilizador administrador aprovado
--          (substitui o email pelo teu se necessário)
-- ============================================================

INSERT INTO public.approved_users (email, full_name, active, notes)
VALUES
    ('ofcdzin6@gmail.com', 'Administrador Principal', true, 'Admin')
ON CONFLICT (email) DO UPDATE SET active = true;
