Database Setup (PostgreSQL + Prisma)

1) Create DB and user in psql

- Connect as a superuser (e.g., postgres):
  - `psql -h localhost -U postgres`

- Create role and database:
  - `CREATE ROLE portal_user WITH LOGIN PASSWORD 'password_yang_aman';`
  - `CREATE DATABASE portal_backup_db OWNER portal_user;`

- Enable extension for UUID generation (required by schema):
  - `\c portal_backup_db` (connect to the DB)
  - `CREATE EXTENSION IF NOT EXISTS pgcrypto;`

2) Configure environment

- Copy `backend/.env.example` to `backend/.env` and set:
  - `DATABASE_URL=postgresql://portal_user:password_yang_aman@localhost:5432/portal_backup_db?schema=public`
  - `JWT_SECRET`, `ZOHO_*`, `FRONTEND_BASE_URL`, `API_BASE_URL`

3) Create tables

- Option A: Use Prisma Migrate (recommended)
  - From `backend/`: run `npm run prisma:migrate:dev` (creates migrations and applies them)
  - Generate client (if needed): `npm run prisma:generate`

- Option B: Apply SQL directly via psql
  - From project root: `psql -h localhost -U portal_user -d portal_backup_db -f backend/prisma/bootstrap.sql`

4) (Optional) Inspect data

- `npm run db:studio` to open Prisma Studio

5) Create a client account

- Recommended via API (hashes password securely):
  - POST `{{API_BASE_URL}}/clients` with JSON body: `{ "company_name": "Acme", "email": "admin@example.com", "password": "admin123" }`
  - Then login via `{{API_BASE_URL}}/auth/login`

Notes

- The schema uses `gen_random_uuid()` from `pgcrypto`; ensure the extension is enabled (step 1).
- If you prefer `uuid_generate_v4()` (uuid-ossp), adjust the Prisma schema and SQL accordingly.

