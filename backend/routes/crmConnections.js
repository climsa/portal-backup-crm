// File: routes/crmConnections.js (Diperbaiki)
const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const auth = require('../middleware/auth');

/**
 * Mengambil semua koneksi CRM yang aktif milik klien yang sedang login.
 * clientId diambil dari token otentikasi, bukan dari query parameter.
 */
router.get('/', auth, async (req, res) => {
  // PERBAIKAN: Ambil clientId dari token yang sudah diverifikasi oleh middleware 'auth'
  const clientId = req.client.id;

  try {
    const connections = await prisma.crm_connections.findMany({
      where: {
        client_id: clientId,
        deleted_at: null, // Hanya ambil koneksi yang tidak di-soft delete
      },
      orderBy: {
        created_at: 'desc',
      },
    });
    res.status(200).json(connections);
  } catch (error) {
    console.error('Error fetching CRM connections:', error);
    res.status(500).send('Server Error');
  }
});

/**
 * Mengubah nama koneksi.
 */
router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { connection_name } = req.body;
  const clientId = req.client.id;

  if (!connection_name) {
    return res.status(400).json({ msg: 'Connection name is required.' });
  }

  try {
    const updatedConnection = await prisma.crm_connections.updateMany({
      where: {
        connection_id: id,
        client_id: clientId, // Pastikan pengguna hanya bisa mengedit koneksinya sendiri
      },
      data: {
        connection_name: connection_name,
      },
    });

    if (updatedConnection.count === 0) {
      return res.status(404).json({ msg: 'Connection not found or you do not have permission to edit it.' });
    }

    res.status(200).json({ msg: 'Connection name updated successfully.' });
  } catch (error) {
    console.error('Error updating connection name:', error);
    res.status(500).send('Server Error');
  }
});

/**
 * Melakukan soft delete pada koneksi CRM.
 */
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const clientId = req.client.id;

  try {
    const deletedConnection = await prisma.crm_connections.updateMany({
      where: {
        connection_id: id,
        client_id: clientId,
      },
      data: {
        deleted_at: new Date(),
      },
    });

    if (deletedConnection.count === 0) {
      return res.status(404).json({ msg: 'Connection not found or you do not have permission to delete it.' });
    }

    // Kita juga bisa menonaktifkan semua pekerjaan yang terkait (opsional)
    await prisma.backup_jobs.updateMany({
        where: { connection_id: id },
        data: { is_active: false }
    });

    res.status(200).json({ msg: 'Connection deleted successfully.' });
  } catch (error) {
    console.error('Error deleting connection:', error);
    res.status(500).send('Server Error');
  }
});

module.exports = router;

