import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import AddConnectionModal from './AddConnectionModal';
import AddJobModal from './AddJobModal';
import JobHistoryModal from './JobHistoryModal';
import EditJobModal from './EditJobModal';
import NotificationModal from './NotificationModal';
import EditConnectionNameModal from './EditConnectionNameModal';

// Definisikan tipe data untuk semua entitas
interface DecodedToken { client: { id: string; }; }
interface ClientData { client_id: string; company_name: string; email: string; }
interface CrmConnection { connection_id: string; crm_type: string; created_at: string; connection_name: string; }
interface BackupJob { job_id: string; job_name: string; schedule: string; is_active: boolean; }
interface JobHistoryLog { status: string; }
interface ModalState { isOpen: boolean; title: string; message: string; type?: 'success' | 'error' | 'confirm'; onConfirm?: () => void; }
type JobStatuses = { [key: string]: string | null };

const Dashboard = () => {
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
  const [jobStatuses, setJobStatuses] = useState<JobStatuses>({});
  const prevJobStatusesRef = useRef<JobStatuses>({});

  const fetchData = useCallback(async (showLoading = true) => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    try {
      if (showLoading) setLoading(true);
      const decoded = jwtDecode<DecodedToken>(token);
      const clientId = decoded.client.id;
      
      const api = axios.create({ 
        baseURL: 'http://localhost:3000/api', 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      const [clientRes, connectionsRes] = await Promise.all([
        api.get(`/clients/${clientId}`),
        api.get('/connections', { params: { clientId } })
      ]);
      
      setClient(clientRes.data);
      setConnections(connectionsRes.data);

      const jobsData: { [key: string]: BackupJob[] } = {};
      const newStatuses: JobStatuses = {};

      for (const conn of connectionsRes.data) {
        const jobsRes = await api.get('/jobs', { params: { connectionId: conn.connection_id } });
        jobsData[conn.connection_id] = jobsRes.data;

        for (const job of jobsRes.data) {
            const historyRes = await api.get('/history', { params: { jobId: job.job_id } });
            if (historyRes.data && historyRes.data.length > 0) {
                newStatuses[job.job_id] = historyRes.data[0].status;
            } else {
                newStatuses[job.job_id] = null;
            }
        }
      }
      setJobs(jobsData);
      setJobStatuses(newStatuses);

    } catch (error) { console.error('Gagal mengambil data dasbor:', error); handleLogout(); }
    finally { if (showLoading) setLoading(false); }
  }, []);

  useEffect(() => {
    // Periksa parameter URL untuk pesan dari callback OAuth
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const success = params.get('success');

    if (error) {
      showNotification('Connection Failed', decodeURIComponent(error), 'error');
      window.history.replaceState({}, document.title, "/dashboard");
    }
    if (success) {
      showNotification('Success', 'Connection successful!');
      window.history.replaceState({}, document.title, "/dashboard");
    }

    fetchData();
    const interval = setInterval(() => fetchData(false), 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    // Logika untuk menampilkan notifikasi saat status pekerjaan berubah
    const prevStatuses = prevJobStatusesRef.current;
    for (const jobId in jobStatuses) {
        if (prevStatuses[jobId] === 'in_progress' && jobStatuses[jobId] !== 'in_progress') {
            const jobName = Object.values(jobs).flat().find(j => j.job_id === jobId)?.job_name || 'A job';
            if (jobStatuses[jobId] === 'success') {
                showNotification('Backup Complete', `${jobName} has finished successfully.`);
            } else if (jobStatuses[jobId] === 'failed') {
                showNotification('Backup Failed', `${jobName} failed to complete. Check history for details.`, 'error');
            }
        }
    }
    // Simpan status saat ini untuk perbandingan berikutnya
    prevJobStatusesRef.current = jobStatuses;
  }, [jobStatuses, jobs]);
  
  const handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };
  const showNotification = (title: string, message: string, type: 'success' | 'error' = 'success') => { setModalState({ isOpen: true, title, message, type }); };
  const showConfirmation = (title: string, message: string, onConfirm: () => void) => { setModalState({ isOpen: true, title, message, type: 'confirm', onConfirm }); };
  const handleAddConnection = (details: { crmType: string; connectionName: string }) => { const existingConnection = connections.find(c => c.crm_type === details.crmType); const proceed = () => { const token = localStorage.getItem('token'); const queryParams = new URLSearchParams({ token: token || '', connectionName: details.connectionName, }); window.location.href = `http://localhost:3000/api/auth/${details.crmType}/connect?${queryParams.toString()}`; }; if (existingConnection) { showConfirmation( 'Connection Exists', `You already have a connection for ${details.crmType}. Do you want to re-authenticate and update it?`, proceed ); } else { proceed(); } };
  const handleUpdateConnectionName = async (connectionId: string, newName: string) => { try { const token = localStorage.getItem('token'); const api = axios.create({ baseURL: 'http://localhost:3000/api', headers: { 'Authorization': `Bearer ${token}` } }); await api.put(`/connections/${connectionId}`, { connection_name: newName }); showNotification('Success', 'Connection name updated!'); setIsEditConnectionModalOpen(false); fetchData(); } catch (error) { showNotification('Error', 'Failed to update name.', 'error'); } };
  const handleDeleteConnection = (connectionId: string) => { showConfirmation('Delete Connection', 'Are you sure?', async () => { try { const token = localStorage.getItem('token'); const api = axios.create({ baseURL: 'http://localhost:3000/api', headers: { 'Authorization': `Bearer ${token}` } }); await api.delete(`/connections/${connectionId}`); showNotification('Success', 'Connection deleted!'); fetchData(); } catch (error) { showNotification('Error', 'Failed to delete.', 'error'); } }); };
  const handleAddJob = async (jobDetails: { job_name: string; schedule: string; selected_data: { modules: string[] } }) => { if (!selectedConnection) return; try { const token = localStorage.getItem('token'); const api = axios.create({ baseURL: 'http://localhost:3000/api', headers: { 'Authorization': `Bearer ${token}` } }); await api.post('/jobs', { connection_id: selectedConnection.connection_id, ...jobDetails, storage_region: 'sg' }); showNotification('Success', 'Job added!'); setIsJobModalOpen(false); setSelectedConnection(null); fetchData(); } catch (error) { showNotification('Error', 'Failed to add job.', 'error'); } };
  const handleUpdateJob = async (jobId: string, jobDetails: { job_name: string; schedule: string; is_active: boolean }) => { try { const token = localStorage.getItem('token'); const api = axios.create({ baseURL: 'http://localhost:3000/api', headers: { 'Authorization': `Bearer ${token}` } }); await api.put(`/jobs/${jobId}`, jobDetails); showNotification('Success', 'Job updated!'); setIsEditJobModalOpen(false); setSelectedJob(null); fetchData(); } catch (error) { showNotification('Error', 'Failed to update job.', 'error'); } };
  const handleToggleJobStatus = async (job: BackupJob) => { try { const token = localStorage.getItem('token'); const api = axios.create({ baseURL: 'http://localhost:3000/api', headers: { 'Authorization': `Bearer ${token}` } }); await api.put(`/jobs/${job.job_id}`, { ...job, is_active: !job.is_active }); showNotification('Success', 'Job status updated!'); fetchData(); } catch (error) { showNotification('Error', 'Failed to update status.', 'error'); } };
  const handleDeleteJob = (jobId: string) => { showConfirmation('Delete Job', 'Are you sure?', async () => { try { const token = localStorage.getItem('token'); const api = axios.create({ baseURL: 'http://localhost:3000/api', headers: { 'Authorization': `Bearer ${token}` } }); await api.delete(`/jobs/${jobId}`); showNotification('Success', 'Job deleted!'); fetchData(); } catch (error) { showNotification('Error', 'Failed to delete job.', 'error'); } }); };
  const openJobModal = (connection: CrmConnection) => { setSelectedConnection(connection); setIsJobModalOpen(true); };
  const openHistoryModal = (job: BackupJob) => { setSelectedJob(job); setIsHistoryModalOpen(true); };
  const openEditJobModal = (job: BackupJob) => { setSelectedJob(job); setIsEditJobModalOpen(true); };
  const openEditConnectionModal = (connection: CrmConnection) => { setSelectedConnection(connection); setIsEditConnectionModalOpen(true); };

  const handleTriggerJob = async (jobId: string) => {
    try {
      const token = localStorage.getItem('token');
      const api = axios.create({ baseURL: 'http://localhost:3000/api', headers: { 'Authorization': `Bearer ${token}` } });
      await api.post(`/jobs/${jobId}/run`);
      showNotification('Success', 'Backup job has been triggered! The status will update shortly.');
      setTimeout(() => fetchData(false), 2000);
    } catch (error) {
      showNotification('Error', 'Failed to trigger backup job. Please check server logs.', 'error');
    }
  };

  const handleCancelJob = async (jobId: string) => {
    showConfirmation('Cancel Job', 'Are you sure you want to cancel this running job?', async () => {
      try {
        const token = localStorage.getItem('token');
        const api = axios.create({ baseURL: 'http://localhost:3000/api', headers: { 'Authorization': `Bearer ${token}` } });
        await api.post(`/jobs/${jobId}/cancel`);
        showNotification('Success', 'Job cancellation request sent.');
        fetchData();
      } catch (error) {
        showNotification('Error', 'Failed to cancel job.', 'error');
      }
    });
  };

  const renderJobActions = (job: BackupJob) => {
    const status = jobStatuses[job.job_id];
    const isRunning = status === 'in_progress';
    
    const baseButtonStyle: React.CSSProperties = { padding: '4px 12px', fontSize: '12px', fontWeight: '500', borderRadius: '6px', border: '1px solid', cursor: 'pointer', transition: 'background-color 0.2s, color 0.2s' };
    const actionButtonStyle: React.CSSProperties = { ...baseButtonStyle, backgroundColor: '#e0e7ff', borderColor: '#c7d2fe', color: '#4338ca' };
    const secondaryButtonStyle: React.CSSProperties = { ...baseButtonStyle, backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', color: '#475569' };
    const deleteButtonStyle: React.CSSProperties = { ...baseButtonStyle, backgroundColor: '#fee2e2', borderColor: '#fecaca', color: '#b91c1c' };

    return (
        <div style={{ display: 'flex', gap: '8px' }}>
            {isRunning ? (
                <button onClick={() => handleCancelJob(job.job_id)} style={{...baseButtonStyle, backgroundColor: '#fff1f2', borderColor: '#ffcdd2', color: '#e53935' }}>Cancel</button>
            ) : status === 'failed' ? (
                <button onClick={() => handleTriggerJob(job.job_id)} style={{...baseButtonStyle, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' }}>Retry</button>
            ) : (
                <button onClick={() => handleTriggerJob(job.job_id)} style={actionButtonStyle}>Backup Now</button>
            )}

            <button onClick={() => handleToggleJobStatus(job)} disabled={isRunning} style={{...secondaryButtonStyle, cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.5 : 1 }}>
                {job.is_active ? 'Stop' : 'Start'}
            </button>
            <button onClick={() => openHistoryModal(job)} disabled={isRunning} style={{...secondaryButtonStyle, cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.5 : 1 }}>
                History
            </button>
            <button onClick={() => openEditJobModal(job)} disabled={isRunning} style={{...secondaryButtonStyle, cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.5 : 1 }}>
                Edit
            </button>
            <button onClick={() => handleDeleteJob(job.job_id)} disabled={isRunning} style={{...deleteButtonStyle, cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.5 : 1 }}>
                Delete
            </button>
        </div>
    );
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading dashboard...</div>;
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner-small { display: inline-block; width: 1em; height: 1em; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .75s linear infinite; }
      `}</style>
      <AddConnectionModal isOpen={isConnectionModalOpen} onClose={() => setIsConnectionModalOpen(false)} onAdd={handleAddConnection} />
      <AddJobModal isOpen={isJobModalOpen} onClose={() => { setIsJobModalOpen(false); setSelectedConnection(null); }} onAdd={handleAddJob} />
      <JobHistoryModal isOpen={isHistoryModalOpen} onClose={() => { setIsHistoryModalOpen(false); setSelectedJob(null); }} jobId={selectedJob?.job_id || null} />
      <EditJobModal isOpen={isEditJobModalOpen} onClose={() => { setIsEditJobModalOpen(false); setSelectedJob(null); }} onUpdate={handleUpdateJob} job={selectedJob} />
      <EditConnectionNameModal isOpen={isEditConnectionModalOpen} onClose={() => { setIsEditConnectionModalOpen(false); setSelectedConnection(null); }} onUpdate={handleUpdateConnectionName} connection={selectedConnection} />
      <NotificationModal isOpen={modalState.isOpen} title={modalState.title} message={modalState.message} type={modalState.type} onClose={() => setModalState({ ...modalState, isOpen: false })} onConfirm={modalState.onConfirm} />
      
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '32px', fontFamily: 'sans-serif' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827' }}>Client Dashboard</h1>
            <button onClick={handleLogout} style={{ padding: '8px 16px', fontWeight: '500', color: 'white', backgroundColor: '#dc2626', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Logout</button>
          </div>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Welcome, {client ? client.company_name : 'User'}!</h2>
            <p style={{ color: '#374151' }}>This is your dashboard. Here you will be able to see and manage all your CRM backup jobs.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>Connections & Backup Jobs</h2>
                <button onClick={() => setIsConnectionModalOpen(true)} style={{ padding: '8px 16px', fontWeight: '500', color: 'white', backgroundColor: '#4f46e5', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>+ Add New Connection</button>
              </div>
              {connections.length > 0 ? (
                connections.map(conn => (
                  <div key={conn.connection_id} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{conn.connection_name}</h3>
                            <button onClick={() => openEditConnectionModal(conn)} style={{ padding: '2px 6px', fontSize: '10px', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                        </div>
                        <div style={{display: 'flex', gap: '12px'}}>
                            <button onClick={() => openJobModal(conn)} style={{ padding: '6px 12px', fontSize: '14px', fontWeight: '500', color: '#4f46e5', backgroundColor: '#e0e7ff', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>+ Add Job</button>
                            <button onClick={() => handleDeleteConnection(conn.connection_id)} style={{ padding: '6px 12px', fontSize: '14px', fontWeight: '500', color: '#be123c', backgroundColor: '#fee2e2', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Delete</button>
                        </div>
                    </div>
                    <p style={{ fontSize: '14px', color: '#6b7280', textTransform: 'capitalize', marginTop: '-12px', marginBottom: '16px' }}>{conn.crm_type.replace('_', ' ')} - Connected on: {new Date(conn.created_at).toLocaleDateString()}</p>
                    {jobs[conn.connection_id] && jobs[conn.connection_id].length > 0 ? (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid #e5e7eb' }}>
                        {jobs[conn.connection_id].map(job => {
                          const status = jobStatuses[job.job_id];
                          const isRunning = status === 'in_progress';
                          return (
                          <li key={job.job_id} style={{ padding: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span>{job.job_name} ({job.schedule})</span>
                                {isRunning ? (
                                    <span style={{ marginLeft: '16px', padding: '4px 8px', fontSize: '12px', fontWeight: '600', borderRadius: '9999px', backgroundColor: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span className="spinner-small"></span>
                                        Running...
                                    </span>
                                ) : (
                                    <span style={{ marginLeft: '16px', padding: '4px 8px', fontSize: '12px', fontWeight: '600', borderRadius: '9999px', backgroundColor: job.is_active ? '#d1fae5' : '#f3f4f6', color: job.is_active ? '#065f46' : '#374151' }}>
                                    {job.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                )}
                            </div>
                            {renderJobActions(job)}
                          </li>
                        )})}
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
