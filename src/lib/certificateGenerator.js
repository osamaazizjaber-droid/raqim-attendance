import { jsPDF } from 'jspdf';

/**
 * توليد شهادة الطالب بصيغة PDF باللغة العربية (A4 Landscape) بدقة وجودة عالية جداً.
 * يتم استخدام الـ Canvas لتنسيق الخطوط العربية بشكل سليم وحل مشكلة الحروف المتقطعة والمقلوبة تماماً.
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
  // الانتظار حتى تحميل جميع الخطوط في الصفحة (مثل خط Tajawal)
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch (e) {
      console.warn('Document fonts not ready yet:', e);
    }
  }

  return new Promise((resolve, reject) => {
    try {
      // 1. أبعاد الشهادة القياسية (A4 Landscape بدقة فائقة الوضوح 2970x2100)
      const width = 2970;
      const height = 2100;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // 2. تعبئة الخلفية بلون كريمي فاخر للشهادة (Soft Off-White/Cream)
      ctx.fillStyle = '#FCFBF7';
      ctx.fillRect(0, 0, width, height);

      // 3. رسم الإطارات والزخارف الجمالية
      // أ. إطار خارجي مزدوج كحلي داكن
      ctx.strokeStyle = '#0F172A'; // Slate-900
      ctx.lineWidth = 14;
      ctx.strokeRect(60, 60, width - 120, height - 120);

      // ب. إطار ذهبي زخرفي داخلي
      ctx.strokeStyle = '#C9A84C'; // Gold/Amber Accent
      ctx.lineWidth = 4;
      ctx.strokeRect(85, 85, width - 170, height - 170);

      // ج. رسم زخارف على الزوايا الأربعة للشهادة لإضفاء مظهر رسمي ملكي
      const drawCornerOrnament = (x, y, xDir, yDir) => {
        ctx.fillStyle = '#C9A84C';
        ctx.fillRect(x, y, xDir * 80, yDir * 8);
        ctx.fillRect(x, y, xDir * 8, yDir * 80);
      };
      drawCornerOrnament(100, 100, 1, 1);       // أعلى اليسار
      drawCornerOrnament(width - 100, 100, -1, 1); // أعلى اليمين
      drawCornerOrnament(100, height - 100, 1, -1); // أسفل اليسار
      drawCornerOrnament(width - 100, height - 100, -1, -1); // أسفل اليمين

      // 4. كتابة النصوص والترويسة
      ctx.fillStyle = '#1E293B';
      ctx.textAlign = 'right';
      ctx.font = '34px Tajawal, Arial, sans-serif';

      // أ. الترويسة اليمنى (الجامعة والكلية والقسم)
      ctx.fillText(`جامعة: ${university?.name || '-'}`, 2650, 200);
      ctx.fillText(`كلية: ${college?.name || '-'}`, 2650, 270);
      ctx.fillText(`قسم: ${department?.name || '-'}`, 2650, 340);

      // ب. الترويسة اليسرى (الوزارة ونوع الدراسة والمرحلة)
      ctx.textAlign = 'left';
      ctx.fillText('وزارة التعليم العالي والبحث العلمي', 320, 200);
      ctx.fillText(`الدراسة: ${student.study_type || 'صباحي'}`, 320, 270);
      ctx.fillText(`المرحلة: ${student.stages?.name || student.stage || '-'}`, 320, 340);

      // ج. البسملة في المنتصف
      ctx.textAlign = 'center';
      ctx.font = 'bold 40px Tajawal, Arial, sans-serif';
      ctx.fillText('بسم الله الرحمن الرحيم', width / 2, 220);

      // د. خطوط فاصلة ذهبية مع معين (Diamond) في المنتصف
      ctx.strokeStyle = '#C9A84C';
      ctx.lineWidth = 4;
      // الخط الأيمن
      ctx.beginPath();
      ctx.moveTo(150, 410);
      ctx.lineTo(width / 2 - 80, 410);
      ctx.stroke();
      // الخط الأيسر
      ctx.beginPath();
      ctx.moveTo(width / 2 + 80, 410);
      ctx.lineTo(width - 150, 410);
      ctx.stroke();
      // رسم المعين في المنتصف
      ctx.fillStyle = '#C9A84C';
      ctx.beginPath();
      ctx.moveTo(width / 2, 390);
      ctx.lineTo(width / 2 + 20, 410);
      ctx.lineTo(width / 2, 430);
      ctx.lineTo(width / 2 - 20, 410);
      ctx.closePath();
      ctx.fill();

      // هـ. عنوان الوثيقة
      ctx.font = 'bold 52px Tajawal, Arial, sans-serif';
      ctx.fillStyle = '#0F172A';
      ctx.fillText(`وثيقة نتائج امتحانات الطلبة للعام الدراسي ${academicYear}`, width / 2, 530);

      // و. تفاصيل الطالب
      ctx.font = 'bold 36px Tajawal, Arial, sans-serif';
      ctx.fillStyle = '#1E293B';
      ctx.textAlign = 'right';
      ctx.fillText(`اسم الطالب الكامل: ${student.full_name}`, 2650, 680);
      ctx.textAlign = 'left';
      ctx.fillText(`الرقم الجامعي: ${student.student_number}`, 320, 680);

      // 5. رسم جدول المواد والدرجات
      const drawTable = (list, startY) => {
        const tableWidth = 2330;
        const colWidth = tableWidth / list.length;
        const rowHeight = 110;

        ctx.strokeStyle = '#E2E8F0'; // Slate-200
        ctx.lineWidth = 2;

        list.forEach((item, index) => {
          const x = 320 + index * colWidth;

          // خلية الرأس (المادة والوحدات)
          ctx.fillStyle = '#0F172A'; // خلفية كحلي داكن
          ctx.fillRect(x, startY, colWidth, rowHeight);
          ctx.strokeRect(x, startY, colWidth, rowHeight);

          // كتابة اسم المادة والوحدات
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.font = 'bold 28px Tajawal, Arial, sans-serif';
          let courseName = item.courses?.name || 'مادة';
          if (courseName.length > 22) courseName = courseName.substring(0, 20) + '..';
          ctx.fillText(courseName, x + colWidth / 2, startY + 48);
          ctx.font = '22px Tajawal, Arial, sans-serif';
          ctx.fillStyle = '#94A3B8';
          ctx.fillText(`(وحدات: ${item.courses?.units || 1})`, x + colWidth / 2, startY + 85);

          // خلية التقدير
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, startY + rowHeight, colWidth, rowHeight);
          ctx.strokeRect(x, startY + rowHeight, colWidth, rowHeight);

          // رسم كبسولة تقدير الدرجة (Grade Capsule Badge)
          const grade = item.grade_label;
          const colors = {
            'امتياز': '#C9A84C',
            'جيد جداً': '#10B981',
            'جيد': '#3B82F6',
            'متوسط': '#F59E0B',
            'مقبول': '#6B7280',
            'ضعيف': '#EF4444'
          };
          const gradeColor = colors[grade] || '#6B7280';
          
          const badgeWidth = Math.min(colWidth - 50, 180);
          const badgeHeight = 55;
          const badgeX = x + (colWidth - badgeWidth) / 2;
          const badgeY = startY + rowHeight + (rowHeight - badgeHeight) / 2;

          ctx.fillStyle = gradeColor;
          const radius = badgeHeight / 2;
          ctx.beginPath();
          ctx.moveTo(badgeX + radius, badgeY);
          ctx.lineTo(badgeX + badgeWidth - radius, badgeY);
          ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + radius);
          ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - radius);
          ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - radius, badgeY + badgeHeight);
          ctx.lineTo(badgeX + radius, badgeY + badgeHeight);
          ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - radius);
          ctx.lineTo(badgeX, badgeY + radius);
          ctx.quadraticCurveTo(badgeX, badgeY, badgeX + radius, badgeY);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 24px Tajawal, Arial, sans-serif';
          ctx.fillText(grade, x + colWidth / 2, badgeY + badgeHeight / 2 + 8);
        });
      };

      const firstFive = results.slice(0, 5);
      const secondFive = results.slice(5, 10);

      let tableEndY = 760;
      if (firstFive.length > 0) {
        drawTable(firstFive, 760);
        tableEndY = 760 + 220;
      }

      if (secondFive.length > 0) {
        drawTable(secondFive, 1010);
        tableEndY = 1010 + 220;
      }

      // 6. التقدير العام والنتيجة النهائية مع محاذاة عمودية دقيقة وتجنب مشاكل علامات الترقيم في RTL
      const finalY = tableEndY + 120;

      const drawAlignedRow = (label, value, valueColor, y) => {
        // أ. كتابة العنوان (Label) محاذياً لليمين
        ctx.textAlign = 'right';
        ctx.fillStyle = '#475569'; // Slate-600
        ctx.font = 'bold 36px Tajawal, Arial, sans-serif';
        ctx.fillText(label, 2650, y);

        // ب. كتابة النقطتين الرأسيتين (Colon) في عمود محاذاة عمودي ثابت لتلافي مشاكل اتجاه الخطوط
        ctx.textAlign = 'center';
        ctx.fillStyle = '#475569';
        ctx.fillText(':', 2250, y);

        // ج. كتابة القيمة محاذية لليمين لتظهر متراصة بشكل متناسق مع العمود
        ctx.textAlign = 'right';
        ctx.fillStyle = valueColor;
        ctx.font = 'bold 38px Tajawal, Arial, sans-serif';
        ctx.fillText(value, 2220, y);
      };

      const statusColor = isPassed ? '#10B981' : '#EF4444';
      const statusText = isPassed ? 'ناجح' : 'راسب';
      drawAlignedRow('النتيجة الكلية للوثيقة', statusText, statusColor, finalY);

      const colorsMap = {
        'امتياز': '#C9A84C',
        'جيد جداً': '#10B981',
        'جيد': '#3B82F6',
        'متوسط': '#F59E0B',
        'مقبول': '#6B7280',
        'ضعيف': '#EF4444'
      };
      const overallColor = colorsMap[overallGrade] || '#475569';
      drawAlignedRow('التقدير العام للمعدل', overallGrade, overallColor, finalY + 75);

      // 7. التواقيع مع خطوط فاصلة أنيقة
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.moveTo(1950, finalY + 110);
      ctx.lineTo(2350, finalY + 110);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(600, finalY + 110);
      ctx.lineTo(1000, finalY + 110);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 30px Tajawal, Arial, sans-serif';
      ctx.fillText('توقيع رئيس القسم', 2150, finalY + 160);
      ctx.fillText('توقيع عميد الكلية', 800, finalY + 160);

      // 8. تحويل الكانفاس إلى صورة ودمجها بملف PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);

      resolve(pdf.output('blob'));
    } catch (err) {
      reject(err);
    }
  });
};
