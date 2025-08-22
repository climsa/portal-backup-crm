// File: routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const db = require('../db');
const auth = require('../middleware/auth');

// ... (endpoint /login dan /connect tetap sama) ...
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) { return res.status(400).json({ msg: 'Harap masukkan email dan kata sandi' }); }
  try {
    const { rows } = await db.query("SELECT * FROM clients WHERE email = $1", [email]);
    if (rows.length === 0) { return res.status(400).json({ msg: 'Kredensial tidak valid' }); }
    const client = rows[0];
    const isMatch = await bcrypt.compare(password, client.password_hash);
    if (!isMatch) { return res.status(400).json({ msg: 'Kredensial tidak valid' }); }
    const payload = { client: { id: client.client_id, email: client.email } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => { if (err) throw err; res.json({ token }); });
  } catch (err) { console.error(err.message); res.status(500).send('Server Error'); }
});

router.get('/zoho_crm/connect', auth, (req, res) => {
  const { connectionName } = req.query;
  const ZOHO_AUTH_URL = 'https://accounts.zoho.com/oauth/v2/auth';
  const statePayload = { clientId: req.client.id, connectionName: connectionName };
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64');
  const options = {
    scope: 'ZohoCRM.bulk.ALL,ZohoCRM.settings.modules.READ',
    client_id: process.env.ZOHO_CLIENT_ID,
    response_type: 'code',
    redirect_uri: 'http://localhost:3000/api/auth/zoho/callback',
    access_type: 'offline',
    prompt: 'consent',
    state: state,
  };
  const authUrl = `${ZOHO_AUTH_URL}?${new URLSearchParams(options)}`;
  res.redirect(authUrl);
});


router.get('/zoho/callback', async (req, res) => {
  console.log('[CALLBACK] Received callback from Zoho.');
  const { code, state, error: zohoError } = req.query;

  if (zohoError) {
    console.error('[CALLBACK] Zoho returned an error:', zohoError);
    const errorMessage = encodeURIComponent(`Zoho authorization failed: ${zohoError}`);
    return res.redirect(`http://localhost:5173/dashboard?error=${errorMessage}`);
  }
  
  if (!code || !state) {
    console.error('[CALLBACK] Error: Missing code or state from Zoho.');
    return res.redirect(`http://localhost:5173/dashboard?error=${encodeURIComponent('Authorization code or state not found.')}`);
  }

  try {
    console.log('[CALLBACK] Decoding state...');
    const statePayload = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    const { clientId, connectionName } = statePayload;
    console.log(`[CALLBACK] State decoded successfully for clientId: ${clientId}`);

    const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
    const params = new URLSearchParams({
      code,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      redirect_uri: 'http://localhost:3000/api/auth/zoho/callback',
      grant_type: 'authorization_code',
    });

    console.log('[CALLBACK] Exchanging code for token...');
    const tokenResponse = await axios.post(ZOHO_TOKEN_URL, params);
    const { access_token, refresh_token, api_domain } = tokenResponse.data;
    console.log('[CALLBACK] Token received from Zoho. Refresh token exists:', !!refresh_token);

    if (!api_domain) {
      throw new Error('API Domain not provided by Zoho.');
    }

    if (refresh_token) {
      console.log('[CALLBACK] Refresh token found. Performing UPSERT operation...');
      await db.query(
        `INSERT INTO crm_connections (client_id, crm_type, encrypted_refresh_token, connection_name, api_domain) 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (client_id, crm_type) 
         DO UPDATE SET encrypted_refresh_token = EXCLUDED.encrypted_refresh_token, connection_name = EXCLUDED.connection_name, api_domain = EXCLUDED.api_domain;`,
        // PERBAIKAN: Menambahkan 'api_domain' sebagai parameter kelima
        [clientId, 'zoho_crm', refresh_token, connectionName, api_domain]
      );
      console.log('[CALLBACK] UPSERT operation successful.');
    } else if (access_token) {
      console.log('[CALLBACK] No refresh token. Performing UPDATE operation...');
      await db.query(
          "UPDATE crm_connections SET connection_name = $1, api_domain = $2 WHERE client_id = $3 AND crm_type = $4",
          [connectionName, api_domain, clientId, 'zoho_crm']
      );
      console.log('[CALLBACK] UPDATE operation successful.');
    } else {
      throw new Error('Neither access_token nor refresh_token were provided by Zoho.');
    }

    console.log('[CALLBACK] Redirecting to frontend dashboard...');
    res.redirect('http://localhost:5173/dashboard?success=connection_successful');

  } catch (error) {
    console.error('[CALLBACK] CRITICAL ERROR:', error.response ? error.response.data : error.message);
    const errorMessage = encodeURIComponent(error.message || 'An unknown server error occurred.');
    res.redirect(`http://localhost:5173/dashboard?error=${errorMessage}`);
  }
});

module.exports = router;
