-- Add phone_number column to user_settings for automatic B2C merchant payouts
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

COMMENT ON COLUMN user_settings.phone_number IS 'Número de telemóvel M-Pesa do merchant para B2C automático após venda';
