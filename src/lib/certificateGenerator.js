import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// دالة لجلب خط Amiri العربي وتحويله إلى Base64 في المتصفح ديناميكياً لتفادي تضخيم حجم الكود
let cachedFontBase64 = null;

async function fetchAmiriFontBase64() {
  if (cachedFontBase64) return cachedFontBase64;
  try {
    const url = 'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf';
    const response = await fetch(url);
    if (!response.ok) throw new Error('فشل تحميل ملف خط Amiri');
    const buffer = await response.arrayBuffer();
    
    // تحويل الـ ArrayBuffer إلى سلسلة Base64
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    cachedFontBase64 = window.btoa(binary);
    return cachedFontBase64;
  } catch (error) {
    console.error('Error loading Arabic font:', error);
    return null;
  }
}

/**
 * توليد شهادة الطالب بصيغة PDF باللغة العربية (A4 Landscape)
 */
export const generateCertificatePDF = async ({
  student,
  results,
  overallGrade,
  isPassed,
  academicYear,
  university,
  college,
  department
}) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // 1. تحميل الخط وتسجيله
  const fontBase64 = await fetchAmiriFontBase64();
  if (fontBase64) {
    doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    doc.setFont('Amiri');
  }

  // دعم اللغة العربية والـ RTL
  doc.setR2L(true);

  // 2. رسم الخلفية والإطارات الجمالية للشهادة
  const width = 297; // A4 Landscape
  const height = 210;

  // إطار خارجي مزدوج
  doc.setDrawColor(15, 23, 42); // Navy (#0F172A)
  doc.setLineWidth(1.5);
  doc.rect(8, 8, width - 16, height - 16);

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, width - 20, height - 20);

  // 3. الترويسة العليا (Header)
  doc.setFontSize(12);
  doc.text(`جامعة: ${university?.name || '-'}`, 280, 20, { align: 'right' });
  doc.text(`كلية: ${college?.name || '-'}`, 280, 27, { align: 'right' });
  doc.text(`قسم: ${department?.name || '-'}`, 280, 34, { align: 'right' });

  doc.text('بسم الله الرحمن الرحيم', width / 2, 22, { align: 'center' });
  doc.setFontSize(11);
  doc.text('وزارة التعليم العالي والبحث العلمي', 20, 20);
  doc.text(`الدراسة: ${student.study_type || 'صباحي'}`, 20, 27);
  doc.text(`المرحلة: ${student.stages?.name || student.stage || '-'}`, 20, 34);

  // خط زخرفي فاصل
  doc.setDrawColor(245, 158, 11); // Amber
  doc.setLineWidth(0.8);
  doc.line(15, 42, width - 15, 42);

  // 4. عنوان الشهادة
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(`نتائج امتحانات الطلبة للعام الدراسي ${academicYear}`, width / 2, 54, { align: 'center' });

  // 5. اسم الطالب
  doc.setFontSize(13);
  doc.setFont(undefined, 'normal');
  doc.text(`اسم الطالب الكامل: ${student.full_name}`, 280, 68, { align: 'right' });
  doc.text(`الرقم الجامعي: ${student.student_number}`, 20, 68);

  // 6. تحضير جدول المواد (حد أقصى 10 مواد، تقسم على صفين كحد أقصى 5 مواد للصف)
  const firstFive = results.slice(0, 5);
  const secondFive = results.slice(5, 10);

  // رسم الصف الأول من الجدول
  if (firstFive.length > 0) {
    const headRow = firstFive.map(r => `${r.courses?.name || 'مادة'}\n(وحدات: ${r.courses?.units || 1})`);
    const bodyRow = firstFive.map(r => r.grade_label);

    doc.autoTable({
      startY: 76,
      head: [headRow],
      body: [bodyRow],
      styles: { 
        font: fontBase64 ? 'Amiri' : 'helvetica', 
        halign: 'center', 
        valign: 'middle', 
        fontSize: 10,
        textColor: '#0f172a',
        cellPadding: 4
      },
      headStyles: {
        fillColor: '#f1f5f9',
        textColor: '#0f172a',
        fontStyle: 'bold'
      },
      theme: 'grid'
    });
  }

  // رسم الصف الثاني من الجدول إن وجد مواد أخرى
  if (secondFive.length > 0) {
    const headRow2 = secondFive.map(r => `${r.courses?.name || 'مادة'}\n(وحدات: ${r.courses?.units || 1})`);
    const bodyRow2 = secondFive.map(r => r.grade_label);

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 4,
      head: [headRow2],
      body: [bodyRow2],
      styles: { 
        font: fontBase64 ? 'Amiri' : 'helvetica', 
        halign: 'center', 
        valign: 'middle', 
        fontSize: 10,
        textColor: '#0f172a',
        cellPadding: 4
      },
      headStyles: {
        fillColor: '#f1f5f9',
        textColor: '#0f172a',
        fontStyle: 'bold'
      },
      theme: 'grid'
    });
  }

  // 7. خلاصة التقدير العام والنتيجة
  const finalY = doc.lastAutoTable.finalY + 16;
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  
  // النتيجة (ناجح / راسب)
  const statusText = isPassed ? 'ناجح' : 'راسب';
  doc.text(`النتيجة الكلية: [ ${statusText} ]`, 280, finalY, { align: 'right' });
  
  // التقدير العام المحسوب
  doc.text(`التقدير العام للمعدل: [ ${overallGrade} ]`, 280, finalY + 8, { align: 'right' });

  // تواقيع الكلية
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.text('توقيع رئيس القسم', 220, finalY + 22, { align: 'center' });
  doc.text('توقيع عميد الكلية', 70, finalY + 22, { align: 'center' });

  return doc.output('blob');
};
