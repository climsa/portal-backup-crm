// File: backupScheduler.js
// Tujuan: Menjalankan tugas backup secara otomatis sesuai jadwal.

const axios = require('axios');
const db = require('./db');
const cron = require('node-cron');

// Fungsi bantuan untuk mendapatkan access token baru dari refresh token
const getZohoAccessToken = async (refreshToken) => {
  const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  const response = await axios.post(ZOHO_TOKEN_URL, params);
  return response.data.access_token;
};

const runBackupJob = async (job) => {
  console.log(`[Scheduler] Starting backup job: ${job.job_name} (ID: ${job.job_id})`);
  const startTime = new Date();
  
  try {
    // 1. Dapatkan detail koneksi, TERMASUK api_domain
    const connRes = await db.query("SELECT * FROM crm_connections WHERE connection_id = $1", [job.connection_id]);
    if (connRes.rows.length === 0) {
      throw new Error(`Connection not found for job ${job.job_id}`);
    }
    const connection = connRes.rows[0];

    // Pastikan koneksi memiliki api_domain
    if (!connection.api_domain) {
        throw new Error(`API Domain is missing for connection ${connection.connection_id}. Please re-authenticate.`);
    }

    // 2. Dapatkan access token baru
    const accessToken = await getZohoAccessToken(connection.encrypted_refresh_token);

    // 3. Panggil Zoho Data Backup API menggunakan api_domain dari database
    const ZOHO_BACKUP_API_URL = `${connection.api_domain}/crm/bulk/v8/backup`;
    const config = {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    };
    
    console.log(`[DEBUG] Making POST request to: ${ZOHO_BACKUP_API_URL}`);
    
    const backupResponse = await axios.post(ZOHO_BACKUP_API_URL, {}, config);
    
    const backupDetails = backupResponse.data.data[0].details;
    console.log(`[Scheduler] Zoho backup initiated successfully. Details:`, backupDetails);

    const endTime = new Date();
    await db.query(
      "INSERT INTO job_history (job_id, status, start_time, end_time, details) VALUES ($1, $2, $3, $4, $5)",
      [job.job_id, 'success', startTime, endTime, `Backup initiated. Job ID: ${backupDetails.id}`]
    );
    console.log(`[Scheduler] Successfully logged success for job: ${job.job_name}`);

  } catch (error) {
    const endTime = new Date();
    const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
    await db.query(
      "INSERT INTO job_history (job_id, status, start_time, end_time, details) VALUES ($1, $2, $3, $4, $5)",
      [job.job_id, 'failed', startTime, endTime, `Error: ${errorMessage}`]
    );
    console.error(`[Scheduler] Failed to run job ${job.job_name}:`, errorMessage);
  }
};

// ... (sisa kode tetap sama) ...
const runAllActiveJobs = async () => {
    console.log('[Manual Trigger] Running backup check for all active jobs...');
    const { rows: allJobsToRun } = await db.query("SELECT * FROM backup_jobs WHERE is_active = true");
    console.log(`[Manual Trigger] Found ${allJobsToRun.length} jobs to run.`);
    for (const job of allJobsToRun) {
      await runBackupJob(job);
    }
};
const startScheduler = () => {
  cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduler] Running daily backup check...');
    const { rows: dailyJobs } = await db.query("SELECT * FROM backup_jobs WHERE schedule = 'daily' AND is_active = true");
    const today = new Date();
    let weeklyJobs = [];
    if (today.getDay() === 0) {
        const { rows } = await db.query("SELECT * FROM backup_jobs WHERE schedule = 'weekly' AND is_active = true");
        weeklyJobs = rows;
    }
    const allJobsToRun = [...dailyJobs, ...weeklyJobs];
    for (const job of allJobsToRun) {
      await runBackupJob(job);
    }
  });
  console.log('Backup scheduler has been started. Will run every day at 2:00 AM.');
};
module.exports = { startScheduler, runAllActiveJobs, runBackupJob };
