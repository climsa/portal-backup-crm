// File: routes/backupJobs.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { runBackupJob } = require('../backupScheduler'); // Impor fungsi backup

// GET /api/jobs/:id - Mengambil detail satu tugas backup
router.get('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await db.query("SELECT * FROM backup_jobs WHERE job_id = $1", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ msg: 'Tugas backup tidak ditemukan' });
        }
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// PUT /api/jobs/:id - Memperbarui konfigurasi tugas backup (TERMASUK START/STOP)
router.put('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { job_name, schedule, is_active } = req.body;

        if (job_name === undefined || schedule === undefined || is_active === undefined) {
            return res.status(400).json({ msg: 'Harap sediakan job_name, schedule, dan is_active.' });
        }

        const updatedJob = await db.query(
            "UPDATE backup_jobs SET job_name = $1, schedule = $2, is_active = $3 WHERE job_id = $4 RETURNING *",
            [job_name, schedule, is_active, id]
        );

        if (updatedJob.rows.length === 0) {
            return res.status(404).json({ msg: 'Tugas backup tidak ditemukan' });
        }

        res.status(200).json(updatedJob.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// DELETE /api/jobs/:id - Menghapus sebuah tugas backup
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const deleteOp = await db.query("DELETE FROM backup_jobs WHERE job_id = $1", [id]);
    if (deleteOp.rowCount === 0) {
      return res.status(404).json({ msg: 'Tugas backup tidak ditemukan' });
    }
    res.status(200).json({ msg: 'Tugas backup berhasil dihapus' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

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
