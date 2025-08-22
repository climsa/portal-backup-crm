import React from 'react';

interface NotificationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void; // Dibuat opsional, jika ada, ini adalah dialog konfirmasi
  type?: 'success' | 'error' | 'confirm';
}

const NotificationModal: React.FC<NotificationModalProps> = ({ isOpen, title, message, onClose, onConfirm, type = 'success' }) => {
  if (!isOpen) {
    return null;
  }

  const isConfirmation = !!onConfirm;

  const getTitleColor = () => {
    switch (type) {
      case 'error': return '#dc2626'; // red-600
      case 'success': return '#16a34a'; // green-600
      default: return '#111827'; // gray-900
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '450px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: getTitleColor() }}>{title}</h2>
        <p style={{ color: '#374151', marginBottom: '24px' }}>{message}</p>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
          {!isConfirmation ? (
            <button
              onClick={onClose}
              style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '500', color: 'white', backgroundColor: '#4f46e5', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            >
              OK
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '500', color: '#374151', backgroundColor: '#f3f4f6', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if(onConfirm) onConfirm();
                  onClose();
                }}
                style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '500', color: 'white', backgroundColor: '#dc2626', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
              >
                Confirm
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
