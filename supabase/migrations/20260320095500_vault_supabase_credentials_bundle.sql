BEGIN;

ALTER TABLE public.vault_supabase_instances
  ADD COLUMN IF NOT EXISTS encrypted_credentials_payload text,
  ADD COLUMN IF NOT EXISTS credentials_payload_iv text;

COMMIT;
