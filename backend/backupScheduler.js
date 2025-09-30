// File: backupScheduler.js
const axios = require('axios');
const prisma = require('./prisma');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const FormData = require('form-data');

// API versions (configurable via env)
// Default to v8 endpoints per latest Zoho CRM API docs
const API_VER = process.env.ZOHO_API_VERSION || 'v8';
const UPLOAD_VER = process.env.ZOHO_UPLOAD_API_VERSION || 'v8';
const BULK_VER = process.env.ZOHO_BULK_VERSION || 'v8';
const RESTORE_OPERATION = (process.env.ZOHO_RESTORE_OPERATION || 'upsert').toLowerCase(); // 'upsert' or 'insert'

const getZohoAccessToken = async (refreshToken) => {
  const ZOHO_TOKEN_URL = process.env.ZOHO_TOKEN_URL || 'https://accounts.zoho.com/oauth/v2/token';
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  const response = await axios.post(ZOHO_TOKEN_URL, params);
  return response.data.access_token;
};

// ---- Logging helpers (do not print secrets) ----
const jsonPreview = (obj, max = 600) => {
  try {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return s.length > max ? s.slice(0, max) + ' …(truncated)' : s;
  } catch {
    return String(obj);
  }
};

const logAxiosError = (err, ctx = {}) => {
  const status = err?.response?.status;
  const statusText = err?.response?.statusText;
  const data = err?.response?.data;
  const code = err?.code || err?.response?.data?.code;
  const message = err?.message || err?.response?.data?.message;
  console.error('[HTTP ERROR]', {
    context: ctx,
    code,
    status,
    statusText,
    message,
    data: jsonPreview(data),
  });
};

// Fetch organization ID (X-CRM-ORG) from Zoho API v8 using current token
const fetchZohoOrgId = async (apiDomain, accessToken) => {
  try {
    const url = `${apiDomain}/crm/v8/org`;
    const headers = { Authorization: `Zoho-oauthtoken ${accessToken}` };
    const res = await axios.get(url, { headers });
    // Zoho docs show response objects can vary; try common shapes
    const org = res.data?.org?.[0] || res.data?.organizations?.[0] || res.data?.data?.[0] || null;
    const orgId = org?.id || org?.organization_id || org?.org_id || null;
    if (!orgId) {
      console.warn('[Restore] fetchZohoOrgId: could not find org id in response shape', res.data);
    } else {
      console.log('[Restore] fetchZohoOrgId: org id =', orgId);
    }
    return orgId;
  } catch (e) {
    console.error('[Restore] fetchZohoOrgId failed:', e?.response?.data || e?.message || String(e));
    return null;
  }
};

const uploadCsvToZoho = async (apiDomain, accessToken, buffer, filename, orgId) => {
  const isV8 = String(UPLOAD_VER).startsWith('v8');
  const url = isV8
    ? `${apiDomain}/crm/bulk/${UPLOAD_VER}/upload`
    : `${apiDomain}/crm/${UPLOAD_VER}/upload`;
  const form = new FormData();
  form.append('file', buffer, { filename });
  // For v8 bulk upload endpoint, 'feature' parameter is not required.
  // Keep 'type' for clarity of content.
  if (!isV8) {
    form.append('feature', 'bulk-write');
  }
  form.append('type', 'csv');
  const headers = {
    Authorization: `Zoho-oauthtoken ${accessToken}`,
    ...form.getHeaders(),
  };
  if (orgId) headers['X-CRM-ORG'] = orgId;
  console.log('[HTTP] Upload CSV →', {
    url,
    UPLOAD_VER,
    apiDomain,
    orgHeader: !!orgId,
    filename,
    size: buffer?.length,
    headersSent: Object.keys(headers).filter((k) => k !== 'Authorization'),
  });
  let res;
  try {
    res = await axios.post(url, form, { headers });
  } catch (e) {
    logAxiosError(e, { phase: 'upload', url, version: UPLOAD_VER });
    throw e;
  }
  console.log('[HTTP] Upload CSV ←', {
    status: res.status,
    data: jsonPreview(res.data),
  });
  if (!res.data || !res.data.data || !res.data.data[0]?.details?.file_id) {
    throw new Error(`Failed to upload file to Zoho: ${JSON.stringify(res.data)}`);
  }
  return res.data.data[0].details.file_id;
};

