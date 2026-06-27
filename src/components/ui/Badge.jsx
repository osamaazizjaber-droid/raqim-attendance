import React from 'react';
import styles from '../../styles/components.module.css';

export function Badge({ children, variant = 'info', className = '' }) {
  const getVariantClass = () => {
    switch (variant) {
      case 'success': return styles.badgeSuccess;
      case 'danger': return styles.badgeDanger;
      case 'warning': return styles.badgeWarning;
      default: return styles.badgeInfo;
    }
  };

  return (
    <span className={`${styles.badge} ${getVariantClass()} ${className}`}>
      {children}
    </span>
  );
}
