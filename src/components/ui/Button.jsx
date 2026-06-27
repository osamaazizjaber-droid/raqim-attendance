import React from 'react';
import styles from '../../styles/components.module.css';

export function Button({ 
  children, 
  variant = 'primary', // primary, secondary, danger, outline
  onClick, 
  type = 'button', 
  disabled = false,
  className = '',
  icon: Icon
}) {
  const getVariantClass = () => {
    switch(variant) {
      case 'secondary': return styles.btnSecondary;
      case 'danger': return styles.btnDanger;
      case 'outline': return styles.btnOutline;
      default: return styles.btnPrimary;
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${styles.btn} ${getVariantClass()} ${disabled ? styles.btnDisabled : ''} ${className}`}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
}
