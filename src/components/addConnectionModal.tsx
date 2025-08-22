import React, { useState, ChangeEvent } from 'react';

interface AddConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (details: { crmType: string; connectionName: string }) => void;
}

const AddConnectionModal: React.FC<AddConnectionModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [selectedCrm, setSelectedCrm] = useState<string>('zoho_crm');
  const [connectionName, setConnectionName] = useState<string>('');

  if (!isOpen) {
    return null;
  }

  const handleAddClick = () => {
    if (selectedCrm && connectionName) {
      // Panggil fungsi onAdd yang diteruskan dari Dashboard
      onAdd({ crmType: selectedCrm, connectionName });
    } else {
      alert('Please provide a name for the connection.');
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '450px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Add New CRM Connection</h2>
        
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="connection-name" style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
            Connection Name
          </label>
          <input
            id="connection-name"
            type="text"
            value={connectionName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setConnectionName(e.target.value)}
            placeholder="e.g., Production Zoho Account"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            required
          />
        </div>

        <div>
          <label htmlFor="crm-type" style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
            Select CRM Platform
          </label>
          <select
            id="crm-type"
            value={selectedCrm}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedCrm(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
          >
            <option value="zoho_crm">Zoho CRM</option>
            <option value="salesforce" disabled>Salesforce (Not Implemented)</option>
            <option value="hubspot" disabled>HubSpot (Not Implemented)</option>
            <option value="odoo" disabled>Odoo (Not Implemented)</option>
          </select>
        </div>

        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '16px' }}>
          You will be redirected to the CRM login page to provide secure authorization.
        </p>

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
            Connect
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddConnectionModal;
