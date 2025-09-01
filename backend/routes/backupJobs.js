// File: routes/backupJobs.js (Diperbaiki)
const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const { runBackupJob, cancelBackupJob } = require('../backupScheduler');

/**
 * Mengambil semua pekerjaan backup milik klien yang sedang login.
 * clientId diambil dari token otentikasi.
 */
router.get('/', auth, async (req, res) => {
  const clientId = req.client.id; // Menggunakan clientId dari token

  try {
    const jobs = await prisma.backup_jobs.findMany({
      where: {
        crm_connections: { // Memfilter berdasarkan relasi ke crm_connections
          client_id: clientId,
        },
        deleted_at: null, // Hanya ambil yang tidak di-soft delete
      },
      orderBy: {
        created_at: 'desc',
      },
    });
    res.status(200).json(jobs);
  } catch (error) {
    console.error('[API] Error fetching backup jobs:', error);
    res.status(500).send('Server Error');
  }
});

/**
 * Membuat pekerjaan backup baru.
 */
router.post('/', auth, async (req, res) => {
    // ... (sisa kode tidak berubah)
    const { connection_id, job_name, schedule, metadata } = req.body;
    try {
        const newJob = await prisma.backup_jobs.create({
            data: {
                connection_id,
                job_name,
                schedule,
                metadata: metadata || {},
                is_active: true,
            },
        });
        res.status(201).json(newJob);
    } catch (error) {
        console.error('[API] Error creating backup job:', error);
        res.status(500).send('Server Error');
    }
});


/**
 * Mengambil detail satu pekerjaan backup.
 */
router.get('/:id', auth, async (req, res) => {
    // ... (sisa kode tidak berubah)
    const { id } = req.params;
    try {
        const job = await prisma.backup_jobs.findUnique({
            where: { job_id: id },
        });
        if (!job) {
            return res.status(404).json({ msg: 'Job not found' });
        }
        res.status(200).json(job);
    } catch (error) {
        console.error(`[API] Error fetching job ${id}:`, error);
        res.status(500).send('Server Error');
    }
});

/**
 * Memperbarui pekerjaan backup (nama, jadwal, status aktif).
 */
router.put('/:id', auth, async (req, res) => {
    // ... (sisa kode tidak berubah)
    const { id } = req.params;
    const { job_name, schedule, is_active } = req.body;
    try {
        const updatedJob = await prisma.backup_jobs.update({
            where: { job_id: id },
            data: {
                job_name,
                schedule,
                is_active,
            },
        });
        res.status(200).json(updatedJob);
    } catch (error) {
        console.error(`[API] Error updating job ${id}:`, error);
        res.status(500).send('Server Error');
    }
});

/**
 * Melakukan soft delete pada pekerjaan backup.
 */
router.delete('/:id', auth, async (req, res) => {
    // ... (sisa kode tidak berubah)
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

// --- Rute Aksi ---

/**
 * Memicu pekerjaan backup untuk berjalan sekarang.
 */
router.post('/:id/run', auth, async (req, res) => {
    // ... (sisa kode tidak berubah)
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
        runBackupJob(jobToRun); // Tidak perlu await karena ini proses asinkron
        
        res.status(202).json({ msg: 'Backup job has been triggered.' });
    } catch (error) {
        console.error(`[API] CRITICAL ERROR in /jobs/:id/run:`, error);
        res.status(500).json({ msg: 'Failed to trigger backup job.' });
    }
});

/**
 * Membatalkan pekerjaan backup yang sedang berjalan.
 */
router.post('/:id/cancel', auth, async (req, res) => {
    // ... (sisa kode tidak berubah)
    const { id } = req.params;
    try {
        await cancelBackupJob(id);
        res.status(200).json({ msg: 'Job cancellation has been requested.' });
    } catch (error) {
        console.error(`[API] Error cancelling job ${id}:`, error);
        res.status(500).send('Server Error');
    }
});

/**
 * Memicu ulang pekerjaan yang gagal.
 */
router.post('/:id/retry', auth, async (req, res) => {
    // ... (sisa kode tidak berubah)
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

module.exports = router;

