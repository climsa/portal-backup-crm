// File: routes/zoho.js
// Tujuan: Menangani semua interaksi API spesifik dengan Zoho CRM.

const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../db');
const auth = require('../middleware/auth');

// Fungsi bantuan untuk mendapatkan access token baru dari refresh token
const getZohoAccessToken = async (clientId) => {
  // 1. Ambil refresh token DARI KONEKSI SPESIFIK
  const { rows } = await db.query(
    "SELECT encrypted_refresh_token FROM crm_connections WHERE client_id = $1 AND crm_type = 'zoho_crm'",
    [clientId]
  );

  if (rows.length === 0) {
    throw new Error('No Zoho connection found for this client.');
  }
  const refreshToken = rows[0].encrypted_refresh_token;

  // 2. Tukar refresh token dengan access token baru
  const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const response = await axios.post(ZOHO_TOKEN_URL, params);
  return response.data.access_token;
};


/**
 * @route   GET /api/zoho/modules
 * @desc    Mengambil daftar semua modul yang bisa di-backup dari akun Zoho klien
 * @access  Private
 */
router.get('/modules', auth, async (req, res) => {
  try {
    const clientId = req.client.id;

    // PERBAIKAN: Ambil api_domain dari database untuk koneksi ini
    const connRes = await db.query(
      "SELECT api_domain FROM crm_connections WHERE client_id = $1 AND crm_type = 'zoho_crm'",
      [clientId]
    );

    if (connRes.rows.length === 0 || !connRes.rows[0].api_domain) {
      throw new Error('API Domain not found for this connection. Please re-authenticate.');
    }
    const apiDomain = connRes.rows[0].api_domain;

    const accessToken = await getZohoAccessToken(clientId);

    // Gunakan api_domain yang benar dari database
    const ZOHO_API_URL = `${apiDomain}/crm/v2/settings/modules`;
    const config = {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    };

    const zohoResponse = await axios.get(ZOHO_API_URL, config);
    
    const modules = zohoResponse.data.modules.map(module => ({
      api_name: module.api_name,
      plural_label: module.plural_label,
      is_custom: !module.generated_type,
    }));

    res.status(200).json(modules);

  } catch (error) {
    console.error('Error fetching Zoho modules:', error.response ? error.response.data : error.message);
    res.status(500).send('An error occurred while fetching data from Zoho.');
  }
});

module.exports = router;
