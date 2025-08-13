// File: db.js
// Tujuan: Mengelola koneksi ke database PostgreSQL menggunakan connection pool.

// Impor pustaka 'pg' untuk berinteraksi dengan PostgreSQL
const { Pool } = require('pg');

// Konfigurasi koneksi ke database Anda.
// Praktik terbaik adalah menggunakan environment variables untuk informasi sensitif ini.
// Untuk saat ini, kita akan menuliskannya langsung di sini untuk kemudahan setup.
const pool = new Pool({
  user: 'portal_user', // Pengguna yang Anda buat sebelumnya
  host: 'localhost',   // Alamat server database Anda
  database: 'portal_backup_db', // Nama database yang Anda buat
  password: 'password_yang_aman', // Ganti dengan kata sandi yang Anda atur
  port: 5432, // Port default untuk PostgreSQL
});

// Verifikasi koneksi saat aplikasi pertama kali dimulai
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  client.query('SELECT NOW()', (err, result) => {
    release(); // Lepaskan client kembali ke pool
    if (err) {
      return console.error('Error executing query', err.stack);
    }
    console.log('Successfully connected to PostgreSQL database at:', result.rows[0].now);
  });
});

// Ekspor fungsi query agar bisa digunakan di file lain (misalnya, di rute API)
// Ini adalah satu-satunya bagian yang perlu diekspor.
// Ini memungkinkan kita menjalankan kueri seperti: db.query('SELECT * FROM clients')
module.exports = {
  query: (text, params) => pool.query(text, params),
};
