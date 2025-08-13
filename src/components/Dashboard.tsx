import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import AddConnectionModal from './AddConnectionModal'; // Impor komponen modal

// Definisikan tipe data untuk semua entitas
interface DecodedToken {
  client: {
    id: string;
  };
}

interface ClientData {
  client_id: string;
  company_name: string;
  email: string;
}

interface CrmConnection {
  connection_id: string;
  crm_type: string;
  created_at: string;
}

interface BackupJob {
  job_id: string;
  job_name: string;
  schedule: string;
  is_active: boolean;
}

const Dashboard = () => {
  const [client, setClient] = useState<ClientData | null>(null);
  const [connections, setConnections] = useState<CrmConnection[]>([]);
  const [jobs, setJobs] = useState<{ [key: string]: BackupJob[] }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false); // State untuk modal

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const decoded = jwtDecode<DecodedToken>(token);
      const clientId = decoded.client.id;
      const api = axios.create({
        baseURL: 'http://localhost:3000/api',
        headers: { 'x-auth-token': token },
      });

      const clientRes = await api.get(`/clients/${clientId}`);
      setClient(clientRes.data);

      const connectionsRes = await api.get('/connections', { params: { clientId } });
      setConnections(connectionsRes.data);

      const jobsData: { [key: string]: BackupJob[] } = {};
      for (const conn of connectionsRes.data) {
        const jobsRes = await api.get('/jobs', { params: { connectionId: conn.connection_id } });
        jobsData[conn.connection_id] = jobsRes.data;
      }
      setJobs(jobsData);
    } catch (error) {
      console.error('Gagal mengambil data dasbor:', error);
      handleLogout();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const handleAddConnection = async (crmType: string) => {
    if (!client) return;

    try {
      // Di dunia nyata, di sini akan ada alur OAuth 2.0 yang kompleks.
      // Untuk saat ini, kita langsung membuat entri di database.
      const token = localStorage.getItem('token');
      const api = axios.create({
        baseURL: 'http://localhost:3000/api',
        headers: { 'x-auth-token': token },
      });

      await api.post('/connections', {
        client_id: client.client_id,
        crm_type: crmType,
        encrypted_refresh_token: `dummy_encrypted_token_for_${crmType}`,
      });

      alert(`Connection for ${crmType} added successfully!`);
      setIsModalOpen(false);
      fetchData(); // Ambil ulang data untuk memperbarui daftar
    } catch (error) {
      console.error('Failed to add connection:', error);
      alert('Failed to add new connection.');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading dashboard...</div>;
  }

  return (
    <>
      <AddConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddConnection}
      />
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '32px', fontFamily: 'sans-serif' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827' }}>Client Dashboard</h1>
            <button
              onClick={handleLogout}
              style={{ padding: '8px 16px', fontWeight: '500', color: 'white', backgroundColor: '#dc2626', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            >
              Logout
            </button>
          </div>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
              Welcome, {client ? client.company_name : 'User'}!
            </h2>
            <p style={{ color: '#374151' }}>
              This is your dashboard. Here you will be able to see and manage all your CRM backup jobs.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>Connections & Backup Jobs</h2>
                <button
                    onClick={() => setIsModalOpen(true)}
                    style={{ padding: '8px 16px', fontWeight: '500', color: 'white', backgroundColor: '#4f46e5', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                >
                    + Add New Connection
                </button>
              </div>
              {connections.length > 0 ? (
                connections.map(conn => (
                  <div key={conn.connection_id} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', textTransform: 'capitalize' }}>{conn.crm_type.replace('_', ' ')}</h3>
                    <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>Connected on: {new Date(conn.created_at).toLocaleDateString()}</p>
                    
                    <h4 style={{ fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Backup Jobs:</h4>
                    {jobs[conn.connection_id] && jobs[conn.connection_id].length > 0 ? (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid #e5e7eb' }}>
                        {jobs[conn.connection_id].map(job => (
                          <li key={job.job_id} style={{ padding: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
                            <span>{job.job_name} ({job.schedule})</span>
                            <span style={{ padding: '4px 8px', fontSize: '12px', fontWeight: '600', borderRadius: '9999px', backgroundColor: job.is_active ? '#d1fae5' : '#f3f4f6', color: job.is_active ? '#065f46' : '#374151' }}>
                              {job.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ fontSize: '14px', color: '#6b7280' }}>No backup jobs for this connection.</p>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                  <p style={{ color: '#374151' }}>You have no CRM connections yet. Please add a new connection to get started.</p>
                </div>
              )}
            </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
