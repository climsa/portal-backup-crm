import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

import AddConnectionModal from './AddConnectionModal';
import AddJobModal from './AddJobModal';
import JobHistoryModal from './JobHistoryModal';
import EditJobModal from './EditJobModal';
import EditConnectionNameModal from './EditConnectionNameModal';
import NotificationModal from './NotificationModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

// --- Tipe Data ---
interface DecodedToken { client: { id: string; }; }
interface ClientData { client_id: string; company_name: string; }
interface CrmConnection { connection_id: string; crm_type: string; connection_name: string; created_at: string; }
interface BackupJob { job_id: string; connection_id: string; job_name: string; schedule: string; is_active: boolean; selected_data: { modules?: string[] } }
interface JobHistory { history_id: string; status: string; started_at: string; file_path?: string; }
interface JobWithHistory extends BackupJob { latest_history?: JobHistory; }
interface NotificationState { isOpen: boolean; message: string; type: 'success' | 'error' | 'confirm'; onConfirm?: () => void; }

// --- Komponen Utama ---
const Dashboard = () => {
    // --- State Declarations ---
    const [client, setClient] = useState<ClientData | null>(null);
    const [connections, setConnections] = useState<CrmConnection[]>([]);
    const [jobs, setJobs] = useState<{ [key: string]: JobWithHistory[] }>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [notification, setNotification] = useState<NotificationState>({ isOpen: false, message: '', type: 'success' });

    // State untuk mengelola visibilitas modal
    const [isAddConnectionModalOpen, setIsAddConnectionModalOpen] = useState(false);
    const [isAddJobModalOpen, setIsAddJobModalOpen] = useState(false);
    const [isEditJobModalOpen, setIsEditJobModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isEditConnectionNameModalOpen, setIsEditConnectionNameModalOpen] = useState(false);

    // State untuk menyimpan item yang sedang dipilih
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
    const [selectedJob, setSelectedJob] = useState<BackupJob | null>(null);
    const [selectedConnection, setSelectedConnection] = useState<CrmConnection | null>(null);

    // --- Fungsi Utilitas ---
    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ isOpen: true, message, type });
    };

    const showConfirmation = (message: string, onConfirm: () => void) => {
        setNotification({ isOpen: true, message, type: 'confirm', onConfirm });
    };

    const handleLogout = useCallback(() => {
        localStorage.removeItem('token');
        window.location.href = '/login';
    }, []);

    // --- Fungsi Pengambilan Data ---
    const fetchData = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) { setLoading(false); return; }
        try {
            const decoded = jwtDecode<DecodedToken>(token);
            const clientId = decoded.client.id;
            const api = axios.create({
                baseURL: API_BASE_URL,
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const [clientRes, connectionsRes, jobsRes, historyRes] = await Promise.all([
                api.get(`/clients/${clientId}`),
                api.get('/connections'),
                api.get('/jobs'),
                api.get('/history/latest-statuses')
            ]);

            setClient(clientRes.data);
            setConnections(connectionsRes.data);

            const latestHistoriesArray = (historyRes.data as Array<JobHistory & { job_id: string }>)
                .map((h) => [h.job_id, h] as [string, JobHistory]);
            const latestHistories = new Map<string, JobHistory>(latestHistoriesArray);

            const jobsByConnection: { [key: string]: JobWithHistory[] } = {};
            connectionsRes.data.forEach((conn: CrmConnection) => {
                jobsByConnection[conn.connection_id] = [];
            });
            jobsRes.data.forEach((job: BackupJob) => {
                const jobWithHistory: JobWithHistory = { ...job, latest_history: latestHistories.get(job.job_id) };
                if (jobsByConnection[job.connection_id]) {
                    jobsByConnection[job.connection_id].push(jobWithHistory);
                }
            });
            setJobs(jobsByConnection);

        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                handleLogout();
            }
        } finally {
            setLoading(false);
        }
    }, [handleLogout]);

    // --- UseEffects ---
    useEffect(() => {
        setLoading(true);
        fetchData();

        const params = new URLSearchParams(window.location.search);
        const error = params.get('error');
        const success = params.get('success');
        if (error) {
            showNotification(`Connection failed: ${decodeURIComponent(error)}`, 'error');
            window.history.replaceState({}, document.title, "/dashboard");
        }
        if (success) {
            showNotification("Connection successful!", 'success');
            window.history.replaceState({}, document.title, "/dashboard");
        }
    }, [fetchData]);

    useEffect(() => {
        const interval = setInterval(() => {
            const hasRunningJob = Object.values(jobs).flat().some(job => job.latest_history?.status === 'in_progress');
            if (hasRunningJob) {
                console.log('Refreshing data due to running job...');
                fetchData();
            }
        }, 15000);

        return () => clearInterval(interval);
    }, [jobs, fetchData]);
    
    // --- Handler Aksi Pengguna ---
    const handleAddConnection = ({ crmType, connectionName }: { crmType: string; connectionName: string }) => {
        const token = localStorage.getItem('token');
        if (!token) {
            alert("Token tidak ditemukan. Silakan login ulang.");
            return;
        }
        const existingConnection = connections.find(c => c.crm_type === crmType);
        const url = `${API_BASE_URL}/auth/${crmType}/connect?token=${token}&connectionName=${encodeURIComponent(connectionName)}`;

        if (existingConnection) {
            showConfirmation(
                `A connection for ${crmType.replace('_', ' ')} already exists. Do you want to re-authenticate and update it?`,
                () => {
                window.location.href = url;
                }
            );
        } else {
            window.location.href = url;
        }
    };

    
    const handleAddJob = async (jobDetails: { job_name: string; schedule: string; selected_data: { modules: string[] } }) => {
        if (!selectedConnectionId) return;
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/jobs`, {
                connection_id: selectedConnectionId,
                ...jobDetails
            }, { headers: { 'Authorization': `Bearer ${token}` } });
            showNotification(`Backup job "${jobDetails.job_name}" added successfully!`);
            setIsAddJobModalOpen(false);
            fetchData();
        } catch {
            showNotification('Failed to add new backup job.', 'error');
        }
    };

    const handleEditJob = async (jobId: string, jobDetails: { job_name: string; schedule: string; selected_data: { modules: string[] } }) => {
        if (!selectedJob) return;
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/jobs/${jobId}`, jobDetails, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            showNotification('Job updated successfully!');
            setIsEditJobModalOpen(false);
            fetchData();
        } catch {
            showNotification('Failed to update job.', 'error');
        }
    };

    const handleEditConnectionName = async (id: string, newName: string) => {
        if (!selectedConnection) return;
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/connections/${id}`, {
                connection_name: newName
            }, { headers: { 'Authorization': `Bearer ${token}` } });
            showNotification('Connection name updated successfully!');
            setIsEditConnectionNameModalOpen(false);
            fetchData();
        } catch {
            showNotification('Failed to update connection name.', 'error');
        }
    };

    const handleDeleteConnection = (connectionId: string) => {
        showConfirmation('Are you sure you want to delete this connection? All associated backup jobs will also be deleted.', async () => {
            try {
                const token = localStorage.getItem('token');
                await axios.delete(`${API_BASE_URL}/connections/${connectionId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                showNotification('Connection deleted successfully.');
                fetchData();
            } catch {
                showNotification('Failed to delete connection.', 'error');
            }
        });
    };

    const handleDeleteJob = (jobId: string) => {
        showConfirmation('Are you sure you want to delete this backup job?', async () => {
            try {
                const token = localStorage.getItem('token');
                await axios.delete(`${API_BASE_URL}/jobs/${jobId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                showNotification('Backup job deleted successfully.');
                fetchData();
            } catch {
                showNotification('Failed to delete backup job.', 'error');
            }
        });
    };

    const handleToggleJobStatus = async (job: BackupJob) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/jobs/${job.job_id}`, {
                is_active: !job.is_active
            }, { headers: { 'Authorization': `Bearer ${token}` } });
            showNotification(`Job status updated to ${!job.is_active ? 'Active' : 'Inactive'}.`);
            fetchData();
        } catch {
            showNotification('Failed to update job status.', 'error');
        }
    };

    const triggerJobAction = async (jobId: string, action: 'run' | 'cancel' | 'retry' | 'restore') => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/jobs/${jobId}/${action}`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            showNotification(`Job action '${action}' triggered successfully.`);
            fetchData();
        } catch (error) {
            console.error(`Failed to trigger ${action}:`, error);
            const errorMessage = axios.isAxiosError(error) && error.response?.data?.msg 
                ? error.response.data.msg 
                : `Failed to trigger job action '${action}'.`;
            showNotification(errorMessage, 'error');
        }
    };

    // --- JSX Rendering ---
    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading dashboard...</div>;
    return (
      <>
        <NotificationModal
            isOpen={notification.isOpen}
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification({ ...notification, isOpen: false })}
            onConfirm={notification.onConfirm}
        />
        <AddConnectionModal isOpen={isAddConnectionModalOpen} onClose={() => setIsAddConnectionModalOpen(false)} onAdd={handleAddConnection} />
        <AddJobModal isOpen={isAddJobModalOpen} onClose={() => setIsAddJobModalOpen(false)} onAdd={handleAddJob} />
        {selectedJob && <JobHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} jobId={selectedJob.job_id} />}
        {selectedJob && <EditJobModal isOpen={isEditJobModalOpen} onClose={() => setIsEditJobModalOpen(false)} onSave={handleEditJob} job={selectedJob} />}
        {selectedConnection && <EditConnectionNameModal isOpen={isEditConnectionNameModalOpen} onClose={() => setIsEditConnectionNameModalOpen(false)} onUpdate={handleEditConnectionName} connection={selectedConnection} />}

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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>Connections & Backup Jobs</h2>
                        <button onClick={() => setIsAddConnectionModalOpen(true)} style={{ padding: '8px 16px', fontWeight: '500', color: 'white', backgroundColor: '#4f46e5', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
                            + Add New Connection
                        </button>
                    </div>
                    {connections.length > 0 ? (
                        connections.map(conn => (
                            <div key={conn.connection_id} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '600', textTransform: 'capitalize' }}>
                                            {conn.connection_name}
                                            <button onClick={() => { setSelectedConnection(conn); setIsEditConnectionNameModalOpen(true); }} style={{ marginLeft: '8px', border: 'none', background: 'none', cursor: 'pointer' }}>✏️</button>
                                        </h3>
                                        <p style={{ fontSize: '14px', color: '#6b7280' }}>{conn.crm_type.replace('_', ' ')} - Connected on: {new Date(conn.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                                        <button onClick={() => { setSelectedConnectionId(conn.connection_id); setIsAddJobModalOpen(true); }} style={{ padding: '6px 12px', fontSize: '14px', fontWeight: '500', color: '#4f46e5', backgroundColor: '#e0e7ff', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
                                            + Add Job
                                        </button>
                                        <button onClick={() => handleDeleteConnection(conn.connection_id)} style={{ padding: '6px 12px', fontSize: '14px', fontWeight: '500', color: '#dc2626', backgroundColor: '#fee2e2', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                {jobs[conn.connection_id] && jobs[conn.connection_id].length > 0 ? (
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid #e5e7eb' }}>
                                        {jobs[conn.connection_id].map(job => (
                                            <li key={job.job_id} style={{ padding: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
                                                <div style={{ flex: '1 1 200px', marginBottom: '8px' }}>
                                                    <span>{job.job_name} ({job.schedule})</span>
                                                    <div style={{display: 'inline-flex', alignItems: 'center', marginLeft: '12px'}}>
                                                        <span style={{
                                                            padding: '4px 8px', fontSize: '12px', fontWeight: '600', borderRadius: '9999px',
                                                            backgroundColor: job.latest_history?.status === 'in_progress' ? '#FEF3C7' : (job.is_active ? '#d1fae5' : '#f3f4f6'),
                                                            color: job.latest_history?.status === 'in_progress' ? '#92400E' : (job.is_active ? '#065f46' : '#374151')
                                                        }}>
                                                            {job.latest_history?.status === 'in_progress' ? 'Running...' : (job.is_active ? 'Active' : 'Inactive')}
                                                        </span>
                                                        {job.latest_history?.status === 'in_progress' && (
                                                            <div style={{ width: '16px', height: '16px', border: '2px solid #D97706', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginLeft: '8px' }}></div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                    {job.latest_history?.status === 'in_progress' ? (
                                                        <button onClick={() => triggerJobAction(job.job_id, 'cancel')} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer'}}>Cancel</button>
                                                    ) : job.latest_history?.status === 'failed' ? (
                                                        <button onClick={() => triggerJobAction(job.job_id, 'retry')} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', borderRadius: '4px', cursor: 'pointer'}}>Retry</button>
                                                    ) : (
                                                        <button onClick={() => triggerJobAction(job.job_id, 'run')} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: '4px', cursor: 'pointer'}}>Backup Now</button>
                                                    )}
                                                    <button
                                                      onClick={() => {
                                                        if (job.latest_history?.status === 'success') {
                                                          showConfirmation('Restore from latest successful backup?', () => triggerJobAction(job.job_id, 'restore'));
                                                        } else {
                                                          showNotification('No successful backup found to restore.', 'error');
                                                        }
                                                      }}
                                                      style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe', borderRadius: '4px', cursor: 'pointer' }}
                                                    >
                                                      Restore
                                                    </button>
                                                    <button onClick={() => handleToggleJobStatus(job)} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: job.is_active ? '#FEF3C7' : '#E0E7FF', color: job.is_active ? '#92400E' : '#3730A3', border: `1px solid ${job.is_active ? '#FDE68A' : '#C7D2FE'}`, borderRadius: '4px', cursor: 'pointer' }}>{job.is_active ? 'Stop' : 'Start'}</button>
                                                    <button onClick={() => { setSelectedJob(job); setIsHistoryModalOpen(true); }} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #E5E7EB', borderRadius: '4px', cursor: 'pointer' }}>History</button>
                                                    <button onClick={() => { setSelectedJob(job); setIsEditJobModalOpen(true); }} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #E5E7EB', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                                                    <button onClick={() => handleDeleteJob(job.job_id)} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#F3F4F6', color: '#4B5563', border: '1px solid #E5E7EB', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
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
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </>
    );
};

export default Dashboard;
