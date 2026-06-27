import React from 'react';
import styles from '../../styles/components.module.css';

export function Table({ children, className = '', ...props }) {
  return (
    <div className={styles.tableContainer}>
      <table className={`${styles.table} ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = '', ...props }) {
  return <th className={`${styles.th} ${className}`} {...props}>{children}</th>;
}

export function Td({ children, className = '', ...props }) {
  return <td className={`${styles.td} ${className}`} {...props}>{children}</td>;
}

export function Tr({ children, className = '', ...props }) {
  return <tr className={`${styles.tr} ${className}`} {...props}>{children}</tr>;
}
