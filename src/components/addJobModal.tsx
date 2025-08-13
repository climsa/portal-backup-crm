import React, { useState, ChangeEvent } from 'react';

interface AddJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (jobDetails: { job_name: string; schedule: string }) => void;
}

const AddJobModal: React.FC<AddJobModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [jobName, setJobName] = useState('');
  const [schedule, setSchedule] = useState('daily');

  if (!isOpen) {
    return null;
  }

  const handleAddClick = () => {
    if (jobName && schedule) {
      onAdd({ job_name: jobName, schedule });
    } else {
      alert('Please fill in all fields.');
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '450px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Add New Backup Job</h2>
        
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="job-name" style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
            Job Name
          </label>
          <input
            id="job-name"
            type="text"
            value={jobName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setJobName(e.target.value)}
            placeholder="e.g., Daily Production Backup"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
          />
        </div>

        <div>
          <label htmlFor="schedule" style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
            Schedule
          </label>
          <select
            id="schedule"
            value={schedule}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSchedule(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '500', color: '#374151', backgroundColor: '#f3f4f6', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleAddClick}
            style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '500', color: 'white', backgroundColor: '#4f46e5', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
          >
            Add Job
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddJobModal;
