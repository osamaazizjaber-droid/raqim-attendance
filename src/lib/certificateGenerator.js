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
  // Pre-load logo images concurrently
  const [universityLogoImg, collegeLogoImg] = await Promise.all([
    loadImage(universityLogoUrl),
    loadImage(collegeLogoUrl),
  ]);

  // Optimized canvas: A4 Landscape at 240 dpi (2000x1414 instead of 2970x2100)
  // Same aspect ratio, 55% less pixels → ~4x faster rendering
  const W = 2000;
  const H = 1414;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ─────────────────────────────────────────
  // 1. BACKGROUND — clean formal white
  // ─────────────────────────────────────────
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Subtle page-edge shadow gradient (top and left)
  const topShadow = ctx.createLinearGradient(0, 0, 0, 80);
  topShadow.addColorStop(0, 'rgba(15,23,42,0.04)');
  topShadow.addColorStop(1, 'rgba(15,23,42,0)');
  ctx.fillStyle = topShadow;
  ctx.fillRect(0, 0, W, 80);

  // ─────────────────────────────────────────
  // 2. OUTER DOUBLE BORDER
  // ─────────────────────────────────────────
  // Main slate border
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 10;
  ctx.strokeRect(38, 38, W - 76, H - 76);

  // Gold inner border
  ctx.strokeStyle = '#C9A84C';
  ctx.lineWidth = 3;
  ctx.strokeRect(56, 56, W - 112, H - 112);

  // ─────────────────────────────────────────
  // 3. CORNER ORNAMENTS
  // ─────────────────────────────────────────
  const drawCorner = (x, y, dx, dy) => {
    ctx.fillStyle = '#C9A84C';
    ctx.fillRect(x, y, dx * 70, dy * 5);
    ctx.fillRect(x, y, dx * 5, dy * 70);
    ctx.fillRect(x + dx * 18, y + dy * 18, dx * 34, dy * 3);
    ctx.fillRect(x + dx * 18, y + dy * 18, dx * 3, dy * 34);
    ctx.beginPath();
    ctx.arc(x + dx * 58, y + dy * 58, 5, 0, 2 * Math.PI);
    ctx.fill();
  };
  drawCorner(66, 66, 1, 1);
  drawCorner(W - 66, 66, -1, 1);
  drawCorner(66, H - 66, 1, -1);
  drawCorner(W - 66, H - 66, -1, -1);

  // ─────────────────────────────────────────
  // 4. FAINT WATERMARK (centre)
  // ─────────────────────────────────────────
  ctx.save();
  ctx.globalAlpha = 0.03;
  drawGeometricSeal(ctx, W / 2, H / 2 + 80, 260, '#0F172A', '#C9A84C');
  ctx.globalAlpha = 1;
  ctx.restore();

  // ─────────────────────────────────────────
  // 5. TOP LOGOS
  // ─────────────────────────────────────────
  const logoSize = 160;
  const logoCY = 180;

  // University logo — top LEFT
  if (universityLogoImg) {
    drawLogoImage(ctx, universityLogoImg, 200, logoCY, logoSize);
  } else {
    drawGeometricSeal(ctx, 200, logoCY, logoSize / 2, '#0F172A', '#C9A84C', true);
  }

  // College logo — top RIGHT
  if (collegeLogoImg) {
    drawLogoImage(ctx, collegeLogoImg, W - 200, logoCY, logoSize);
  } else {
    drawGeometricSeal(ctx, W - 200, logoCY, logoSize / 2, '#1E3A8A', '#C9A84C', true);
  }

  // ─────────────────────────────────────────
  // 6. HEADER TEXT
  // ─────────────────────────────────────────
  ctx.fillStyle = '#1E293B';

  // University name under left logo
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px Tajawal, Arial, sans-serif';
  ctx.fillText(university?.name || 'الجامعة', 200, logoCY + logoSize / 2 + 36);

  // Ministry — centre top
  ctx.textAlign = 'center';
  ctx.font = '28px Tajawal, Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('وزارة التعليم العالي والبحث العلمي', W / 2, 100);

  // Bismillah
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 34px Tajawal, Arial, sans-serif';
  ctx.fillText('بسم الله الرحمن الرحيم', W / 2, 155);

  // College name under right logo
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px Tajawal, Arial, sans-serif';
  ctx.fillStyle = '#1E293B';
  ctx.fillText(college?.name || 'الكلية', W - 200, logoCY + logoSize / 2 + 36);

  // Department + study info — centre, below logos
  ctx.font = '24px Tajawal, Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(
    `قسم ${department?.name || '-'} | الدراسة: ${student.study_type || 'صباحي'} | المرحلة: ${student.stages?.name || student.stage || '-'}`,
    W / 2,
    logoCY + logoSize / 2 + 36
  );

  // ─────────────────────────────────────────
  // 7. GOLD DIVIDER LINE
  // ─────────────────────────────────────────
  const dividerY = logoCY + logoSize / 2 + 66;
  ctx.strokeStyle = '#C9A84C';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(100, dividerY);
  ctx.lineTo(W / 2 - 60, dividerY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W / 2 + 60, dividerY);
  ctx.lineTo(W - 100, dividerY);
  ctx.stroke();
  // Diamond
  ctx.fillStyle = '#C9A84C';
  ctx.beginPath();
  ctx.moveTo(W / 2, dividerY - 14);
  ctx.lineTo(W / 2 + 14, dividerY);
  ctx.lineTo(W / 2, dividerY + 14);
  ctx.lineTo(W / 2 - 14, dividerY);
  ctx.closePath();
  ctx.fill();

  // ─────────────────────────────────────────
  // 8. DOCUMENT TITLE BANNER
  // ─────────────────────────────────────────
  const titleY = dividerY + 55;
  const titleText = `وثيقة نتائج امتحانات الطلبة للعام الدراسي ${academicYear}`;
  ctx.font = 'bold 40px Tajawal, Arial, sans-serif';
  const titleW = ctx.measureText(titleText).width;

  const bannerPadX = 80, bannerPadY = 22;
  const bW = titleW + bannerPadX * 2;
  const bH = 80;
  const bX = W / 2 - bW / 2;
  const bY = titleY - 10;
  const bR = 16;

  // Gold tinted background
  ctx.fillStyle = 'rgba(201,168,76,0.06)';
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
  roundRect(bX, bY, bW, bH, bR);
  ctx.fill();
  ctx.strokeStyle = 'rgba(201,168,76,0.4)';
  ctx.lineWidth = 2;
  roundRect(bX, bY, bW, bH, bR);
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.textAlign = 'center';
  ctx.fillText(titleText, W / 2, titleY + bH / 2 + 2);

  // ─────────────────────────────────────────
  // 9. STUDENT DETAILS ROW
  // ─────────────────────────────────────────
  const studentY = bY + bH + 46;
  ctx.font = 'bold 30px Tajawal, Arial, sans-serif';
  ctx.fillStyle = '#1E293B';
  ctx.textAlign = 'right';
  ctx.fillText(`اسم الطالب: ${student.full_name}`, W - 110, studentY);
  ctx.textAlign = 'left';
  ctx.fillText(`الرقم الجامعي: ${student.student_number}`, 110, studentY);

  // ─────────────────────────────────────────
  // 10. RESULTS TABLE
  // ─────────────────────────────────────────
  const drawTable = (items, startY) => {
    const tableLeft = 80;
    const tableRight = W - 80;
    const tableWidth = tableRight - tableLeft;
    const colW = tableWidth / items.length;
    const headerH = 84;
    const cellH = 84;

    const gradeColors = {
      'امتياز': '#D97706',
      'جيد جداً': '#059669',
      'جيد': '#2563EB',
      'متوسط': '#D97706',
      'مقبول': '#6B7280',
      'ضعيف': '#DC2626',
    };

    items.forEach((item, i) => {
      const x = tableLeft + i * colW;

      // Header cell — dark slate
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(x, startY, colW, headerH);

      // Gold top accent on header
      ctx.fillStyle = '#C9A84C';
      ctx.fillRect(x, startY, colW, 4);

      // Header borders
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, startY, colW, headerH);

      // Course name
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px Tajawal, Arial, sans-serif';
      let name = item.courses?.name || 'مادة';
      if (name.length > 18) name = name.slice(0, 16) + '..';
      ctx.fillText(name, x + colW / 2, startY + 38);

      // Units
      ctx.fillStyle = '#94A3B8';
      ctx.font = '18px Tajawal, Arial, sans-serif';
      ctx.fillText(`(${item.courses?.units || 1} وحدة)`, x + colW / 2, startY + 68);

      // Grade cell — alternating row
      const cellBg = i % 2 === 0 ? '#F8FAFC' : '#F1F5F9';
      ctx.fillStyle = cellBg;
      ctx.fillRect(x, startY + headerH, colW, cellH);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, startY + headerH, colW, cellH);

      // Score number
      const score = typeof item.score === 'number' ? item.score.toFixed(0) : '-';
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 20px Tajawal, Arial, sans-serif';
      ctx.fillText(score, x + colW / 2, startY + headerH + 28);

      // Grade badge (pill)
      const grade = item.grade_label || '';
      const gc = gradeColors[grade] || '#6B7280';
      const badgeW = Math.min(colW - 24, 150);
      const badgeH = 38;
      const badgeX = x + (colW - badgeW) / 2;
      const badgeY = startY + headerH + cellH - badgeH - 10;
      const br = badgeH / 2;

      ctx.fillStyle = gc + '22'; // faint bg
      roundRect(badgeX, badgeY, badgeW, badgeH, br);
      ctx.fill();
      ctx.strokeStyle = gc;
      ctx.lineWidth = 1.5;
      roundRect(badgeX, badgeY, badgeW, badgeH, br);
      ctx.stroke();

      ctx.fillStyle = gc;
      ctx.font = 'bold 18px Tajawal, Arial, sans-serif';
      ctx.fillText(grade, x + colW / 2, badgeY + badgeH / 2 + 6);
    });
  };

  const tableStartY = studentY + 34;
  const rowH = 168; // headerH + cellH

  const firstRow = results.slice(0, 5);
  const secondRow = results.slice(5, 10);

  let tableEndY = tableStartY;
  if (firstRow.length > 0) {
    drawTable(firstRow, tableStartY);
    tableEndY = tableStartY + rowH;
  }
  if (secondRow.length > 0) {
    drawTable(secondRow, tableStartY + rowH + 16);
    tableEndY = tableStartY + rowH * 2 + 16;
  }

  // ─────────────────────────────────────────
  // 11. OVERALL RESULT SECTION
  // ─────────────────────────────────────────
  const resultY = tableEndY + 60;
  const isPassed_ = isPassed;
  const statusColor = isPassed_ ? '#059669' : '#DC2626';
  const statusText = isPassed_ ? '✓ ناجح' : '✗ راسب';

  const overallColors = {
    'امتياز': '#D97706',
    'جيد جداً': '#059669',
    'جيد': '#2563EB',
    'متوسط': '#D97706',
    'مقبول': '#6B7280',
    'ضعيف': '#DC2626',
  };
  const overallColor = overallColors[overallGrade] || '#475569';

  // Draw result pill
  const drawResultPill = (label, value, color, cx) => {
    const pillW = 340;
    const pillH = 68;
    const pillX = cx - pillW / 2;
    const pillY = resultY;

    ctx.fillStyle = color + '15';
    roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '22px Tajawal, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, pillY + 26);

    ctx.fillStyle = color;
    ctx.font = 'bold 28px Tajawal, Arial, sans-serif';
    ctx.fillText(value, cx, pillY + 58);
  };

  drawResultPill('النتيجة الكلية', statusText, statusColor, W / 2 - 220);
  drawResultPill('التقدير العام', overallGrade, overallColor, W / 2 + 220);



  // ─────────────────────────────────────────
  // 14. EXPORT AS PDF
  // ─────────────────────────────────────────
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210);
  return pdf.output('blob');
};
