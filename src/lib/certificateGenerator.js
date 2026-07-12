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
  const cacheBuster = url.includes('?') ? `&_t=${Date.now()}` : `?_t=${Date.now()}`;
  img.src = url + cacheBuster;
});

/**
 * Helper: shield-style emblem — no circle anywhere
 * Used as a fallback when no logo image is provided or for the background watermark.
 */
const drawUniversityLogo = (ctx, cx, cy, r, primaryColor = '#0F172A', accentColor = '#C9A84C') => {
  const w = r * 1.7;
  const h = r * 2.1;
  const x = cx - w / 2;
  const top = cy - h / 2;

  ctx.save();

  // Outer shield outline
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x + w, top);
  ctx.lineTo(x + w, top + h * 0.58);
  ctx.bezierCurveTo(x + w, top + h * 0.82, cx + w * 0.15, top + h * 0.94, cx, top + h);
  ctx.bezierCurveTo(cx - w * 0.15, top + h * 0.94, x, top + h * 0.82, x, top + h * 0.58);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = r * 0.09;
  ctx.strokeStyle = primaryColor;
  ctx.stroke();

  // Inner inset shield line
  const inset = r * 0.16;
  ctx.beginPath();
  ctx.moveTo(x + inset, top + inset);
  ctx.lineTo(x + w - inset, top + inset);
  ctx.lineTo(x + w - inset, top + h * 0.58);
  ctx.bezierCurveTo(x + w - inset, top + h * 0.78, cx + (w - 2 * inset) * 0.12, top + h * 0.90, cx, top + h - inset * 1.4);
  ctx.bezierCurveTo(cx - (w - 2 * inset) * 0.12, top + h * 0.90, x + inset, top + h * 0.78, x + inset, top + h * 0.58);
  ctx.closePath();
  ctx.lineWidth = r * 0.035;
  ctx.strokeStyle = accentColor;
  ctx.stroke();

  // Central star mark
  ctx.fillStyle = accentColor;
  const starPoints = 6;
  const innerR = r * 0.16;
  const outerR = r * 0.34;
  const starCY = cy - r * 0.08;
  ctx.beginPath();
  for (let i = 0; i < starPoints * 2; i++) {
    const angle = (i * Math.PI) / starPoints - Math.PI / 2;
    const radius = i % 2 === 0 ? outerR : innerR;
    const px = cx + Math.cos(angle) * radius;
    const py = starCY + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // Base line under the star, inside the shield
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = r * 0.03;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.4, top + h * 0.68);
  ctx.lineTo(cx + r * 0.4, top + h * 0.68);
  ctx.stroke();

  ctx.restore();
};

/**
 * Draw a logo image centered at (cx, cy) fitting within maxSize x maxSize.
 * Drawn directly without circular clipping or border rings.
 */