const createBulkWriteJob = async (apiDomain, accessToken, moduleApiName, fileId, fieldMappings, orgId, options = {}) => {
  const url = `${apiDomain}/crm/bulk/${BULK_VER}/write`;
  // Determine operation: upsert or insert
  const desiredOperation = (options.operation || RESTORE_OPERATION) === 'insert' ? 'insert' : 'upsert';
  const findBy = options.findBy || 'Email'; // sensible default for Contacts/Leads
  const body = {
    operation: desiredOperation,
    resource: [
      {
        type: moduleApiName,
        file_id: fileId,
        ignore_empty: true,
        field_mappings: fieldMappings,
      },
    ],
  };
  if (desiredOperation === 'upsert' && findBy) {
    body.resource[0].find_by = findBy;
  }
  const headers = { Authorization: `Zoho-oauthtoken ${accessToken}` };
  if (orgId) headers['X-CRM-ORG'] = orgId;
  console.log('[HTTP] Create Bulk Write →', {
    url,
    BULK_VER,
    apiDomain,
    orgHeader: !!orgId,
    module: moduleApiName,
    operation: body.operation,
    find_by: body.resource?.[0]?.find_by || null,
    fieldCount: fieldMappings?.length,
    body: jsonPreview(body, 600),
  });
  let res;
  try {
    res = await axios.post(url, body, { headers });
  } catch (e) {
    logAxiosError(e, { phase: 'createJob', url, version: BULK_VER });
    throw e;
  }
  console.log('[HTTP] Create Bulk Write ←', {
    status: res.status,
    data: jsonPreview(res.data),
  });
  if (!res.data || !res.data.data || !res.data.data[0]?.details?.id) {
    throw new Error(`Failed to create bulk write job: ${JSON.stringify(res.data)}`);
  }
  return res.data.data[0].details.id;
};

const pollBulkWriteJob = async (apiDomain, accessToken, jobId, { attempts = 30, intervalMs = 5000 } = {}, orgId) => {
  const url = `${apiDomain}/crm/bulk/${BULK_VER}/write/${jobId}`;
  const headers = { Authorization: `Zoho-oauthtoken ${accessToken}` };
  if (orgId) headers['X-CRM-ORG'] = orgId;
  for (let i = 0; i < attempts; i++) {
    let res;
    try {
      res = await axios.get(url, { headers });
    } catch (e) {
      logAxiosError(e, { phase: 'poll', url, version: BULK_VER, attempt: i + 1 });
      throw e;
    }
    const status = res.data?.data?.[0]?.state;
    if (status === 'COMPLETED' || status === 'FAILED') {
      return { status, raw: res.data };
    }
    await delay(intervalMs);
  }
  return { status: 'TIMEOUT' };
};

