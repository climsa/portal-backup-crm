// File: routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ msg: 'Harap masukkan email dan kata sandi' });
  }
  try {
    const { rows } = await db.query("SELECT * FROM clients WHERE email = $1", [email]);
    if (rows.length === 0) {
      return res.status(400).json({ msg: 'Kredensial tidak valid email' });
    }
    const client = rows[0];
    const isMatch = await bcrypt.compare(password, client.password_hash);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Kredensial tidak valid password' });
    }
    const payload = { client: { id: client.client_id } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
