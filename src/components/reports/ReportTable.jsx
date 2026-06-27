import React from 'react';
import { Table, Tr, Th, Td } from '../ui/Table';
import { TableSkeleton } from '../ui/Skeleton';
import { AlertCircle } from 'lucide-react';
import styles from '../../styles/components.module.css';

/**
 * مكون لعرض جداول التقارير بشكل مرن يدعم التحميل والبيانات الفارغة.
 */
export function ReportTable({ headers, data, loading, emptyMessage }) {
  if (loading) {
    return <TableSkeleton rows={6} cols={headers.length} />;
  }

  if (!data || data.length === 0) {
    return (
      <div className={styles.emptyState}>
        <AlertCircle size={40} className={styles.emptyStateIcon} />
        <h4 className={styles.emptyStateTitle}>لا توجد بيانات لعرضها</h4>
        <p className={styles.emptyStateText}>{emptyMessage || 'لم يتم العثور على أي سجلات مطابقة للبحث.'}</p>
      </div>
    );
  }

  return (
    <Table>
      <thead>
        <Tr>
          {headers.map((header) => (
            <Th key={header.key}>{header.label}</Th>
          ))}
        </Tr>
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <Tr key={row.id || idx}>
            {headers.map((header) => {
              const val = row[header.key];
              return (
                <Td key={header.key}>
                  {header.render 
                    ? header.render(val, row) 
                    : (val !== undefined && val !== null ? String(val) : '-')}
                </Td>
              );
            })}
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