const getCsvHeadersFromZip = (zipPath, entryName) => {
  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry(entryName);
  if (!entry) return null;
  const content = zip.readAsText(entry);
  const firstLine = content.split(/\r?\n/)[0] || '';
  // naive CSV split (assumes no commas inside quotes)
  const raw = firstLine
    .split(',')
    .map((h) => h.trim().replace(/^"|"$/g, ''))
    .filter((h) => h.length > 0);
  // Normalize headers to Zoho-style API names (e.g., "First Name" -> "First_Name")
  const normalized = raw.map((h) => h.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '_'));
  return normalized;
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
    // logEntry = await prisma.job_history.create({
    //   data: {
    //     job_id: job.job_id,
    //     status: 'in_progress',
    //     start_time: startTime,
    //     details: 'Backup process has started...',
    //   },
    // });

    // if (!connection.api_domain) throw new Error(`API Domain is missing.`);

    // const accessToken = await getZohoAccessToken(connection.encrypted_refresh_token);
    // const config = { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } };

    // const ZOHO_BACKUP_API_URL = `${connection.api_domain}/crm/bulk/v8/backup`;
    // const backupResponse = await axios.post(ZOHO_BACKUP_API_URL, {}, config);
    // const backupDetails = backupResponse.data.data[0].details;
    // const backupJobId = backupDetails.id;

    // let jobStatus = '';
    // let downloadLink = null;
    // const ZOHO_STATUS_CHECK_URL = `${connection.api_domain}/crm/bulk/v8/backup/${backupJobId}`;
    
    // for (let i = 0; i < 30; i++) {
    //   const statusResponse = await axios.get(ZOHO_STATUS_CHECK_URL, config);
    //   jobStatus = statusResponse.data.data[0].status;
    //   if (jobStatus === 'COMPLETED') {
    //     downloadLink = statusResponse.data.data[0].links[0].href;
    //     break;
    //   }
    //   if (jobStatus === 'FAILED') throw new Error('Zoho reported that the backup job failed.');
    //   await delay(60000);
    // }

    // if (!downloadLink) throw new Error('Backup job timed out.');

  //   const backupFilePath = path.join(__dirname, 'backups', `${backupJobId}.zip`);
  //   if (!fs.existsSync(path.join(__dirname, 'backups'))) {
  //       fs.mkdirSync(path.join(__dirname, 'backups'));
  //   }
    
  //   const writer = fs.createWriteStream(backupFilePath);
  //   const downloadResponse = await axios({ method: 'get', url: downloadLink, responseType: 'stream' });
  //   downloadResponse.data.pipe(writer);
  //   await new Promise((resolve, reject) => {
  //       writer.on('finish', resolve);
  //       writer.on('error', reject);
  //   });

  //   await prisma.job_history.update({
  //     where: { log_id: logEntry.log_id },
  //     data: {
  //       status: 'success',
  //       end_time: new Date(),
  //       details: `Backup completed and file saved to ${backupFilePath}`,
  //     },
  //   });
  //   console.log(`[Scheduler] Successfully logged success for job: ${job.job_name}`);

  // } catch (error) {
  //   const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
  //   if (logEntry) {
  //       await prisma.job_history.update({
  //         where: { log_id: logEntry.log_id },
  //         data: {
  //           status: 'failed',
  //           end_time: new Date(),
  //           details: `Error: ${errorMessage}`,
  //         },
  //       });
  //   }
  //   console.error(`[Scheduler] Failed to run job ${job.job_name}:`, errorMessage);
  // }

  
  // 1. Buat entri log 'in_progress' (ini tetap sama)
    logEntry = await prisma.job_history.create({
      data: {
        job_id: job.job_id,
        status: 'in_progress',
        start_time: startTime,
        details: 'Local test backup process has started...',
      },
    });

  console.log('[Scheduler] Simulating backup process using local sample file.');
    await delay(5000); // Tambahkan jeda 5 detik untuk mensimulasikan proses

    const sourceFilePath = path.join(__dirname, 'sample_data', 'sample_backup.zip');
    const destinationFolder = path.join(__dirname, 'backups');
    const destinationFilePath = path.join(destinationFolder, `sample_backup_${job.job_id}.zip`);
    
    if (!fs.existsSync(sourceFilePath)) {
        throw new Error('File sample_backup.zip tidak ditemukan di folder sample_data.');
    }
    if (!fs.existsSync(destinationFolder)) {
        fs.mkdirSync(destinationFolder);
    }
    
    // Salin file sampel ke folder tujuan
    fs.copyFileSync(sourceFilePath, destinationFilePath);
    console.log(`[Scheduler] Sample file copied to ${destinationFilePath}`);
    // --- AKHIR DARI BAGIAN PENGUJIAN LOKAL ---

    // 2. Perbarui entri log menjadi 'success' (ini tetap sama)
    await prisma.job_history.update({
      where: { log_id: logEntry.log_id },
      data: {
        status: 'success',
        end_time: new Date(),
        // Simpan details sebagai JSON agar mudah diparse saat restore
        details: JSON.stringify({ message: 'Local test backup completed', file_path: destinationFilePath }),
      },
    });
    console.log(`[Scheduler] Successfully logged success for job: ${job.job_name}`);

  } catch (error) {
    // 3. Tangani error dan perbarui log menjadi 'failed' (ini tetap sama)
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

const extractBackupPath = (details, jobId) => {
  // Strategy 1: JSON parse
  try {
    const parsed = typeof details === 'string' ? JSON.parse(details) : null;
    if (parsed?.file_path && typeof parsed.file_path === 'string') {
      console.log('[Restore] Parsed file_path from JSON details:', parsed.file_path);
      return parsed.file_path;
    }
  } catch (e) {
    console.log('[Restore] Details is not JSON. Will try regex fallback.');
  }
  // Strategy 2: Regex fallback for legacy string
  if (typeof details === 'string') {
    const m = details.match(/File saved to (.+)$/);
    if (m && m[1]) {
      console.log('[Restore] Extracted file path via regex fallback:', m[1]);
      return m[1];
    }
  }
  // Strategy 3: Guess default path (for local simulator)
  const guess = path.join(__dirname, 'backups', `sample_backup_${jobId}.zip`);
  if (fs.existsSync(guess)) {
    console.log('[Restore] Guessed backup path exists:', guess);
    return guess;
  }
  console.warn('[Restore] Could not determine backup file path from details.');
  return undefined;
};

// Restore job dari backup terakhir yang sukses (Zoho Bulk Write API)
const runRestoreJob = async (job) => {
  const connection = job.crm_connections;
  if (!connection) {
    console.error(`[Scheduler] Connection data is missing for job: ${job.job_name}`);
    return;
  }

  console.log(`[Scheduler] Starting restore for job: ${job.job_name} (ID: ${job.job_id})`);

  // Cari log sukses terbaru untuk job ini
  const latestSuccess = await prisma.job_history.findFirst({
    where: { job_id: job.job_id, status: 'success' },
    orderBy: { start_time: 'desc' },
  });
  if (!latestSuccess || typeof latestSuccess.details !== 'string') {
    console.error('[Scheduler] No successful backup found to restore from.');
    return;
  }
  console.log('[Restore] Latest success log_id:', latestSuccess.log_id);
  console.log('[Restore] Latest success details preview:', String(latestSuccess.details).slice(0, 160));

  const src = extractBackupPath(latestSuccess.details, job.job_id);
  if (!src || !fs.existsSync(src)) {
    console.error('[Scheduler] Backup file path is invalid or missing:', src);
    return;
  }

  const startTime = new Date();
  let logEntry;
  try {
    logEntry = await prisma.job_history.create({
      data: {
        job_id: job.job_id,
        status: 'in_progress',
        start_time: startTime,
        details: `Restore process has started from ${src}`,
      },
    });

    console.log('[Restore] Using connection:', { connection_id: connection.connection_id, api_domain: connection.api_domain, crm_type: connection.crm_type });
    console.log('[Restore] API versions:', { API_VER, UPLOAD_VER, BULK_VER, RESTORE_OPERATION });
    if (!connection.api_domain) throw new Error('Missing api_domain in connection. Re-authenticate required.');
    const accessToken = await getZohoAccessToken(connection.encrypted_refresh_token);
    console.log('[Restore] Obtained access token (masked):', accessToken ? 'OK' : 'FAILED');
    const envOrg = process.env.ZOHO_ORG_ID || null;
    const orgId = envOrg || (await fetchZohoOrgId(connection.api_domain, accessToken));
    console.log('[Restore] Using orgId:', orgId || '(none)');

    const modules = Array.isArray(job.selected_data?.modules) ? job.selected_data.modules : [];
    console.log('[Restore] Selected modules from job:', modules);
    if (modules.length === 0) {
      throw new Error('No modules specified in selected_data to restore.');
    }

    const restoreResults = [];
    for (const moduleApiName of modules) {
      console.log(`[Restore] Processing module: ${moduleApiName}`);
      // Determine CSV entry name inside the zip, e.g., Leads.csv or Contacts.csv
      const candidates = [
        `${moduleApiName}.csv`,
        `${moduleApiName}.CSV`,
        `${moduleApiName.toLowerCase()}.csv`,
      ];
      let entryName = null;
      let headers = null;
      for (const name of candidates) {
        headers = getCsvHeadersFromZip(src, name);
        if (headers && headers.length > 0) { entryName = name; break; }
      }
      if (!entryName) {
        console.warn('[Restore] No CSV entry found in zip for module:', moduleApiName, 'candidates:', candidates);
        restoreResults.push({ module: moduleApiName, status: 'SKIPPED_NO_FILE' });
        continue;
      }
      console.log('[Restore] Found CSV entry:', entryName, 'headers:', headers);
      // Read raw buffer for upload
      const zip = new AdmZip(src);
      const entry = zip.getEntry(entryName);
      const buffer = zip.readFile(entry);
      if (!buffer) {
        console.error('[Restore] Failed to read CSV buffer for entry:', entryName);
        restoreResults.push({ module: moduleApiName, status: 'FAILED_READ' });
        continue;
      }

      // Upload CSV to Zoho to get file_id
      let fileId;
      try {
        fileId = await uploadCsvToZoho(connection.api_domain, accessToken, buffer, entryName, orgId);
        console.log('[Restore] Uploaded CSV, received file_id:', fileId);
      } catch (e) {
        const errMsg = e?.response?.data ? JSON.stringify(e.response.data) : String(e.message || e);
        console.error('[Restore] Upload CSV failed:', errMsg);
        restoreResults.push({ module: moduleApiName, status: 'FAILED_UPLOAD', error: errMsg });
        continue;
      }

      // Build field mappings based on headers order
      // Filter out ID-like columns to avoid insert errors (e.g., Lead_ID, Contact_ID)
      const filteredHeaders = headers.filter((h) => !/^id$/i.test(h) && !/_id$/i.test(h));
      const fieldMappings = filteredHeaders.map((h, idx) => ({ api_name: h, index: idx }));
      // Decide operation and find_by dynamically
      let operation = RESTORE_OPERATION;
      let findBy = 'Email';
      if (!filteredHeaders.includes('Email')) {
        // try common alternates or fallback to insert
        if (filteredHeaders.includes('Company_Email')) findBy = 'Company_Email';
        else if (filteredHeaders.includes('Work_Email')) findBy = 'Work_Email';
        else operation = 'insert';
      }
      console.log('[Restore] Job operation:', operation, 'find_by:', operation === 'upsert' ? findBy : '(n/a)');

      // Create Bulk Write Job
      let writeJobId;
      try {
        writeJobId = await createBulkWriteJob(
          connection.api_domain,
          accessToken,
          moduleApiName,
          fileId,
          fieldMappings,
          orgId,
          { operation, findBy }
        );
        console.log('[Restore] Created bulk write job. jobId:', writeJobId);
      } catch (e) {
        const errMsg = e?.response?.data ? JSON.stringify(e.response.data) : String(e.message || e);
        console.error('[Restore] Create bulk write job failed:', errMsg);
        restoreResults.push({ module: moduleApiName, status: 'FAILED_CREATE_JOB', error: errMsg });
        continue;
      }

      // Poll until completed/failed
      try {
        const result = await pollBulkWriteJob(connection.api_domain, accessToken, writeJobId, { attempts: 30, intervalMs: 5000 }, orgId);
        console.log('[Restore] Bulk write result:', { module: moduleApiName, status: result.status });
        restoreResults.push({ module: moduleApiName, jobId: writeJobId, status: result.status });
      } catch (e) {
        const errMsg = e?.response?.data ? JSON.stringify(e.response.data) : String(e.message || e);
        console.error('[Restore] Polling bulk write job failed:', errMsg);
        restoreResults.push({ module: moduleApiName, jobId: writeJobId, status: 'FAILED_POLL', error: errMsg });
      }
    }

    const allOk = restoreResults.every((r) => r.status === 'COMPLETED' || r.status === 'SKIPPED_NO_FILE');
    await prisma.job_history.update({
      where: { log_id: logEntry.log_id },
      data: {
        status: allOk ? 'success' : 'failed',
        end_time: new Date(),
        details: `Restore results: ${JSON.stringify(restoreResults)}`,
      },
    });
    console.log(`[Scheduler] Restore finished for job: ${job.job_name}`, restoreResults);
  } catch (error) {
    const errorMessage = error?.response?.data ? JSON.stringify(error.response.data) : (error?.message || String(error));
    if (logEntry) {
      await prisma.job_history.update({
        where: { log_id: logEntry.log_id },
        data: {
          status: 'failed',
          end_time: new Date(),
          details: `Restore error: ${errorMessage}`,
        },
      });
    }
    console.error(`[Scheduler] Failed to restore job ${job.job_name}:`, errorMessage);
  }
};

// Sementara: fungsi pembatalan belum diimplementasikan secara penuh.
// Dibuat noop agar pemanggilan API cancel tidak menyebabkan crash.
const cancelBackupJob = async (_jobId) => {
  console.warn('[Scheduler] cancelBackupJob is not implemented. Received jobId:', _jobId);
  return;
};

module.exports = { startScheduler, runAllActiveJobs, runBackupJob, cancelBackupJob, runRestoreJob };
