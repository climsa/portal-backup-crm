-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."backup_jobs" (
    "job_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "connection_id" UUID,
    "job_name" VARCHAR(255) NOT NULL,
    "schedule" VARCHAR(50) NOT NULL,
    "storage_region" VARCHAR(50) NOT NULL,
    "selected_data" JSONB,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "backup_jobs_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "public"."clients" (
    "client_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "acronis_tenant_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("client_id")
);

-- CreateTable
CREATE TABLE "public"."crm_connections" (
    "connection_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID,
    "crm_type" VARCHAR(50) NOT NULL,
    "encrypted_refresh_token" TEXT NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "connection_name" VARCHAR(255) NOT NULL,
    "api_domain" VARCHAR(255),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "crm_connections_pkey" PRIMARY KEY ("connection_id")
);

-- CreateTable
CREATE TABLE "public"."job_history" (
    "log_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID,
    "status" VARCHAR(50) NOT NULL,
    "start_time" TIMESTAMPTZ(6),
    "end_time" TIMESTAMPTZ(6),
    "data_transferred_gb" DECIMAL(10,2),
    "details" TEXT,

    CONSTRAINT "job_history_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_email_key" ON "public"."clients"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "unique_client_crm_type" ON "public"."crm_connections"("client_id" ASC, "crm_type" ASC);

-- AddForeignKey
ALTER TABLE "public"."backup_jobs" ADD CONSTRAINT "backup_jobs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."crm_connections"("connection_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."crm_connections" ADD CONSTRAINT "crm_connections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("client_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."job_history" ADD CONSTRAINT "job_history_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."backup_jobs"("job_id") ON DELETE CASCADE ON UPDATE NO ACTION;

