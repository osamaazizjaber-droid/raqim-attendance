import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import styles from '../../styles/components.module.css';

const ToastContext = createContext({
  showToast: (title, message, type = 'info', duration = 3000) => {}
});

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((title, message, type = 'info', duration = 3000) => {
    setToasts((prev) => {
      // 1. منع تكرار نفس الإشعار إذا كان معروضاً حالياً على الشاشة
      const existing = prev.find((t) => t.title === title && t.message === message);
      if (existing) {
        // إعادة تعيين وقت الإشعار الحالي دون مضاعفة البطاقات
        if (timersRef.current.has(existing.id)) {
          clearTimeout(timersRef.current.get(existing.id));
        }
        const timer = setTimeout(() => {
          removeToast(existing.id);
        }, duration);
        timersRef.current.set(existing.id, timer);
        return prev;
      }

      const id = Date.now() + Math.random();
      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);

      // 2. تقليص عدد الإشعارات المتزامنة إلى إشعارين فقط كحد أقصى لمنع حجب واجهة المسح
      const MAX_TOASTS = 2;
      const nextList = [...prev, { id, title, message, type }];
      while (nextList.length > MAX_TOASTS) {
        const removed = nextList.shift();
        if (timersRef.current.has(removed.id)) {
          clearTimeout(timersRef.current.get(removed.id));
          timersRef.current.delete(removed.id);
        }
      }
      return nextList;
    });
  }, [removeToast]);

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={18} />;
      case 'danger': return <AlertCircle size={18} />;
      case 'warning': return <AlertTriangle size={18} />;
      default: return <Info size={18} />;
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
      <div className={styles.toastContainer} aria-live="polite">
        {toasts.map((toast) => (
          <div 
            key={toast.id} 
            className={`${styles.toast} ${getToastTypeClass(toast.type)}`}
            onClick={() => removeToast(toast.id)}
            role="alert"
          >
            <div className={styles.toastIconWrapper}>
              {getIcon(toast.type)}
            </div>
            <div className={styles.toastContent}>
              {toast.title && <div className={styles.toastTitle}>{toast.title}</div>}
              {toast.message && <div className={styles.toastMessage}>{toast.message}</div>}
            </div>
            <button 
              type="button"
              className={styles.toastClose} 
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              aria-label="إغلاق التنبيه"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
