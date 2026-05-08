-- Adiciona número do WhatsApp ao perfil para autenticar comandos do bot
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_number TEXT UNIQUE;
