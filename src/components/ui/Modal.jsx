import React from 'react';
import { X } from 'lucide-react';
import styles from '../../styles/components.module.css';

export function Modal({ isOpen, onClose, title, children, footer, size = 'md' }) {
  if (!isOpen) return null;

  const getMaxWidth = () => {
    switch (size) {
      case 'lg': return '850px';
      case 'xl': return '1100px';
      default: return '500px';
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} style={{ maxWidth: getMaxWidth() }} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{title}</h3>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {children}
        </div>
        {footer && (
          <div className={styles.modalFooter}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
