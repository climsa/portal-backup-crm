// File: server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { startScheduler, runAllActiveJobs } = require('./backupScheduler');

const app = express();

// Init Middleware
app.use(cors());
app.use(express.json({ extended: false }));

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/connections', require('./routes/crmConnections'));
app.use('/api/jobs', require('./routes/backupJobs'));
app.use('/api/history', require('./routes/jobHistory'));
app.use('/api/zoho', require('./routes/zoho'));
app.use('/api/backups', require('./routes/backups')); // Tambahkan rute baru ini

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server backend berjalan di http://localhost:${PORT}`);
  // Jalankan penjadwal
  // startScheduler();
  // Pemicu awal untuk pengujian (bisa di-comment out)
  // console.log('Triggering initial backup run for testing...');
  // runAllActiveJobs();
});

// Koneksi ke DB
const prisma = require('./prisma');
prisma.$connect()
  .then(() => {
    console.log(`Successfully connected to PostgreSQL database at: ${new Date().toISOString()}`);
  })
  .catch((e) => {
    console.error('Failed to connect to the database', e);
    process.exit(1);
  });

