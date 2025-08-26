// File: routes/backupJobs.js
const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const { runBackupJob } = require('../backupScheduler');

// ... (Endpoint POST, GET, PUT, DELETE, CANCEL tetap sama) ...
router.post('/', auth, async (req, res) => {
  const { connection_id, job_name, schedule, storage_region, selected_data } = req.body;
  if (!connection_id || !job_name || !schedule || !storage_region) {
    return res.status(400).json({ msg: 'Harap sediakan semua field yang diperlukan.' });
  }
  try {
    const newJob = await prisma.backup_jobs.create({
      data: {
        connection_id,
        job_name,
        schedule,
        storage_region,
        selected_data: selected_data || {},
      },
    });
    res.status(201).json(newJob);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
router.get('/', auth, async (req, res) => {
  const { connectionId } = req.query;
  if (!connectionId) {
    return res.status(400).json({ msg: 'Parameter connectionId diperlukan.' });
  }
  try {
    const jobs = await prisma.backup_jobs.findMany({
      where: {
        connection_id: connectionId,
        deleted_at: null,
      },
      orderBy: { created_at: 'desc' },
    });
    res.status(200).json(jobs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { job_name, schedule, is_active } = req.body;
    if (job_name === undefined || schedule === undefined || is_active === undefined) {
      return res.status(400).json({ msg: 'Harap sediakan job_name, schedule, dan is_active.' });
    }
    const updatedJob = await prisma.backup_jobs.update({
      where: { job_id: id },
      data: { job_name, schedule, is_active },
    });
    res.status(200).json(updatedJob);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.backup_jobs.update({
      where: { job_id: id },
      data: { deleted_at: new Date() },
    });
    res.status(200).json({ msg: 'Tugas backup berhasil dihapus' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
router.post('/:id/cancel', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const runningJob = await prisma.job_history.findFirst({
            where: {
                job_id: id,
                status: 'in_progress',
            },
            orderBy: { start_time: 'desc' },
        });
        if (!runningJob) {
            return res.status(404).json({ msg: 'Tidak ada pekerjaan yang sedang berjalan untuk dibatalkan.' });
        }
        await prisma.job_history.update({
            where: { log_id: runningJob.log_id },
            data: { status: 'cancelled', details: 'Job cancelled by user.' },
        });
        res.status(200).json({ msg: 'Permintaan pembatalan pekerjaan telah dikirim.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.post('/:id/run', auth, async (req, res) => {
  try {
    const { id } = req.params;
    // PERBAIKAN: Ubah 'connection' menjadi 'crm_connections'
    const jobToRun = await prisma.backup_jobs.findUnique({
      where: { job_id: id },
      include: { crm_connections: true },
    });

    if (!jobToRun) {
      return res.status(404).json({ msg: 'Pekerjaan backup tidak ditemukan' });
    }

    // Panggil fungsi backup (jangan tunggu selesai karena berjalan di latar belakang)
    runBackupJob(jobToRun);

    res.status(202).json({ msg: `Backup job '${jobToRun.job_name}' has been triggered successfully.` });
    
  } catch (err) {
    console.error('[API] CRITICAL ERROR in /jobs/:id/run:', err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
