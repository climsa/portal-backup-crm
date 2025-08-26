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

module.exports = router;
