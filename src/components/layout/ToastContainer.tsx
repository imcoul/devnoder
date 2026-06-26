import React, { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $toasts, Toast } from '../../stores/ui';
import './ToastContainer.css';

function ToastItem({ toast }: { toast: Toast }) {
  const icons: Record<Toast['type'], string> = {
    info: 'ℹ', success: '✓', error: '✕', warn: '⚠',
  };
  return (
    <div className={`toast toast--${toast.type}`} role="alert" aria-live="polite">
      <span className="toast-icon">{icons[toast.type]}</span>
      <span className="toast-msg">{toast.message}</span>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useStore($toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" aria-label="Notifications">
      {toasts.map(t => <ToastItem key={t.id} toast={t} />)}
    </div>
  );
}
