// File: routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma'); // Ganti db dengan prisma
const axios = require('axios');
const auth = require('../middleware/auth');

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const ZOHO_REDIRECT_URI = process.env.ZOHO_REDIRECT_URI || `${API_BASE_URL}/auth/zoho/callback`;
const ZOHO_AUTH_URL = process.env.ZOHO_AUTH_URL || 'https://accounts.zoho.com/oauth/v2/auth';
const ZOHO_TOKEN_URL = process.env.ZOHO_TOKEN_URL || 'https://accounts.zoho.com/oauth/v2/token';

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ msg: 'Harap masukkan email dan kata sandi' });
  }
  try {
    const client = await prisma.clients.findUnique({ where: { email } });
    if (!client) {
      return res.status(400).json({ msg: 'Kredensial tidak valid' });
    }
    const isMatch = await bcrypt.compare(password, client.password_hash);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Kredensial tidak valid' });
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

router.get('/zoho_crm/connect', auth, (req, res) => {
  const { connectionName } = req.query;
  const statePayload = { clientId: req.client.id, connectionName: connectionName };
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64');
  const options = {
    scope: process.env.ZOHO_SCOPE,
    client_id: process.env.ZOHO_CLIENT_ID,
    response_type: 'code',
    redirect_uri: ZOHO_REDIRECT_URI,
    access_type: 'offline',
    prompt: 'consent',
    state: state,
  };
  const authUrl = `${ZOHO_AUTH_URL}?${new URLSearchParams(options)}`;
  res.redirect(authUrl);
});

router.get('/zoho/callback', async (req, res) => {
  const { code, state, error: zohoError } = req.query;
  if (zohoError) {
    const errorMessage = encodeURIComponent(`Zoho authorization failed: ${zohoError}`);
    return res.redirect(`${FRONTEND_BASE_URL}/dashboard?error=${errorMessage}`);
  }
  if (!code || !state) {
    return res.redirect(`${FRONTEND_BASE_URL}/dashboard?error=${encodeURIComponent('Authorization code or state not found.')}`);
  }
  try {
    const statePayload = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    const { clientId, connectionName } = statePayload;

    const params = new URLSearchParams({
      code,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      redirect_uri: ZOHO_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const tokenResponse = await axios.post(ZOHO_TOKEN_URL, params);
    const { access_token, refresh_token, api_domain } = tokenResponse.data;

    if (!api_domain) {
      throw new Error('API Domain not provided by Zoho.');
    }

    // PERBAIKAN: Gunakan `upsert` yang akan membuat atau memperbarui koneksi
    // Ini secara efektif menangani kasus koneksi baru dan koneksi yang di-soft delete
    await prisma.crm_connections.upsert({
      where: { 
        // Kunci unik yang digunakan Prisma untuk menemukan entri yang ada
        client_id_crm_type: { 
          client_id: clientId, 
          crm_type: 'zoho_crm' 
        } 
      },
      // Data yang akan diperbarui jika entri ditemukan
      update: {
        encrypted_refresh_token: refresh_token || undefined, // Hanya perbarui token jika yang baru ada
        connection_name: connectionName,
        api_domain: api_domain,
        deleted_at: null, // "Menghidupkan" kembali koneksi dengan mengatur deleted_at menjadi null
      },
      // Data yang akan dibuat jika tidak ada entri yang ditemukan
      create: {
        client_id: clientId,
        crm_type: 'zoho_crm',
        encrypted_refresh_token: refresh_token,
        connection_name: connectionName,
        api_domain: api_domain,
      },
    });

    res.redirect(`${FRONTEND_BASE_URL}/dashboard?success=connection_successful`);
  } catch (error) {
    console.error('Error during Zoho OAuth callback:', error.response ? error.response.data : error.message);
    const errorMessage = encodeURIComponent(error.message || 'An unknown server error occurred.');
    res.redirect(`${FRONTEND_BASE_URL}/dashboard?error=${errorMessage}`);
  }
});

module.exports = router;
