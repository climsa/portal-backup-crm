// File: src/components/JobHistoryModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface JobHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
}

interface JobHistory {
  log_id: number;
  status: string;
  start_time: string;
  end_time: string | null;
  details: string;
}

const JobHistoryModal: React.FC<JobHistoryModalProps> = ({ isOpen, onClose, jobId }) => {
  const [history, setHistory] = useState<JobHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchHistory = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const api = axios.create({
        baseURL: 'http://localhost:3000/api',
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await api.get(`/history/${jobId}`);
      setHistory(res.data);
    } catch (error) {
      console.error('Failed to load job history:', error);
      // Dihilangkan: alert('Failed to load job history.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, fetchHistory]);

  const handleDownload = (logId: number) => {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No token found for download.');
        return;
    }
    // Menggunakan window.location.href akan memicu unduhan di browser
    const downloadUrl = `http://localhost:3000/api/backups/${logId}/download?token=${token}`;
    window.location.href = downloadUrl;
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', width: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Job History</h2>
        {loading ? (
          <p>Loading history...</p>
        ) : history.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {history.map((log) => (
              <li key={log.log_id} style={{ padding: '12px 0', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: '600' }}>
                      Status: <span style={{ textTransform: 'capitalize' }}>{log.status}</span>
                    </p>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>
                      Started: {new Date(log.start_time).toLocaleString()}
                    </p>
                  </div>
                  {log.status === 'success' && (
                    <button
                      onClick={() => handleDownload(log.log_id)}
                      style={{ padding: '6px 12px', fontSize: '14px', color: 'white', backgroundColor: '#16a34a', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                    >
                      Download Result
                    </button>
                  )}
                </div>
                <p style={{ fontSize: '14px', color: '#374151', marginTop: '8px', wordBreak: 'break-all' }}>
                  Details: {log.details}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No history found for this job.</p>
        )}
        <div style={{ marginTop: '24px', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontWeight: '500', color: '#374151', backgroundColor: '#e5e7eb', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobHistoryModal;
