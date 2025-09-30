import React, { useState, useEffect, ChangeEvent } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

interface Module {
  api_name: string;
  plural_label: string;
}

interface AddJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (jobDetails: { job_name: string; schedule: string; selected_data: { modules: string[] } }) => void;
}

const AddJobModal: React.FC<AddJobModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [jobName, setJobName] = useState('');
  const [schedule, setSchedule] = useState('daily');
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Reset state saat modal dibuka
      setJobName('');
      setSchedule('daily');
      setSelectedModules([]);
      setError('');

      const fetchModules = async () => {
        setLoading(true);
        try {
          const token = localStorage.getItem('token');
          const api = axios.create({
            baseURL: API_BASE_URL,
            headers: { 'Authorization': `Bearer ${token}` },
          });
          const res = await api.get('/zoho/modules');
          setModules(res.data);
        } catch (err) {
          console.error('Failed to fetch modules:', err);
          setError('Failed to load available modules from Zoho.');
        } finally {
          setLoading(false);
        }
      };
      fetchModules();
    }
  }, [isOpen]);

  const handleModuleChange = (apiName: string) => {
    setSelectedModules(prev =>
      prev.includes(apiName)
        ? prev.filter(name => name !== apiName)
        : [...prev, apiName]
    );
  };

  const handleAddClick = () => {
    if (jobName && schedule && selectedModules.length > 0) {
      onAdd({
        job_name: jobName,
        schedule,
        selected_data: { modules: selectedModules },
      });
    } else {
      alert('Please provide a job name and select at least one module to back up.');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '500px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Add New Backup Job</h2>
        
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="job-name" style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Job Name</label>
          <input id="job-name" type="text" value={jobName} onChange={(e: ChangeEvent<HTMLInputElement>) => setJobName(e.target.value)} placeholder="e.g., Daily Production Backup" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}/>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="schedule" style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Schedule</label>
          <select id="schedule" value={schedule} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSchedule(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Modules to Backup</label>
          {loading ? <p>Loading modules from Zoho...</p> : error ? <p style={{color: 'red'}}>{error}</p> : (
            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: '4px', padding: '12px' }}>
              {modules.map(module => (
                <div key={module.api_name} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <input type="checkbox" id={module.api_name} checked={selectedModules.includes(module.api_name)} onChange={() => handleModuleChange(module.api_name)} style={{ height: '16px', width: '16px' }} />
                  <label htmlFor={module.api_name} style={{ marginLeft: '8px' }}>{module.plural_label}</label>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '500', color: '#374151', backgroundColor: '#f3f4f6', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleAddClick} style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '500', color: 'white', backgroundColor: '#4f46e5', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Add Job</button>
        </div>
      </div>
    </div>
  );
};

export default AddJobModal;
