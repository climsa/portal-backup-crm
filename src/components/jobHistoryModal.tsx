import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface JobHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
}

interface JobHistoryLog {
  log_id: string;
  status: 'success' | 'failed';
  start_time: string;
  end_time: string;
  data_transferred_gb: number;
  details: string;
}

const JobHistoryModal: React.FC<JobHistoryModalProps> = ({ isOpen, onClose, jobId }) => {
  const [history, setHistory] = useState<JobHistoryLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && jobId) {
      const fetchHistory = async () => {
        setLoading(true);
        try {
          const token = localStorage.getItem('token');
          const api = axios.create({
            baseURL: 'http://localhost:3000/api',
            headers: { 'x-auth-token': token },
          });
          const res = await api.get('/history', { params: { jobId } });
          setHistory(res.data);
        } catch (error) {
          console.error('Failed to fetch job history:', error);
          alert('Failed to fetch history.');
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [isOpen, jobId]);

  if (!isOpen) {
    return null;
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '600px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Backup Job History</h2>
        
        {loading ? (
          <p>Loading history...</p>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {history.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {history.map(log => (
                  <li key={log.log_id} style={{ padding: '12px 0', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', color: log.status === 'success' ? '#16a34a' : '#dc2626', textTransform: 'capitalize' }}>
                        {log.status}
                      </span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {new Date(log.start_time).toLocaleString()}
                      </span>
                    </div>
                    <p style={{ fontSize: '14px', color: '#374151', marginTop: '4px' }}>{log.details}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No history found for this job.</p>
            )}
          </div>
        )}

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '500', color: '#374151', backgroundColor: '#f3f4f6', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobHistoryModal;
