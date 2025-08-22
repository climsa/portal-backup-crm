// File: routes/backupJobs.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { runBackupJob } = require('../backupScheduler'); // Impor fungsi backup

// ... (semua endpoint lain tetap sama) ...
router.post('/', auth, async (req, res) => {
  const { connection_id, job_name, schedule, storage_region, selected_data } = req.body;
  if (!connection_id || !job_name || !schedule || !storage_region) {
    return res.status(400).json({ msg: 'Harap sediakan semua field yang diperlukan.' });
  }
  try {
    const newJob = await db.query(
      "INSERT INTO backup_jobs (connection_id, job_name, schedule, storage_region, selected_data) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [connection_id, job_name, schedule, storage_region, selected_data || null]
    );
    res.status(201).json(newJob.rows[0]);
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
    const { rows } = await db.query("SELECT * FROM backup_jobs WHERE connection_id = $1 ORDER BY created_at DESC", [connectionId]);
    res.status(200).json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


// === ENDPOINT BARU UNTUK MEMICU BACKUP ===

/**
 * @route   POST /api/jobs/:id/run
 * @desc    Memicu eksekusi pekerjaan backup secara manual
 * @access  Private
 */
router.post('/:id/run', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query("SELECT * FROM backup_jobs WHERE job_id = $1", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ msg: 'Pekerjaan backup tidak ditemukan' });
    }

    const jobToRun = rows[0];

    // Panggil fungsi backup (jangan tunggu selesai karena berjalan di latar belakang)
    runBackupJob(jobToRun);

    res.status(202).json({ msg: `Backup job '${jobToRun.job_name}' has been triggered successfully. Check server logs for progress.` });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
