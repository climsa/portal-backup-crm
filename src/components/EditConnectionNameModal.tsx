import React, { useState, useEffect, ChangeEvent } from 'react';

interface CrmConnection {
  connection_id: string;
  connection_name: string;
}

interface EditConnectionNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (connectionId: string, newName: string) => void;
  connection: CrmConnection | null;
}

const EditConnectionNameModal: React.FC<EditConnectionNameModalProps> = ({ isOpen, onClose, onUpdate, connection }) => {
  const [name, setName] = useState('');

  useEffect(() => {
    // Isi form dengan nama koneksi saat ini ketika modal dibuka
    if (connection) {
      setName(connection.connection_name);
    }
  }, [connection]);

  if (!isOpen || !connection) {
    return null;
  }

  const handleUpdateClick = () => {
    if (name) {
      onUpdate(connection.connection_id, name);
    } else {
      alert('Connection name cannot be empty.');
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '450px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Edit Connection Name</h2>
        
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="edit-connection-name" style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
            Connection Name
          </label>
          <input
            id="edit-connection-name"
            type="text"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
          />
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
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditConnectionNameModal;
