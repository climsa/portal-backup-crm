// File: routes/backups.js
const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const fs = require('fs');

/**
 * @route   GET /api/backups/:log_id/download
 * @desc    Mengunduh file backup yang terkait dengan log riwayat
 * @access  Private
 */
router.get('/:log_id/download', auth, async (req, res) => {
  try {
    const { log_id } = req.params;

    // 1. Temukan entri log di database
    const logEntry = await prisma.job_history.findUnique({
      where: { log_id: parseInt(log_id) },
    });

    // 2. Validasi entri log
    if (!logEntry || logEntry.status !== 'success') {
      return res.status(404).json({ msg: 'Backup record not found or was not successful.' });
    }

    // 3. Ekstrak path file dari detail log
    // Ini mengasumsikan format detailnya adalah ".... File saved to /path/to/file.zip"
    const filePathString = logEntry.details.split('File saved to ')[1];
    if (!filePathString) {
      return res.status(500).json({ msg: 'File path could not be determined from log details.' });
    }

    // 4. Periksa apakah file benar-benar ada di server
    if (!fs.existsSync(filePathString)) {
      console.error(`File not found at path: ${filePathString}`);
      return res.status(404).json({ msg: 'Backup file not found on the server.' });
    }

    // 5. Kirim file untuk diunduh oleh browser
    res.download(filePathString);

  } catch (err) {
    console.error('Error during file download:', err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
