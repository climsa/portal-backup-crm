import React, { useState, useEffect, ChangeEvent } from 'react';

interface BackupJob {
  job_id: string;
  job_name: string;
  schedule: string;
  is_active: boolean;
}

interface EditJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (jobId: string, jobDetails: { job_name: string; schedule: string; is_active: boolean }) => void;
  job: BackupJob | null;
}

const EditJobModal: React.FC<EditJobModalProps> = ({ isOpen, onClose, onUpdate, job }) => {
  const [jobName, setJobName] = useState('');
  const [schedule, setSchedule] = useState('daily');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    // Isi form dengan data pekerjaan saat ini ketika modal dibuka
    if (job) {
      setJobName(job.job_name);
      setSchedule(job.schedule);
      setIsActive(job.is_active);
    }
  }, [job]);

  if (!isOpen || !job) {
    return null;
  }

  const handleUpdateClick = () => {
    if (jobName && schedule) {
      onUpdate(job.job_id, { job_name: jobName, schedule, is_active: isActive });
    } else {
      alert('Please fill in all fields.');
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '450px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Edit Backup Job</h2>
        
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="edit-job-name" style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
            Job Name
          </label>
          <input
            id="edit-job-name"
            type="text"
            value={jobName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setJobName(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="edit-schedule" style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
            Schedule
          </label>
          <select
            id="edit-schedule"
            value={schedule}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSchedule(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <input
                id="edit-is-active"
                type="checkbox"
                checked={isActive}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setIsActive(e.target.checked)}
                style={{ height: '16px', width: '16px' }}
            />
            <label htmlFor="edit-is-active" style={{ marginLeft: '8px', fontSize: '14px', color: '#374151' }}>
                Job is Active
            </label>
        </div>

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '500', color: '#374151', backgroundColor: '#f3f4f6', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleUpdateClick}
            style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '500', color: 'white', backgroundColor: '#4f46e5', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
          >
            Update Job
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditJobModal;
