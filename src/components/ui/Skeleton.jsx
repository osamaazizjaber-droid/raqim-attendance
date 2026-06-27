import React from 'react';
import styles from '../../styles/components.module.css';

export function Skeleton({ width, height, className = '', style = {} }) {
  return (
    <div 
      className={`${styles.skeleton} ${className}`}
      style={{
        width: width || '100%',
        height: height || '1.25rem',
        ...style
      }}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', padding: '1rem' }}>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} style={{ display: 'flex', gap: '1rem', width: '100%' }}>
          {Array.from({ length: cols }).map((_, cIdx) => (
            <Skeleton key={cIdx} height="2.5rem" style={{ flex: 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
