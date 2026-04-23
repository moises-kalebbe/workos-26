-- ============================================
-- 018: Módulo Clientes + Arquivos por serviço
-- ============================================

CREATE TABLE IF NOT EXISTS clients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_name ON clients(user_id, name);

CREATE TABLE IF NOT EXISTS client_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  file_mime    TEXT NOT NULL,
  file_size    INTEGER NOT NULL,
  file_data    TEXT NOT NULL,
  service_date DATE NOT NULL,
  service_type TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_files_user_client
  ON client_files(user_id, client_id);
CREATE INDEX IF NOT EXISTS idx_client_files_user_client_date
  ON client_files(user_id, client_id, service_date DESC);
CREATE INDEX IF NOT EXISTS idx_client_files_service_type
  ON client_files(user_id, service_type);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_clients_updated ON clients;
CREATE TRIGGER tr_clients_updated
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_client_files_updated ON client_files;
CREATE TRIGGER tr_client_files_updated
  BEFORE UPDATE ON client_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
