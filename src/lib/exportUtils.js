import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

/**
 * تصدير البيانات إلى ملف Excel يدعم اللغة العربية.
 * @param {Array<Object>} data البيانات المراد تصديرها
 * @param {Array<string>} headers العناوين المخصصة للأعمدة بالترتيب
 * @param {string} fileName اسم الملف عند التحميل
 */
export function exportToExcel(data, headers, fileName = 'تقرير_حضور') {
  // تحويل البيانات لشكل متوافق مع العناوين العربية
  const formattedData = data.map(row => {
    const newRow = {};
    headers.forEach(header => {
      newRow[header.label] = row[header.key] !== undefined ? row[header.key] : '';
    });
    return newRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  
  // ضبط اتجاه الورقة من اليمين إلى اليسار (RTL) في Excel
  worksheet['!dir'] = 'rtl';
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'الحضور');
  
  XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * تصدير البيانات إلى ملف PDF يدعم اللغة العربية بشكل مثالي وخامات فائقة الوضوح.
 * بما أن مكتبة jsPDF لا تدعم تشكيل الحروف العربية واتجاه الكتابة (RTL) بشكل تلقائي وتُظهر الحروف مقطوعة ومعكوسة،
 * نقوم بإنشاء نافذة طباعة مخصصة ومصممة بأسلوب راقٍ تدعم الطباعة المباشرة وحفظ الملف كـ PDF بجودة متجهة عالية (Vector PDF).
 * @param {string} title عنوان التقرير الرئيسي
 * @param {Array<Object>} headers تعاريف الأعمدة [{ key: '...', label: '...' }]
 * @param {Array<Object>} dataصفوف البيانات
 * @param {string} fileName اسم افتراضي للملف عند الحفظ
 */
export function exportToPDF(title, headers, data, fileName = 'تقرير_حضور') {
  // بناء محتوى التقرير كـ HTML متكامل مع خط Tajawal ودعم RTL
  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
        
        body {
          font-family: 'Tajawal', Arial, sans-serif;
          margin: 15mm 15mm;
          color: #0f172a;
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        /* ترويسة التقرير الرسمية بنمط رقيم */
        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 25px;
        }
        
        .logo-title {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: 0.5px;
        }
        
        .logo-sub {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }
        
        .meta-info {
          text-align: left;
          font-size: 12px;
          color: #475569;
          line-height: 1.6;
        }
        
        .report-title {
          font-size: 16px;
          font-weight: 700;
          text-align: center;
          margin: 20px 0;
          color: #1e293b;
          background-color: #f1f5f9;
          padding: 8px 15px;
          border-radius: 6px;
        }
        
        /* تنسيق جدول البيانات */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        
        th {
          background-color: #0f172a !important;
          color: #ffffff !important;
          font-weight: 700;
          font-size: 12px;
          padding: 10px 8px;
          border: 1px solid #1e293b;
          text-align: center;
        }
        
        td {
          padding: 8px 10px;
          font-size: 11px;
          border: 1px solid #cbd5e1;
          text-align: center;
          color: #334155;
        }
        
        tr:nth-child(even) td {
          background-color: #f8fafc !important;
        }
        
        /* تذييل التقرير */
        .report-footer {
          margin-top: 40px;
          border-top: 1px solid #e2e8f0;
          padding-top: 15px;
          text-align: center;
          font-size: 10px;
          color: #94a3b8;
        }
        
        @media print {
          body {
            margin: 10mm 10mm;
          }
          
          thead {
            display: table-header-group;
          }
          
          tr {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="report-header">
        <div>
          <div class="logo-title">رَقِيم — RAQIM</div>
          <div class="logo-sub">نظام إدارة حضور وتسجيل الطلاب الذكي</div>
        </div>
        <div class="meta-info">
          <div><strong>تاريخ التصدير:</strong> ${new Date().toLocaleDateString('ar-EG')}</div>
          <div><strong>الوقت:</strong> ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
      
      <div class="report-title">${title}</div>
      
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map((row, idx) => `
            <tr>
              ${headers.map(h => {
                const val = row[h.key];
                let displayVal = '';
                if (typeof val === 'boolean') {
                  displayVal = val ? 'حاضر' : 'غائب';
                } else {
                  displayVal = val !== undefined && val !== null ? String(val) : '-';
                }
                return `<td>${displayVal}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="report-footer">
        هذا التقرير تم توليده تلقائياً عبر منصة رقيم الرقمية لإدارة وحصر غيابات الطلاب.
      </div>
    </body>
    </html>
  `;
  
  // إنشاء iframe مخفي في الصفحة لتنفيذ عملية الطباعة دون إفساد واجهة المستخدم الحالية
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);
  
  const pri = iframe.contentWindow;
  pri.document.open();
  pri.document.write(htmlContent);
  pri.document.close();
  
  // ننتظر تحميل الإطارات والخطوط ثم نقوم بالطباعة
  setTimeout(() => {
    pri.focus();
    pri.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 800);
}
