// File: routes/jobHistory.js
const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ msg: 'Parameter jobId diperlukan.' });
  }
  try {
    const history = await prisma.job_history.findMany({
      where: { job_id: jobId },
      orderBy: { start_time: 'desc' },
    });
    res.status(200).json(history);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   GET /api/history/latest-statuses
 * @desc    Mengambil HANYA status riwayat terbaru untuk SEMUA pekerjaan milik klien.
 * @desc    Dioptimalkan untuk pemuatan dasbor.
 * @access  Private
 */
router.get('/latest-statuses', auth, async (req, res) => {
  try {
    const { id: clientId } = req.client;

    // 1. Temukan semua ID pekerjaan yang dimiliki oleh klien ini
    const jobs = await prisma.backup_jobs.findMany({
      where: {
        crm_connections: { client_id: clientId },
        deleted_at: null,
      },
      select: { job_id: true },
    });
    const jobIds = jobs.map(job => job.job_id);

    if (jobIds.length === 0) {
      return res.status(200).json([]);
    }

    // 2. Ambil entri log terbaru untuk setiap pekerjaan
    // Prisma's `distinct` pada `job_id` setelah `orderBy` akan mengambil baris pertama (terbaru) untuk setiap job_id
    const latestLogs = await prisma.job_history.findMany({
      where: {
        job_id: { in: jobIds },
      },
      orderBy: {
        start_time: 'desc',
      },
      distinct: ['job_id'],
    });
    
    res.status(200).json(latestLogs);
  } catch (err) {
    console.error('Error fetching latest job statuses:', err);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   GET /api/history/:jobId
 * @desc    Mengambil riwayat LENGKAP untuk SATU pekerjaan backup spesifik.
 * @desc    Digunakan oleh modal JobHistory.
 * @access  Private
 */
router.get('/:jobId', auth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { id: clientId } = req.client;

    // Validasi bahwa pekerjaan ini milik klien
    const job = await prisma.backup_jobs.findFirst({
      where: {
        job_id: jobId,
        crm_connections: { client_id: clientId },
      },
    });

    if (!job) {
      return res.status(404).json({ msg: 'Job not found.' });
    }

    const history = await prisma.job_history.findMany({
      where: { job_id: jobId },
      orderBy: { start_time: 'desc' },
    });

    res.status(200).json(history);
  } catch (err) {
    console.error('Error fetching job history:', err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;

