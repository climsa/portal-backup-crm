// Seed script: creates a demo client, a Zoho connection, and one backup job
require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const plainPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const companyName = process.env.SEED_COMPANY_NAME || 'Demo Company';

  console.log('[Seed] Upserting client:', email);
  let client = await prisma.clients.findUnique({ where: { email } });
  if (!client) {
    const password_hash = await bcrypt.hash(plainPassword, 10);
    client = await prisma.clients.create({
      data: { company_name: companyName, email, password_hash },
      select: { client_id: true, company_name: true, email: true },
    });
    console.log('[Seed] Created client:', client);
  } else {
    console.log('[Seed] Client already exists:', client.email);
  }

  const apiDomain = process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com';
  const connectionName = process.env.SEED_CONNECTION_NAME || 'Demo Zoho';
  const dummyRefreshToken = process.env.SEED_DUMMY_REFRESH_TOKEN || 'DUMMY_LOCAL_TEST';

  console.log('[Seed] Upserting Zoho connection for client:', client.client_id);
  await prisma.crm_connections.upsert({
    where: { client_id_crm_type: { client_id: client.client_id, crm_type: 'zoho_crm' } },
    update: {
      connection_name: connectionName,
      api_domain: apiDomain,
      encrypted_refresh_token: dummyRefreshToken,
      deleted_at: null,
      is_active: true,
    },
    create: {
      client_id: client.client_id,
      crm_type: 'zoho_crm',
      connection_name: connectionName,
      api_domain: apiDomain,
      encrypted_refresh_token: dummyRefreshToken,
      is_active: true,
    },
  });

  const connection = await prisma.crm_connections.findFirst({
    where: { client_id: client.client_id, crm_type: 'zoho_crm', deleted_at: null },
  });

  if (!connection) {
    throw new Error('[Seed] Failed to find or create Zoho connection');
  }

  const jobName = process.env.SEED_JOB_NAME || 'Daily Production Backup';
  console.log('[Seed] Ensuring backup job exists:', jobName);
  let job = await prisma.backup_jobs.findFirst({
    where: { job_name: jobName, connection_id: connection.connection_id, deleted_at: null },
  });
  if (!job) {
    job = await prisma.backup_jobs.create({
      data: {
        job_name: jobName,
        schedule: 'daily',
        storage_region: 'sg',
        selected_data: { modules: ['Leads'] },
        is_active: true,
        crm_connections: { connect: { connection_id: connection.connection_id } },
      },
    });
    console.log('[Seed] Created backup job:', job.job_name);
  } else {
    console.log('[Seed] Backup job already exists:', job.job_name);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('[Seed] Done');
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

