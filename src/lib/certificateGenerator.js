import { jsPDF } from 'jspdf';

/**
 * Helper: load an Image from a URL, returns an HTMLImageElement.
 * Falls back gracefully if CORS or URL is invalid.
 */
const loadImage = (url) => new Promise((resolve) => {
  if (!url) return resolve(null);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = url;
});

/**
 * Draw a geometric seal/crest centered at (cx, cy) with given radius.
 * Used as a fallback when no logo image is provided.
 */
const drawGeometricSeal = (ctx, cx, cy, r, primaryColor = '#0F172A', accentColor = '#C9A84C', drawOuterBorders = false) => {
  // Outer ring
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.stroke();

  // Inner ring
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = r * 0.03;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, 2 * Math.PI);
  ctx.stroke();

  // Rays between rings
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI * 2) / 12;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = r * 0.025;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r * 0.82, cy + Math.sin(angle) * r * 0.82);
    ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    ctx.stroke();
  }

  // Star shape in center
  ctx.fillStyle = accentColor;
  const starPoints = 8;
  const innerR = r * 0.22;
  const outerR = r * 0.42;
  ctx.beginPath();
  for (let i = 0; i < starPoints * 2; i++) {
    const angle = (i * Math.PI) / starPoints - Math.PI / 2;
    const radius = i % 2 === 0 ? outerR : innerR;
    if (i === 0) ctx.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    else ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();

  // Center dot
  ctx.fillStyle = primaryColor;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.12, 0, 2 * Math.PI);
  ctx.fill();

  // Draw outer borders if requested (to match the logo image frame)
  if (drawOuterBorders) {
    const scale = r / 80;
    
    // Decorative gold ring
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 5 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6 * scale, 0, 2 * Math.PI);
    ctx.stroke();

    // Decorative slate ring
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 14 * scale, 0, 2 * Math.PI);
    ctx.stroke();
  }
};

/**
 * Draw a logo image centered at (cx, cy) fitting within maxSize x maxSize.
 * Draws a circular clip mask around it.
 */
const drawLogoImage = (ctx, img, cx, cy, maxSize) => {
  const r = maxSize / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.clip();

  const scale = Math.min(maxSize / img.width, maxSize / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();

  // Decorative ring around the logo
  ctx.strokeStyle = '#C9A84C';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 14, 0, 2 * Math.PI);
  ctx.stroke();
};

/**
 * توليد شهادة الطالب بصيغة PDF باللغة العربية (A4 Landscape).
 * تصميم أكاديمي رسمي فاخر: خلفية بيضاء نظيفة، شعار الجامعة أعلى اليسار،
 * شعار الكلية أعلى اليمين، جدول نتائج احترافي، توقيعات رسمية.
 */
