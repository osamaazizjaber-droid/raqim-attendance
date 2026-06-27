import React from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import { exportToExcel, exportToPDF } from '../../lib/exportUtils';

/**
 * مكون يحتوي على أزرار التصدير إلى Excel و PDF.
 */
export function ExportButtons({ title, headers, data, fileName, disabled = false }) {
  const handleExcelExport = () => {
    exportToExcel(data, headers, fileName);
  };

  const handlePDFExport = () => {
    exportToPDF(title, headers, data, fileName);
  };

  return (
    <div style={{ display: 'flex', gap: '0.75rem', margin: '1rem 0' }}>
      <Button 
        variant="outline" 
        onClick={handleExcelExport} 
        disabled={disabled || !data || data.length === 0}
        icon={FileSpreadsheet}
      >
        تصدير Excel
      </Button>
      <Button 
        variant="outline" 
        onClick={handlePDFExport} 
        disabled={disabled || !data || data.length === 0}
        icon={FileText}
      >
        تصدير PDF
      </Button>
    </div>
  );
}
