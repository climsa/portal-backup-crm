// File: middleware/auth.js
// Tujuan: Middleware untuk memverifikasi JSON Web Token (JWT).

const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // 1. Ambil token dari header
  const token = req.header('x-auth-token');

  // 2. Cek jika tidak ada token
  if (!token) {
    return res.status(401).json({ msg: 'Tidak ada token, otorisasi ditolak' });
  }

  // 3. Verifikasi token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Tambahkan payload (data klien) ke objek request
    req.client = decoded.client;
    next(); // Lanjutkan ke rute selanjutnya
  } catch (err) {
    res.status(401).json({ msg: 'Token tidak valid' });
  }
};
