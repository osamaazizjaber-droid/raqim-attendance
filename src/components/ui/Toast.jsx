import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import styles from '../../styles/components.module.css';

const ToastContext = createContext({
  showToast: (title, message, type = 'info', duration = 3000) => {}
});

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((title, message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, title, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle style={{ color: 'var(--success)' }} size={20} />;
      case 'danger': return <AlertCircle style={{ color: 'var(--danger)' }} size={20} />;
      case 'warning': return <AlertTriangle style={{ color: 'var(--warning)' }} size={20} />;
      default: return <Info style={{ color: 'var(--accent)' }} size={20} />;
    }
  };

  const getToastTypeClass = (type) => {
    switch (type) {
      case 'success': return styles.toastSuccess;
      case 'danger': return styles.toastDanger;
      case 'warning': return styles.toastWarning;
      default: return styles.toastInfo;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={styles.toastContainer}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${getToastTypeClass(toast.type)}`}>
            {getIcon(toast.type)}
            <div className={styles.toastContent}>
              {toast.title && <div className={styles.toastTitle}>{toast.title}</div>}
              {toast.message && <div className={styles.toastMessage}>{toast.message}</div>}
            </div>
            <button className={styles.toastClose} onClick={() => removeToast(toast.id)}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
