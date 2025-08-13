// File: routes/crmConnections.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.post('/', auth, async (req, res) => {
  const { client_id, crm_type, encrypted_refresh_token } = req.body;
  if (!client_id || !crm_type || !encrypted_refresh_token) {
    return res.status(400).json({ msg: 'Harap sediakan client_id, crm_type, dan token.' });
  }
  try {
    const newConnection = await db.query(
      "INSERT INTO crm_connections (client_id, crm_type, encrypted_refresh_token) VALUES ($1, $2, $3) RETURNING *",
      [client_id, crm_type, encrypted_refresh_token]
    );
    res.status(201).json(newConnection.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.get('/', auth, async (req, res) => {
  const { clientId } = req.query;
  if (!clientId) {
    return res.status(400).json({ msg: 'Parameter clientId diperlukan.' });
  }
  try {
    const { rows } = await db.query("SELECT * FROM crm_connections WHERE client_id = $1", [clientId]);
    res.status(200).json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
