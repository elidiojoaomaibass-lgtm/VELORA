-- Criar a tabela user_settings com a estrutura correcta
CREATE TABLE IF NOT EXISTS user_settings (
  user_email TEXT PRIMARY KEY,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir coluna phone_number existe (caso tabela antiga com estrutura diferente)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Inserir/actualizar o número M-Pesa padrão do merchant
INSERT INTO user_settings (user_email, phone_number)
VALUES ('ofcdzin6@gmail.com', '856195186')
ON CONFLICT (user_email)
DO UPDATE SET phone_number = '856195186';