const drawLogoImage = (ctx, img, cx, cy, maxSize) => {
  const scale = Math.min(maxSize / img.width, maxSize / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
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
  roundName = 'الكورس الأول',
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

  const drawAll = (imgToUse) => {
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
    const titleHeight = 105;
    const studentRowHeight = 70;
    
    const rowH = 65; // Height of table rows
    const tableHeaderH = 65;
    const tableHeight = tableHeaderH + results.length * rowH;
    
    const totalContentHeight = headerHeight + 40 + titleHeight + 30 + studentRowHeight + 40 + tableHeight + 80;
    const startY = Math.max(80, (H - totalContentHeight) / 2);

    // ─────────────────────────────────────────
    // 4. FAINT WATERMARK (centre)
    // ─────────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.08;
    if (imgToUse) {
      // Draw the actual loaded logo image as a large transparent watermark in the background
      const watermarkSize = 520;
      const scale = Math.min(watermarkSize / imgToUse.width, watermarkSize / imgToUse.height);
      const w = imgToUse.width * scale;
      const h = imgToUse.height * scale;
      ctx.drawImage(imgToUse, W / 2 - w / 2, H / 2 + 80 - h / 2, w, h);
    } else {
      // Fallback: draw the university shield emblem
      drawUniversityLogo(ctx, W / 2, H / 2 + 40, 240, '#0F172A', '#C9A84C');
    }
    ctx.restore();

    // ─────────────────────────────────────────
    // 5. HEADER LOGO & TEXT (Left, Center, Right)
    // ─────────────────────────────────────────
    // A. Center Logo
    const logoCY = startY + logoSize / 2;
    if (imgToUse) {
      drawLogoImage(ctx, imgToUse, W / 2, logoCY, logoSize);
    } else {
      drawUniversityLogo(ctx, W / 2, logoCY, logoSize / 2, '#0F172A', '#C9A84C');
    }

    // B. Right Aligned Text
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'right';
    ctx.font = 'bold 24px Tajawal, Arial, sans-serif';
    ctx.fillText('وزارة التعليم العالي والبحث العلمي', W - 100, startY + 50);
    ctx.fillText(college?.name || university?.name || college?.university || 'كلية السلام الجامعة', W - 100, startY + 95);
    const deptName = (department?.name || '-').trim();
    const displayDept = deptName.startsWith('قسم') ? deptName : `قسم ${deptName}`;
    ctx.fillText(displayDept, W - 100, startY + 140);

    // C. Left Aligned Text
    ctx.textAlign = 'left';
    ctx.font = 'bold 22px Tajawal, Arial, sans-serif';
    
    const stageObj = student.stages || student.stage;
    const stageName = 
      (stageObj && typeof stageObj === 'object' && !Array.isArray(stageObj) && stageObj.name) ||
      (Array.isArray(stageObj) && stageObj[0]?.name) ||
      (typeof stageObj === 'string' && stageObj) ||
      '-';

    const studyTypeText = student.study_type === 'مسائي' ? 'المسائية' : 'الصباحية';
    ctx.fillText(`المرحلة: ${stageName}`, 100, startY + 50);
    ctx.fillText(`الدراسة: ${studyTypeText}`, 100, startY + 95);
    
    const displayRound = roundName.replace('الكورس ', '').replace('الدور ', '');
    ctx.fillText(`الكورس: ${displayRound}`, 100, startY + 140);

    // ─────────────────────────────────────────
    // 6. TITLE
    // ─────────────────────────────────────────
    const titleY = startY + logoSize + 75; // Increased gap between logo and academic year
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 36px Tajawal, Arial, sans-serif';
    ctx.fillText(academicYear, W / 2, titleY);

    ctx.font = '22px Tajawal, Arial, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('ملاحظة: لا تعتبر هذه النتيجة وثيقة رسمية.', W / 2, titleY + 45);

    // ─────────────────────────────────────────
    // 7. STUDENT INFO ROW
    // ─────────────────────────────────────────
    const studentY = titleY + 100; // Adjusted spacing to flow cleanly
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
    drawStatusCell(tableLeftX, tablesStartY + statusRowH * 3, statusBoxW, statusRowH, '#FFFFFF', overallGrade || 'غير متوفر', false, '#000000');

    // B. DRAW MAIN SUBJECTS TABLE (Right side - RTL orientation)
    const subColW = mainTableW * 0.70;
    const gradeColW = mainTableW - subColW;
    const gradeColX = mainTableX;
    const subColX = mainTableX + gradeColW;

    // Header row — التقدير (left portion)
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(gradeColX, tablesStartY, gradeColW, tableHeaderH);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(gradeColX, tablesStartY, gradeColW, tableHeaderH);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px Tajawal, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('التقدير', gradeColX + gradeColW / 2, tablesStartY + tableHeaderH / 2 + 8);

    // Header row — المادة (right portion)
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(subColX, tablesStartY, subColW, tableHeaderH);
    ctx.strokeRect(subColX, tablesStartY, subColW, tableHeaderH);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px Tajawal, Arial, sans-serif';
    ctx.fillText('المادة', subColX + subColW / 2, tablesStartY + tableHeaderH / 2 + 8);

    // Draw subject rows
    results.forEach((item, index) => {
      const rowY = tablesStartY + tableHeaderH + index * rowH;
      
      // التقدير cell (left portion)
      const grade = item.grade_label || '';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(gradeColX, rowY, gradeColW, rowH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(gradeColX, rowY, gradeColW, rowH);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 20px Tajawal, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(grade, gradeColX + gradeColW / 2, rowY + rowH / 2 + 8);

      // المادة cell (right portion)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(subColX, rowY, subColW, rowH);
      ctx.strokeRect(subColX, rowY, subColW, rowH);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 20px Tajawal, Arial, sans-serif';
      const units = item.courses?.units || 1;
      ctx.fillText(`${item.courses?.name || 'مادة'} (${units})`, subColX + subColW / 2, rowY + rowH / 2 + 8);
    });
  };

  // ─────────────────────────────────────────
  // 9. EXPORT AS PDF
  // ─────────────────────────────────────────
  let imgData;
  try {
    drawAll(logoImg);
    imgData = canvas.toDataURL('image/jpeg', 0.92);
  } catch (err) {
    console.warn('Canvas tainted by logo image CORS, retrying without logo:', err);
    ctx.clearRect(0, 0, W, H);
    drawAll(null);
    imgData = canvas.toDataURL('image/jpeg', 0.92);
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
  return pdf.output('blob');
};
