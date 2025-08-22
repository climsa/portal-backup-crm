// File: middleware/auth.js
// Tujuan: Middleware untuk memverifikasi JSON Web Token (JWT).

const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  let token;
  const authHeader = req.header('Authorization');

  // Coba ambil token dari header 'Authorization' (untuk panggilan API biasa)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } 
  // Jika tidak ada, coba ambil dari query parameter (untuk alur redirect OAuth)
  else if (req.query.token) {
    token = req.query.token;
  }

  // Jika token tidak ditemukan di kedua tempat, tolak akses
  if (!token) {
    return res.status(401).json({ msg: 'Tidak ada token, otorisasi ditolak' });
  }

  // Verifikasi token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Tambahkan payload (data klien) ke objek request
    req.client = decoded.client;
    next(); // Lanjutkan ke rute selanjutnya
  } catch (err) {
    res.status(401).json({ msg: 'Token tidak valid' });
  }
};
