// File: routes/backupJobs.js (Diperbaiki)
const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const { runBackupJob, cancelBackupJob, runRestoreJob } = require('../backupScheduler');

// Mengambil semua pekerjaan backup milik klien yang sedang login
router.get('/', auth, async (req, res) => {
  const clientId = req.client.id;
  try {
    const jobs = await prisma.backup_jobs.findMany({
      where: {
        crm_connections: {
          client_id: clientId,
        },
        deleted_at: null,
      },
      orderBy: { created_at: 'desc' },
    });
    res.status(200).json(jobs);
  } catch (error) {
    console.error('[API] Error fetching backup jobs:', error);
    res.status(500).send('Server Error');
  }
});

// Membuat pekerjaan backup baru
router.post('/', auth, async (req, res) => {
  console.log('[API] Received request to create new job. Body:', req.body);
  const { connection_id, job_name, schedule, selected_data } = req.body;
  
  try {
    if (!connection_id || !job_name || !schedule) {
        console.error('[API] Validation failed: Missing required fields.');
        return res.status(400).json({ msg: 'Connection ID, job name, and schedule are required.' });
    }

    const newJob = await prisma.backup_jobs.create({
      data: {
        job_name,
        schedule,
        // PERBAIKAN: Menggunakan `selected_data` sesuai dengan skema Prisma
        selected_data: selected_data || {},
        is_active: true,
        storage_region: 'sg',
        crm_connections: {
          connect: {
            connection_id: connection_id,
          },
        },
      },
    });
    console.log('[API] Job created successfully:', newJob);
    res.status(201).json(newJob);
  } catch (error) {
    console.error('[API] CRITICAL ERROR creating backup job:', error);
    res.status(500).send('Server Error');
  }
});

// Memperbarui pekerjaan backup
router.put('/:id', auth, async (req, res) => {
    const { id } = req.params;
    // PERBAIKAN: Menggunakan `selected_data` saat update juga
    const { job_name, schedule, is_active, selected_data } = req.body;
    try {
        const updatedJob = await prisma.backup_jobs.update({
            where: { job_id: id },
            data: {
                job_name,
                schedule,
                is_active,
                selected_data, // PERBAIKAN
            },
        });
        res.status(200).json(updatedJob);
    } catch (error) {
        console.error(`[API] Error updating job ${id}:`, error);
        res.status(500).send('Server Error');
    }
});


// Melakukan soft delete pada pekerjaan backup
router.delete('/:id', auth, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.backup_jobs.update({
            where: { job_id: id },
            data: { deleted_at: new Date() },
        });
        res.status(200).json({ msg: 'Backup job deleted successfully.' });
    } catch (error) {
        console.error(`[API] Error deleting job ${id}:`, error);
        res.status(500).send('Server Error');
    }
});

// Memicu pekerjaan backup untuk berjalan sekarang
router.post('/:id/run', auth, async (req, res) => {
    const { id } = req.params;
    console.log(`[API] Received request to run job ID: ${id}`);
    try {
        console.log('[API] Finding job in database...');
        const jobToRun = await prisma.backup_jobs.findUnique({
            where: { job_id: id },
            include: { crm_connections: true },
        });

        if (!jobToRun) {
            console.log('[API] Job not found.');
            return res.status(404).json({ msg: 'Job not found' });
        }
        
        console.log('[API] Job found, triggering backup...');
        runBackupJob(jobToRun);
        
        res.status(202).json({ msg: 'Backup job has been triggered.' });
    } catch (error) {
        console.error(`[API] CRITICAL ERROR in /jobs/:id/run:`, error);
        res.status(500).json({ msg: 'Failed to trigger backup job.' });
    }
});

// Membatalkan pekerjaan backup yang sedang berjalan
router.post('/:id/cancel', auth, async (req, res) => {
    const { id } = req.params;
    try {
        await cancelBackupJob(id);
        res.status(200).json({ msg: 'Job cancellation has been requested.' });
    } catch (error) {
        console.error(`[API] Error cancelling job ${id}:`, error);
        res.status(500).send('Server Error');
    }
});

// Memicu ulang pekerjaan yang gagal
router.post('/:id/retry', auth, async (req, res) => {
    const { id } = req.params;
    try {
        const jobToRun = await prisma.backup_jobs.findUnique({
            where: { job_id: id },
            include: { crm_connections: true },
        });

        if (!jobToRun) {
            return res.status(404).json({ msg: 'Job not found' });
        }
        
        runBackupJob(jobToRun);
        
        res.status(202).json({ msg: 'Backup job has been re-triggered.' });
    } catch (error) {
        console.error(`[API] Error retrying job ${id}:`, error);
        res.status(500).send('Server Error');
    }
});

// Memicu proses restore dari backup sukses terbaru
router.post('/:id/restore', auth, async (req, res) => {
    const { id } = req.params;
    try {
        const jobToRestore = await prisma.backup_jobs.findUnique({
            where: { job_id: id },
            include: { crm_connections: true },
        });
        if (!jobToRestore) {
            return res.status(404).json({ msg: 'Job not found' });
        }
        runRestoreJob(jobToRestore);
        res.status(202).json({ msg: 'Restore process has been triggered.' });
    } catch (error) {
        console.error(`[API] Error restoring job ${id}:`, error);
        res.status(500).send('Server Error');
    }
});


module.exports = router;
