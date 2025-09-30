-- Bootstrap SQL for initial schema (matches backend/prisma/schema.prisma)
-- Run with: psql -h localhost -U portal_user -d portal_backup_db -f backend/prisma/bootstrap.sql

-- 1) Ensure required extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Tables

CREATE TABLE IF NOT EXISTS clients (
  client_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  acronis_tenant_id UUID NULL,
  created_at TIMESTAMPTZ(6) DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_connections (
  connection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NULL,
  crm_type VARCHAR(50) NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ(6) DEFAULT now(),
  connection_name VARCHAR(255) NOT NULL,
  api_domain VARCHAR(255) NULL,
  deleted_at TIMESTAMPTZ(6) NULL,
  CONSTRAINT fk_crm_connections_client
    FOREIGN KEY (client_id) REFERENCES clients(client_id)
    ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Unique composite constraint as per schema
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'unique_client_crm_type'
  ) THEN
    CREATE UNIQUE INDEX unique_client_crm_type ON crm_connections (client_id, crm_type);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS backup_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NULL,
  job_name VARCHAR(255) NOT NULL,
  schedule VARCHAR(50) NOT NULL,
  storage_region VARCHAR(50) NOT NULL,
  selected_data JSONB NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ(6) DEFAULT now(),
  deleted_at TIMESTAMPTZ(6) NULL,
  CONSTRAINT fk_backup_jobs_connection
    FOREIGN KEY (connection_id) REFERENCES crm_connections(connection_id)
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS job_history (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NULL,
  status VARCHAR(50) NOT NULL,
  start_time TIMESTAMPTZ(6) NULL,
  end_time TIMESTAMPTZ(6) NULL,
  data_transferred_gb NUMERIC(10,2) NULL,
  details TEXT NULL,
  CONSTRAINT fk_job_history_job
    FOREIGN KEY (job_id) REFERENCES backup_jobs(job_id)
    ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Helpful index for latest statuses per job
CREATE INDEX IF NOT EXISTS idx_job_history_job_time ON job_history (job_id, start_time DESC);