export const generateCertificatePDF = async ({
  student,
  results,
  overallGrade,
  isPassed,
  academicYear,
  university,
  college,
  department,
  universityLogoUrl = null,
  collegeLogoUrl = null,
}) => {
  // Pre-load logo image (university logo preferred, college logo as fallback)
  const logoUrl = universityLogoUrl || collegeLogoUrl;
  const logoImg = await loadImage(logoUrl);

  const W = 1414;
  const H = 2000;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ─────────────────────────────────────────
  // 1. BACKGROUND — clean formal white
  // ─────────────────────────────────────────
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Subtle page-edge shadow gradient
  const topShadow = ctx.createLinearGradient(0, 0, 0, 80);
  topShadow.addColorStop(0, 'rgba(15,23,42,0.02)');
  topShadow.addColorStop(1, 'rgba(15,23,42,0)');
  ctx.fillStyle = topShadow;
  ctx.fillRect(0, 0, W, 80);

  // ─────────────────────────────────────────
  // 2. OUTER DOUBLE BORDER (Formal dark blue / black)
  // ─────────────────────────────────────────
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2;
  ctx.strokeRect(52, 52, W - 104, H - 104);

  // ─────────────────────────────────────────
  // 3. DYNAMIC VERTICAL CENTERING CALCULATIONS
  // ─────────────────────────────────────────
  const logoSize = 150;
  const headerHeight = 220; // Includes logo and text
  const titleHeight = 120;
  const studentRowHeight = 70;
  
  const rowH = 65; // Height of table rows
  const tableHeaderH = 65;
  const tableHeight = tableHeaderH + results.length * rowH;
  
  const totalContentHeight = headerHeight + 40 + titleHeight + 30 + studentRowHeight + 40 + tableHeight + 80;
  const startY = Math.max(80, (H - totalContentHeight) / 2);

  // Helper for drawing rounded rect
  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // ─────────────────────────────────────────
  // 4. FAINT WATERMARK (centre)
  // ─────────────────────────────────────────
  ctx.save();
  ctx.globalAlpha = 0.03;
  drawGeometricSeal(ctx, W / 2, H / 2 + 80, 260, '#0F172A', '#C9A84C');
  ctx.globalAlpha = 1;
  ctx.restore();

  // ─────────────────────────────────────────
  // 5. HEADER LOGO & TEXT (Left, Center, Right)
  // ─────────────────────────────────────────
  // A. Center Logo
  const logoCY = startY + logoSize / 2;
  if (logoImg) {
    drawLogoImage(ctx, logoImg, W / 2, logoCY, logoSize);
  } else {
    drawGeometricSeal(ctx, W / 2, logoCY, logoSize / 2, '#0F172A', '#C9A84C', true);
  }

  // B. Right Aligned Text
  ctx.fillStyle = '#0F172A';
  ctx.textAlign = 'right';
  ctx.font = 'bold 24px Tajawal, Arial, sans-serif';
  ctx.fillText('وزارة التعليم العالي والبحث العلمي', W - 100, startY + 50);
  ctx.fillText(university?.name || college?.university || 'كلية السلام الجامعة', W - 100, startY + 95);
  ctx.fillText(`قسم ${department?.name || '-'}`, W - 100, startY + 140);

  // C. Left Aligned Text
  ctx.textAlign = 'left';
  ctx.font = 'bold 22px Tajawal, Arial, sans-serif';
  const stageName = student.stages?.name || student.stage || '-';
  const studyTypeText = student.study_type === 'مسائي' ? 'المسائية' : 'الصباحية';
  ctx.fillText(`المرحلة: ${stageName}`, 100, startY + 50);
  ctx.fillText(`الدراسة: ${studyTypeText}`, 100, startY + 95);

  // ─────────────────────────────────────────
  // 6. TITLE
  // ─────────────────────────────────────────
  const titleY = startY + logoSize + 40;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 36px Tajawal, Arial, sans-serif';
  ctx.fillText('النتيجة النهائية', W / 2, titleY);
  
  ctx.font = 'bold 30px Tajawal, Arial, sans-serif';
  ctx.fillText(academicYear, W / 2, titleY + 45);

  ctx.font = '22px Tajawal, Arial, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('ملاحظة: لا تعتبر هذه النتيجة وثيقة رسمية.', W / 2, titleY + 90);

  // ─────────────────────────────────────────
  // 7. STUDENT INFO ROW
  // ─────────────────────────────────────────
  const studentY = titleY + 120;
  const boxW = W - 200; // 1214 px
  const boxX = 100;
  const labelW = 280;
  const nameW = boxW - labelW;

  // Outer border of student box
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(boxX, studentY, boxW, studentRowHeight);

  // Right cell: header ("اسم الطالب")
  ctx.fillStyle = '#E5E7EB'; // light gray
  ctx.fillRect(boxX + nameW, studentY, labelW, studentRowHeight);
  ctx.strokeRect(boxX + nameW, studentY, labelW, studentRowHeight);

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 24px Tajawal, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('اسم الطالب', boxX + nameW + labelW / 2, studentY + studentRowHeight / 2 + 8);

  // Left cell: student name value
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(boxX, studentY, nameW, studentRowHeight);
  
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 24px Tajawal, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(student.full_name, boxX + nameW / 2, studentY + studentRowHeight / 2 + 8);

  // ─────────────────────────────────────────
  // 8. SIDE-BY-SIDE TABLES
  // ─────────────────────────────────────────
  const tablesStartY = studentY + studentRowHeight + 40;
  const tableLeftX = 100;
  const statusBoxW = 240;
  const gap = 40;
  
  const mainTableX = tableLeftX + statusBoxW + gap;
  const mainTableW = W - 100 - mainTableX;

  // A. DRAW OVERALL STATUS TABLE (Left side)
  const statusRowH = 65;
  
  const drawStatusCell = (x, y, w, h, bg, text, isHeader, textColor = '#000000') => {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, w, h);
    
    ctx.fillStyle = textColor;
    ctx.font = isHeader ? 'bold 22px Tajawal, Arial, sans-serif' : 'bold 24px Tajawal, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + h / 2 + 8);
  };

  const statusColor = isPassed ? '#047857' : '#B91C1C';
  const statusText = isPassed ? 'ناجح' : 'راسب';
  
  drawStatusCell(tableLeftX, tablesStartY, statusBoxW, statusRowH, '#E5E7EB', 'النتيجة', true);
  drawStatusCell(tableLeftX, tablesStartY + statusRowH, statusBoxW, statusRowH, '#FFFFFF', statusText, false, statusColor);
  drawStatusCell(tableLeftX, tablesStartY + statusRowH * 2, statusBoxW, statusRowH, '#E5E7EB', 'التقدير', true);
  drawStatusCell(tableLeftX, tablesStartY + statusRowH * 3, statusBoxW, statusRowH, '#FFFFFF', overallGrade || 'غير متوفر', false, statusColor);

  // B. DRAW MAIN SUBJECTS TABLE (Right side)
  // Header row
  const subColW = mainTableW * 0.70; // 70% for subject name
  const gradeColW = mainTableW - subColW; // 30% for grade label

  // Draw table header
  ctx.fillStyle = '#E5E7EB';
  ctx.fillRect(mainTableX, tablesStartY, subColW, tableHeaderH);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(mainTableX, tablesStartY, subColW, tableHeaderH);

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 22px Tajawal, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('المادة', mainTableX + subColW / 2, tablesStartY + tableHeaderH / 2 + 8);

  ctx.fillStyle = '#E5E7EB';
  ctx.fillRect(mainTableX + subColW, tablesStartY, gradeColW, tableHeaderH);
  ctx.strokeRect(mainTableX + subColW, tablesStartY, gradeColW, tableHeaderH);

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 22px Tajawal, Arial, sans-serif';
  ctx.fillText('التقدير', mainTableX + subColW + gradeColW / 2, tablesStartY + tableHeaderH / 2 + 8);

  // Draw subject rows
  results.forEach((item, index) => {
    const rowY = tablesStartY + tableHeaderH + index * rowH;
    
    // Draw subject name & units cell
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(mainTableX, rowY, subColW, rowH);
    ctx.strokeRect(mainTableX, rowY, subColW, rowH);
    
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px Tajawal, Arial, sans-serif';
    ctx.textAlign = 'center';
    
    const units = item.courses?.units || 1;
    const courseText = `${item.courses?.name || 'مادة'} (${units})`;
    ctx.fillText(courseText, mainTableX + subColW / 2, rowY + rowH / 2 + 8);

    // Draw grade cell
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(mainTableX + subColW, rowY, gradeColW, rowH);
    ctx.strokeRect(mainTableX + subColW, rowY, gradeColW, rowH);
    
    const grade = item.grade_label || '';
    const gradeColors = {
      'امتياز': '#B45309',
      'جيد جداً': '#047857',
      'جيد': '#1D4ED8',
      'متوسط': '#D97706',
      'مقبول': '#4B5563',
      'ضعيف': '#B91C1C',
    };
    ctx.fillStyle = gradeColors[grade] || '#000000';
    ctx.font = 'bold 20px Tajawal, Arial, sans-serif';
    ctx.fillText(grade, mainTableX + subColW + gradeColW / 2, rowY + rowH / 2 + 8);
  });

  // ─────────────────────────────────────────
  // 9. EXPORT AS PDF
  // ─────────────────────────────────────────
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
  return pdf.output('blob');
};
