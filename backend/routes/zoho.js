// File: routes/zoho.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const prisma = require('../prisma');
const auth = require('../middleware/auth');

// Fungsi bantuan untuk mendapatkan access token baru dari refresh token
const getZohoAccessToken = async (clientId) => {
  const connection = await prisma.crm_connections.findFirst({
    where: {
      client_id: clientId,
      crm_type: 'zoho_crm',
    },
  });

  if (!connection) {
    throw new Error('No Zoho connection found for this client.');
  }
  const refreshToken = connection.encrypted_refresh_token;

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

router.get('/modules', auth, async (req, res) => {
  try {
    const clientId = req.client.id;
    const connection = await prisma.crm_connections.findFirst({
        where: { client_id: clientId, crm_type: 'zoho_crm' }
    });
    
    if (!connection || !connection.api_domain) {
      throw new Error('API Domain not found for this connection. Please re-authenticate.');
    }

    const accessToken = await getZohoAccessToken(clientId);

    const ZOHO_API_URL = `${connection.api_domain}/crm/v2/settings/modules`;
    const config = {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
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
