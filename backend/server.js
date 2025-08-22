// File: server.js
// Tujuan: Titik masuk utama untuk aplikasi backend, membuat server Express,
// dan menghubungkan semua file rute.

// Impor pustaka yang diperlukan
const express = require('express');
const cors = require('cors'); // Impor pustaka CORS
require('dotenv').config(); // Muat variabel dari file .env
const db = require('./db');
const { startScheduler, runAllActiveJobs } = require('./backupScheduler'); // Impor kedua fungsi

// Impor file rute
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const crmConnectionRoutes = require('./routes/crmConnections');
const backupJobRoutes = require('./routes/backupJobs');
const jobHistoryRoutes = require('./routes/jobHistory');
const zohoRoutes = require('./routes/zoho');

// Inisialisasi aplikasi Express
const app = express();
const PORT = process.env.PORT || 3000;

// ====================================================================
// MIDDLEWARE
// ====================================================================

// Aktifkan CORS untuk semua rute
// Ini akan mengizinkan permintaan dari origin (domain/port) yang berbeda
app.use(cors());

app.use(express.json());

// ====================================================================
// API ROUTES (ENDPOINT)
// ====================================================================

app.get('/', (req, res) => {
  res.send('Selamat datang di API Portal Backup CRM!');
});

// Gunakan rute untuk otentikasi
app.use('/api/auth', authRoutes);

// Gunakan rute lainnya
app.use('/api/clients', clientRoutes);
app.use('/api/connections', crmConnectionRoutes);
app.use('/api/jobs', backupJobRoutes);
app.use('/api/history', jobHistoryRoutes);
app.use('/api/zoho', zohoRoutes);

// ====================================================================
// SERVER LISTENER
// ====================================================================

app.listen(PORT, () => {
  console.log(`Server backend berjalan di http://localhost:${PORT}`);
  
  // Mulai scheduler setelah server berhasil berjalan
  // startScheduler();

  // Jalankan semua pekerjaan backup sekarang untuk tujuan pengujian
  console.log('Triggering initial backup run for testing...');
  runAllActiveJobs();
});
