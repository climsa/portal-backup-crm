// File: src/components/EditJobModal.tsx - Diperbaiki
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

// Definisikan tipe data untuk kejelasan
interface Module {
  api_name: string;
  display_name: string;
}

interface BackupJob {
  job_id: string;
  job_name: string;
  schedule: string;
  // PERBAIKAN: Menggunakan selected_data sesuai dengan skema database
  selected_data: { modules?: string[] };
  connection_id: string;
}

type UpdatedJobPayload = { job_name: string; schedule: string; selected_data: { modules: string[] } };

interface EditJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (jobId: string, data: UpdatedJobPayload) => void;
  job: BackupJob | null;
}

const EditJobModal: React.FC<EditJobModalProps> = ({ isOpen, onClose, onSave, job }) => {
  const [jobName, setJobName] = useState('');
  const [schedule, setSchedule] = useState('daily');
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && job) {
      setJobName(job.job_name);
      setSchedule(job.schedule);
      // PERBAIKAN: Membaca dari job.selected_data, bukan job.metadata
      setSelectedModules(job.selected_data?.modules || []);

      const fetchModules = async () => {
        setLoading(true);
        setError(null);
        try {
          const token = localStorage.getItem('token');
          const api = axios.create({
            baseURL: API_BASE_URL,
            headers: { Authorization: `Bearer ${token}` },
          });
          const response = await api.get(`/zoho/modules/${job.connection_id}`);
          setAllModules(response.data);
        } catch (err) {
          setError('Failed to load available modules. Please try again.');
          console.error('Failed to fetch modules:', err);
        } finally {
          setLoading(false);
        }
      };

      fetchModules();
    }
  }, [isOpen, job]);

  const handleModuleChange = (apiName: string) => {
    setSelectedModules(prev =>
      prev.includes(apiName)
        ? prev.filter(name => name !== apiName)
        : [...prev, apiName]
    );
  };

  const handleSave = () => {
    if (!job) return;
    const updatedData = {
      job_name: jobName,
      schedule,
      // PERBAIKAN: Mengirim data sebagai selected_data
      selected_data: { modules: selectedModules },
    };
    onSave(job.job_id, updatedData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', width: '400px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Edit Backup Job</h2>
        
        <label>Job Name</label>
        <input
          type="text"
          value={jobName}
          onChange={(e) => setJobName(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '12px', border: '1px solid #ccc', borderRadius: '4px' }}
        />

        <label>Schedule</label>
        <select
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '12px', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>

        <label>Modules to Backup</label>
        <div style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '8px', height: '150px', overflowY: 'auto' }}>
          {loading && <p>Loading modules...</p>}
          {error && <p style={{ color: 'red' }}>{error}</p>}
          {!loading && !error && allModules.map(module => (
            <div key={module.api_name}>
              <input
                type="checkbox"
                id={module.api_name}
                checked={selectedModules.includes(module.api_name)}
                onChange={() => handleModuleChange(module.api_name)}
              />
              <label htmlFor={module.api_name} style={{ marginLeft: '8px' }}>{module.display_name}</label>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: '4px' }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: '8px 16px', border: 'none', backgroundColor: '#4f46e5', color: 'white', borderRadius: '4px' }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default EditJobModal;
