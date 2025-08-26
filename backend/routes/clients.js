// File: routes/clients.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const prisma = require('../prisma');
const auth = require('../middleware/auth');

const saltRounds = 10;

router.post('/', async (req, res) => {
  const { company_name, email, password } = req.body;
  if (!company_name || !email || !password) {
    return res.status(400).json({ msg: 'Harap masukkan semua field' });
  }
  try {
    const password_hash = await bcrypt.hash(password, saltRounds);
    const newClient = await prisma.clients.create({
      data: { company_name, email, password_hash },
      select: { client_id: true, company_name: true, email: true, created_at: true },
    });
    res.status(201).json(newClient);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ msg: 'Email sudah terdaftar.' });
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.get('/', async (req, res) => {
  try {
    const clients = await prisma.clients.findMany({
      select: { client_id: true, company_name: true, email: true, created_at: true },
    });
    res.status(200).json(clients);
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
        const client = await prisma.clients.findUnique({
            where: { client_id: id },
            select: { client_id: true, company_name: true, email: true, created_at: true },
        });
        if (!client) {
            return res.status(404).json({ msg: 'Klien tidak ditemukan' });
        }
        res.status(200).json(client);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
