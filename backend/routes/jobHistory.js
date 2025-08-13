// File: routes/jobHistory.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ msg: 'Parameter jobId diperlukan.' });
  }
  try {
    const { rows } = await db.query(
      "SELECT * FROM job_history WHERE job_id = $1 ORDER BY start_time DESC",
      [jobId]
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
