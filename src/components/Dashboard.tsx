import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import AddConnectionModal from './AddConnectionModal';
import AddJobModal from './AddJobModal';
import JobHistoryModal from './JobHistoryModal';
import EditJobModal from './EditJobModal';
import NotificationModal from './NotificationModal';
import EditConnectionNameModal from './EditConnectionNameModal';

// ... (Definisi interface tetap sama) ...
interface DecodedToken { client: { id: string; }; }
interface ClientData { client_id: string; company_name: string; email: string; }
interface CrmConnection { connection_id: string; crm_type: string; created_at: string; connection_name: string; }
interface BackupJob { job_id: string; job_name: string; schedule: string; is_active: boolean; }
interface ModalState { isOpen: boolean; title: string; message: string; type?: 'success' | 'error' | 'confirm'; onConfirm?: () => void; }

const Dashboard = () => {
  // ... (Semua state tetap sama) ...
  const [client, setClient] = useState<ClientData | null>(null);
  const [connections, setConnections] = useState<CrmConnection[]>([]);
  const [jobs, setJobs] = useState<{ [key: string]: BackupJob[] }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState<boolean>(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [isEditJobModalOpen, setIsEditJobModalOpen] = useState<boolean>(false);
  const [isEditConnectionModalOpen, setIsEditConnectionModalOpen] = useState<boolean>(false);
  const [selectedConnection, setSelectedConnection] = useState<CrmConnection | null>(null);
  const [selectedJob, setSelectedJob] = useState<BackupJob | null>(null);
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '' });

  // ... (Semua fungsi lain tetap sama, kecuali handleAddJob) ...
  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    try {
      setLoading(true);
      const decoded = jwtDecode<DecodedToken>(token);
      const clientId = decoded.client.id;const api = axios.create({ 
        baseURL: 'http://localhost:3000/api', 
        headers: { 'Authorization': `Bearer ${token}` } 
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
    } catch (error) { console.error('Gagal mengambil data dasbor:', error); handleLogout(); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);
  const handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };
  const showNotification = (title: string, message: string, type: 'success' | 'error' = 'success') => { setModalState({ isOpen: true, title, message, type }); };
  const showConfirmation = (title: string, message: string, onConfirm: () => void) => { setModalState({ isOpen: true, title, message, type: 'confirm', onConfirm }); };
  const handleAddConnection = (details: { crmType: string; connectionName: string }) => { const existingConnection = connections.find(c => c.crm_type === details.crmType); const proceed = () => { const token = localStorage.getItem('token'); const queryParams = new URLSearchParams({ token: token || '', connectionName: details.connectionName, }); window.location.href = `http://localhost:3000/api/auth/${details.crmType}/connect?${queryParams.toString()}`; }; if (existingConnection) { showConfirmation( 'Connection Exists', `You already have a connection for ${details.crmType}. Do you want to re-authenticate and update it?`, proceed ); } else { proceed(); } };
  const handleUpdateConnectionName = async (connectionId: string, newName: string) => { try { const token = localStorage.getItem('token'); const api = axios.create({ baseURL: 'http://localhost:3000/api', headers: { 'Authorization': `Bearer ${token}` } }); await api.put(`/connections/${connectionId}`, { connection_name: newName }); showNotification('Success', 'Connection name updated!'); setIsEditConnectionModalOpen(false); fetchData(); } catch (error) { showNotification('Error', 'Failed to update name.', 'error'); } };
  const handleDeleteConnection = (connectionId: string) => { showConfirmation('Delete Connection', 'Are you sure?', async () => { try { const token = localStorage.getItem('token'); const api = axios.create({ baseURL: 'http://localhost:3000/api', headers: { 'Authorization': `Bearer ${token}` } }); await api.delete(`/connections/${connectionId}`); showNotification('Success', 'Connection deleted!'); fetchData(); } catch (error) { showNotification('Error', 'Failed to delete.', 'error'); } }); };
  const handleUpdateJob = async (jobId: string, jobDetails: { job_name: string; schedule: string; is_active: boolean }) => { try { const token = localStorage.getItem('token'); const api = axios.create({ baseURL: 'http://localhost:3000/api', headers: { 'Authorization': `Bearer ${token}` } }); await api.put(`/jobs/${jobId}`, jobDetails); showNotification('Success', 'Job updated!'); setIsEditJobModalOpen(false); setSelectedJob(null); fetchData(); } catch (error) { showNotification('Error', 'Failed to update job.', 'error'); } };
  const handleToggleJobStatus = async (job: BackupJob) => { try { const token = localStorage.getItem('token'); const api = axios.create({ baseURL: 'http://localhost:3000/api', headers: { 'Authorization': `Bearer ${token}` } }); await api.put(`/jobs/${job.job_id}`, { ...job, is_active: !job.is_active }); showNotification('Success', 'Job status updated!'); fetchData(); } catch (error) { showNotification('Error', 'Failed to update status.', 'error'); } };
  const handleDeleteJob = (jobId: string) => { showConfirmation('Delete Job', 'Are you sure?', async () => { try { const token = localStorage.getItem('token'); const api = axios.create({ baseURL: 'http://localhost:3000/api', headers: { 'Authorization': `Bearer ${token}` } }); await api.delete(`/jobs/${jobId}`); showNotification('Success', 'Job deleted!'); fetchData(); } catch (error) { showNotification('Error', 'Failed to delete job.', 'error'); } }); };
  const openJobModal = (connection: CrmConnection) => { setSelectedConnection(connection); setIsJobModalOpen(true); };
  const openHistoryModal = (job: BackupJob) => { setSelectedJob(job); setIsHistoryModalOpen(true); };
  const openEditJobModal = (job: BackupJob) => { setSelectedJob(job); setIsEditJobModalOpen(true); };
  const openEditConnectionModal = (connection: CrmConnection) => { setSelectedConnection(connection); setIsEditConnectionModalOpen(true); };

  const handleAddJob = async (jobDetails: { job_name: string; schedule: string; selected_data: { modules: string[] } }) => {
    if (!selectedConnection) return;
    try {
      const token = localStorage.getItem('token');
      const api = axios.create({
        baseURL: 'http://localhost:3000/api',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      await api.post('/jobs', {
        connection_id: selectedConnection.connection_id,
        job_name: jobDetails.job_name,
        schedule: jobDetails.schedule,
        selected_data: jobDetails.selected_data, // Kirim data modul yang dipilih
        storage_region: 'sg',
      });

      showNotification('Success', `Backup job "${jobDetails.job_name}" added successfully!`);
      setIsJobModalOpen(false);
      setSelectedConnection(null);
      fetchData();
    } catch (error) {
      console.error('Failed to add job:', error);
      showNotification('Error', 'Failed to add new backup job.', 'error');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading dashboard...</div>;
  }

  return (
    <>
      <AddConnectionModal isOpen={isConnectionModalOpen} onClose={() => setIsConnectionModalOpen(false)} onAdd={handleAddConnection} />
      <AddJobModal isOpen={isJobModalOpen} onClose={() => { setIsJobModalOpen(false); setSelectedConnection(null); }} onAdd={handleAddJob} />
      <JobHistoryModal isOpen={isHistoryModalOpen} onClose={() => { setIsHistoryModalOpen(false); setSelectedJob(null); }} jobId={selectedJob?.job_id || null} />
      <EditJobModal isOpen={isEditJobModalOpen} onClose={() => { setIsEditJobModalOpen(false); setSelectedJob(null); }} onUpdate={handleUpdateJob} job={selectedJob} />
      <EditConnectionNameModal isOpen={isEditConnectionModalOpen} onClose={() => { setIsEditConnectionModalOpen(false); setSelectedConnection(null); }} onUpdate={handleUpdateConnectionName} connection={selectedConnection} />
      <NotificationModal 
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        onConfirm={modalState.onConfirm}
      />
      
      {/* ... (Struktur JSX lainnya tetap sama) ... */}
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '32px', fontFamily: 'sans-serif' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827' }}>Client Dashboard</h1>
            <button onClick={handleLogout} style={{ padding: '8px 16px', fontWeight: '500', color: 'white', backgroundColor: '#dc2626', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
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
                <button onClick={() => setIsConnectionModalOpen(true)} style={{ padding: '8px 16px', fontWeight: '500', color: 'white', backgroundColor: '#4f46e5', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
                    + Add New Connection
                </button>
              </div>
              {connections.length > 0 ? (
                connections.map(conn => (
                  <div key={conn.connection_id} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{conn.connection_name}</h3>
                            <button onClick={() => openEditConnectionModal(conn)} style={{ padding: '2px 6px', fontSize: '10px', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>
                                Edit
                            </button>
                        </div>
                        <div style={{display: 'flex', gap: '12px'}}>
                            <button onClick={() => openJobModal(conn)} style={{ padding: '6px 12px', fontSize: '14px', fontWeight: '500', color: '#4f46e5', backgroundColor: '#e0e7ff', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
                                + Add Job
                            </button>
                            <button onClick={() => handleDeleteConnection(conn.connection_id)} style={{ padding: '6px 12px', fontSize: '14px', fontWeight: '500', color: '#be123c', backgroundColor: '#fee2e2', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
                                Delete
                            </button>
                        </div>
                    </div>
                    <p style={{ fontSize: '14px', color: '#6b7280', textTransform: 'capitalize', marginTop: '-12px', marginBottom: '16px' }}>
                        {conn.crm_type.replace('_', ' ')} - Connected on: {new Date(conn.created_at).toLocaleDateString()}
                    </p>
                    {jobs[conn.connection_id] && jobs[conn.connection_id].length > 0 ? (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid #e5e7eb' }}>
                        {jobs[conn.connection_id].map(job => (
                          <li key={job.job_id} style={{ padding: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span>{job.job_name} ({job.schedule})</span>
                                <span style={{ marginLeft: '16px', padding: '4px 8px', fontSize: '12px', fontWeight: '600', borderRadius: '9999px', backgroundColor: job.is_active ? '#d1fae5' : '#f3f4f6', color: job.is_active ? '#065f46' : '#374151' }}>
                                {job.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleToggleJobStatus(job)} style={{ padding: '4px 10px', fontSize: '12px', fontWeight: '500', color: job.is_active ? '#ca8a04' : '#166534', backgroundColor: job.is_active ? '#fef9c3' : '#dcfce7', borderRadius: '4px', border: '1px solid #fde047', cursor: 'pointer' }}>
                                    {job.is_active ? 'Stop' : 'Start'}
                                </button>
                                <button onClick={() => openHistoryModal(job)} style={{ padding: '4px 10px', fontSize: '12px', fontWeight: '500', color: '#374151', backgroundColor: '#f9fafb', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer' }}>
                                    History
                                </button>
                                <button onClick={() => openEditJobModal(job)} style={{ padding: '4px 10px', fontSize: '12px', fontWeight: '500', color: '#374151', backgroundColor: '#f9fafb', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer' }}>
                                    Edit
                                </button>
                                <button onClick={() => handleDeleteJob(job.job_id)} style={{ padding: '4px 10px', fontSize: '12px', fontWeight: '500', color: '#991b1b', backgroundColor: '#fee2e2', borderRadius: '4px', border: '1px solid #fecaca', cursor: 'pointer' }}>
                                    Delete
                                </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ fontSize: '14px', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>No backup jobs for this connection.</p>
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
