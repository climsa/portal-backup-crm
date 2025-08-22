// File: routes/crmConnections.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// ... (Endpoint POST, GET, DELETE tetap sama seperti sebelumnya) ...
router.post('/', auth, async (req, res) => {
  const { client_id, crm_type, encrypted_refresh_token, connection_name } = req.body;
  if (!client_id || !crm_type || !encrypted_refresh_token || !connection_name) {
    return res.status(400).json({ msg: 'Harap sediakan client_id, crm_type, token, dan nama koneksi.' });
  }
  try {
    const newConnection = await db.query(
      "INSERT INTO crm_connections (client_id, crm_type, encrypted_refresh_token, connection_name) VALUES ($1, $2, $3, $4) RETURNING *",
      [client_id, crm_type, encrypted_refresh_token, connection_name]
    );
    res.status(201).json(newConnection.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
router.get('/', auth, async (req, res) => {
  const { clientId } = req.query;
  if (!clientId) { return res.status(400).json({ msg: 'Parameter clientId diperlukan.' }); }
  try {
    const { rows } = await db.query("SELECT * FROM crm_connections WHERE client_id = $1", [clientId]);
    res.status(200).json(rows);
  } catch (err) { console.error(err.message); res.status(500).send('Server Error'); }
});
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const deleteOp = await db.query("DELETE FROM crm_connections WHERE connection_id = $1", [id]);
    if (deleteOp.rowCount === 0) { return res.status(404).json({ msg: 'Koneksi tidak ditemukan' }); }
    res.status(200).json({ msg: 'Koneksi CRM berhasil dihapus' });
  } catch (err) { console.error(err.message); res.status(500).send('Server Error'); }
});


/**
 * @route   PUT /api/connections/:id
 * @desc    Memperbarui nama koneksi CRM
 * @access  Private
 */
router.put('/:id', auth, async (req, res) => {
  const { connection_name } = req.body;
  const { id } = req.params;

  if (!connection_name) {
    return res.status(400).json({ msg: 'Harap sediakan nama koneksi.' });
  }

  try {
    const updatedConnection = await db.query(
      "UPDATE crm_connections SET connection_name = $1 WHERE connection_id = $2 RETURNING *",
      [connection_name, id]
    );

    if (updatedConnection.rows.length === 0) {
      return res.status(404).json({ msg: 'Koneksi tidak ditemukan' });
    }

    res.status(200).json(updatedConnection.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
