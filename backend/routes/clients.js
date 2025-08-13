// File: routes/clients.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const auth = require('../middleware/auth');

const saltRounds = 10;

router.post('/', async (req, res) => {
  const { company_name, email, password } = req.body;
  if (!company_name || !email || !password) {
    return res.status(400).json({ msg: 'Harap masukkan semua field' });
  }
  try {
    const password_hash = await bcrypt.hash(password, saltRounds);
    const newClient = await db.query(
      "INSERT INTO clients (company_name, email, password_hash) VALUES ($1, $2, $3) RETURNING client_id, company_name, email, created_at",
      [company_name, email, password_hash]
    );
    res.status(201).json(newClient.rows[0]);
  } catch (err) {
    console.error(err.message);
    if (err.code === '23505') {
      return res.status(400).json({ msg: 'Email sudah terdaftar.' });
    }
    res.status(500).send('Server Error');
  }
});

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT client_id, company_name, email, created_at FROM clients');
    res.status(200).json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.client.id !== id) {
      return res.status(403).json({ msg: 'Akses ditolak' });
    }
    const { rows } = await db.query("SELECT client_id, company_name, email, created_at FROM clients WHERE client_id = $1", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ msg: 'Klien tidak ditemukan' });
    }
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
