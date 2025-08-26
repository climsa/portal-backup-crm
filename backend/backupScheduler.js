// File: backupScheduler.js
const axios = require('axios');
const prisma = require('./prisma');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

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

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const runBackupJob = async (job) => {
  // PERBAIKAN: Akses koneksi melalui job.crm_connections
  const connection = job.crm_connections;
  if (!connection) {
    console.error(`[Scheduler] Connection data is missing for job: ${job.job_name}`);
    return;
  }

  console.log(`[Scheduler] Starting backup job: ${job.job_name} (ID: ${job.job_id})`);
  const startTime = new Date();
  let logEntry;

  try {
    logEntry = await prisma.job_history.create({
      data: {
        job_id: job.job_id,
        status: 'in_progress',
        start_time: startTime,
        details: 'Backup process has started...',
      },
    });

    if (!connection.api_domain) throw new Error(`API Domain is missing.`);

    const accessToken = await getZohoAccessToken(connection.encrypted_refresh_token);
    const config = { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } };

    const ZOHO_BACKUP_API_URL = `${connection.api_domain}/crm/bulk/v8/backup`;
    const backupResponse = await axios.post(ZOHO_BACKUP_API_URL, {}, config);
    const backupDetails = backupResponse.data.data[0].details;
    const backupJobId = backupDetails.id;

    let jobStatus = '';
    let downloadLink = null;
    const ZOHO_STATUS_CHECK_URL = `${connection.api_domain}/crm/bulk/v8/backup/${backupJobId}`;
    
    for (let i = 0; i < 30; i++) {
      const statusResponse = await axios.get(ZOHO_STATUS_CHECK_URL, config);
      jobStatus = statusResponse.data.data[0].status;
      if (jobStatus === 'COMPLETED') {
        downloadLink = statusResponse.data.data[0].links[0].href;
        break;
      }
      if (jobStatus === 'FAILED') throw new Error('Zoho reported that the backup job failed.');
      await delay(60000);
    }

    if (!downloadLink) throw new Error('Backup job timed out.');

    const backupFilePath = path.join(__dirname, 'backups', `${backupJobId}.zip`);
    if (!fs.existsSync(path.join(__dirname, 'backups'))) {
        fs.mkdirSync(path.join(__dirname, 'backups'));
    }
    
    const writer = fs.createWriteStream(backupFilePath);
    const downloadResponse = await axios({ method: 'get', url: downloadLink, responseType: 'stream' });
    downloadResponse.data.pipe(writer);
    await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });

    await prisma.job_history.update({
      where: { log_id: logEntry.log_id },
      data: {
        status: 'success',
        end_time: new Date(),
        details: `Backup completed and file saved to ${backupFilePath}`,
      },
    });
    console.log(`[Scheduler] Successfully logged success for job: ${job.job_name}`);

  } catch (error) {
    const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
    if (logEntry) {
        await prisma.job_history.update({
          where: { log_id: logEntry.log_id },
          data: {
            status: 'failed',
            end_time: new Date(),
            details: `Error: ${errorMessage}`,
          },
        });
    }
    console.error(`[Scheduler] Failed to run job ${job.job_name}:`, errorMessage);
  }
};

const runAllActiveJobs = async () => {
    // PERBAIKAN: Ubah 'connection' menjadi 'crm_connections'
    const allJobsToRun = await prisma.backup_jobs.findMany({
        where: { is_active: true, deleted_at: null },
        include: { crm_connections: true },
    });
    console.log(`[Manual Trigger] Found ${allJobsToRun.length} jobs to run.`);
    for (const job of allJobsToRun) {
      await runBackupJob(job);
    }
};

const startScheduler = () => {
  cron.schedule('0 2 * * *', async () => {
    const dailyJobs = await prisma.backup_jobs.findMany({ 
        where: { schedule: 'daily', is_active: true, deleted_at: null },
        include: { crm_connections: true }
    });
    const today = new Date();
    let weeklyJobs = [];
    if (today.getDay() === 0) {
        weeklyJobs = await prisma.backup_jobs.findMany({ 
            where: { schedule: 'weekly', is_active: true, deleted_at: null },
            include: { crm_connections: true }
        });
    }
    const allJobsToRun = [...dailyJobs, ...weeklyJobs];
    for (const job of allJobsToRun) {
      await runBackupJob(job);
    }
  });
  console.log('Backup scheduler has been started.');
};

module.exports = { startScheduler, runAllActiveJobs, runBackupJob };
