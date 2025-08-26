// File: routes/crmConnections.js
const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { clientId } = req.query;
  if (!clientId) { return res.status(400).json({ msg: 'Parameter clientId diperlukan.' }); }
  try {
    const connections = await prisma.crm_connections.findMany({
      where: { client_id: clientId, deleted_at: null },
    });
    res.status(200).json(connections);
  } catch (err) { console.error(err.message); res.status(500).send('Server Error'); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.crm_connections.update({
      where: { connection_id: id },
      data: { deleted_at: new Date() },
    });
    res.status(200).json({ msg: 'Koneksi CRM berhasil dihapus' });
  } catch (err) { console.error(err.message); res.status(500).send('Server Error'); }
});

router.put('/:id', auth, async (req, res) => {
  const { connection_name } = req.body;
  const { id } = req.params;
  if (!connection_name) {
    return res.status(400).json({ msg: 'Harap sediakan nama koneksi.' });
  }
  try {
    const updatedConnection = await prisma.crm_connections.update({
        where: { connection_id: id },
        data: { connection_name },
    });
    res.status(200).json(updatedConnection);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
