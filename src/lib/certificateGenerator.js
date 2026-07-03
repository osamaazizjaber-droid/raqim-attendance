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
  // 5. DYNAMIC VERTICAL CENTERING CALCULATIONS
  // ─────────────────────────────────────────
  const subjectsCount = results.length;
  const subjectsPerRow = 5;
  const chunkedResults = [];
  for (let i = 0; i < subjectsCount; i += subjectsPerRow) {
    chunkedResults.push(results.slice(i, i + subjectsPerRow));
  }
  const numBlocks = chunkedResults.length;

  const logoSize = 160;
  const logoHeight = 160;
  const headerTextHeight = 200;
  const dividerHeight = 40;
  const titleHeight = 140; // Banner size + gap
  const studentHeight = 90;
  const tableBlockHeight = 180; // 2 rows of 90px each
  const tableGap = 30;
  const resultsBoxHeight = 170; // Box + gap

  const totalTableHeight = numBlocks * tableBlockHeight + (numBlocks - 1) * tableGap;
  const totalContentHeight = logoHeight + 40 + headerTextHeight + dividerHeight + titleHeight + studentHeight + totalTableHeight + resultsBoxHeight;

  // Start Y coordinate for vertical centering
  const startY = Math.max(80, (H - totalContentHeight) / 2);

  // ─────────────────────────────────────────
  // 6. TOP LOGO (Centered)
  // ─────────────────────────────────────────
  const logoCY = startY + logoSize / 2;
  if (logoImg) {
    drawLogoImage(ctx, logoImg, W / 2, logoCY, logoSize);
  } else {
    drawGeometricSeal(ctx, W / 2, logoCY, logoSize / 2, '#0F172A', '#C9A84C', true);
  }

  // ─────────────────────────────────────────
  // 7. HEADER TEXT
  // ─────────────────────────────────────────
  ctx.fillStyle = '#1E293B';
  ctx.textAlign = 'center';

  // Ministry
  ctx.font = 'bold 28px Tajawal, Arial, sans-serif';
  ctx.fillText('وزارة التعليم العالي والبحث العلمي', W / 2, startY + 210);

  // University & College Name
  ctx.font = 'bold 26px Tajawal, Arial, sans-serif';
  ctx.fillText(`${university?.name || 'الجامعة'} - ${college?.name || 'الكلية'}`, W / 2, startY + 255);

  // Department & Stage & Study Type
  ctx.font = '24px Tajawal, Arial, sans-serif';
  ctx.fillStyle = '#475569';
  const stageName = student.stages?.name || student.stage || '-';
  ctx.fillText(
    `قسم ${department?.name || '-'} | المرحلة: ${stageName} | الدراسة: ${student.study_type || 'صباحي'}`,
    W / 2,
    startY + 300
  );

  // Bismillah
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 30px Tajawal, Arial, sans-serif';
  ctx.fillText('بسم الله الرحمن الرحيم', W / 2, startY + 355);

  // ─────────────────────────────────────────
  // 8. GOLD DIVIDER LINE
  // ─────────────────────────────────────────
  const dividerY = startY + 395;
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
  // 9. DOCUMENT TITLE BANNER
  // ─────────────────────────────────────────
  const titleY = dividerY + 55;
  const titleText = `نتائج امتحانات الطلبة للعام الدراسي ${academicYear}`;
  ctx.font = 'bold 36px Tajawal, Arial, sans-serif';
  const titleW = ctx.measureText(titleText).width;

  const bannerPadX = 80, bannerPadY = 22;
  const bW = titleW + bannerPadX * 2;
  const bH = 76;
  const bX = W / 2 - bW / 2;
  const bY = titleY - 10;
  const bR = 16;

  // Gold tinted background
  ctx.fillStyle = 'rgba(201,168,76,0.06)';
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
  // 10. STUDENT DETAILS ROW
  // ─────────────────────────────────────────
  const studentY = bY + bH + 46;
  ctx.font = 'bold 28px Tajawal, Arial, sans-serif';
  ctx.fillStyle = '#1E293B';
  ctx.textAlign = 'right';
  ctx.fillText(`اسم الطالب: ${student.full_name}`, W - 110, studentY);
  ctx.textAlign = 'left';
  ctx.fillText(`الرقم الجامعي: ${student.student_number}`, 110, studentY);

  // ─────────────────────────────────────────
  // 11. RESULTS FORMAL TABLE (GRID)
  // ─────────────────────────────────────────
  const drawFormalTable = (chunk, startY) => {
    const tableLeft = 80;
    const tableRight = W - 80;
    const tableWidth = tableRight - tableLeft;
    
    // Width of the first header column ("المادة والوحدات" or "التقدير")
    const labelColW = 220;
    
    // Remaining width is distributed among the 5 subjects
    const subjectsCount = 5;
    const subjectBlockW = (tableWidth - labelColW) / subjectsCount;
    
    const rowH = 90; // Height of each row
    
    // Draw borders & content for Row 1: Subjects & Units
    // --------------------------------------------------
    // First cell: "المادة والوحدات"
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(tableLeft, startY, labelColW, rowH);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(tableLeft, startY, labelColW, rowH);
    
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px Tajawal, Arial, sans-serif';
    ctx.fillText('المادة والوحدات', tableLeft + labelColW / 2, startY + 54);
    
    // Draw subject columns
    for (let i = 0; i < subjectsCount; i++) {
      const item = chunk[i];
      const x = tableLeft + labelColW + i * subjectBlockW;
      
      const courseNameW = subjectBlockW * 0.72;
      const unitsW = subjectBlockW * 0.28;
      
      // Draw subject name cell
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, startY, courseNameW, rowH);
      ctx.strokeRect(x, startY, courseNameW, rowH);
      
      // Draw units cell
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(x + courseNameW, startY, unitsW, rowH);
      ctx.strokeRect(x + courseNameW, startY, unitsW, rowH);
      
      if (item) {
        // Draw Course Name
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px Tajawal, Arial, sans-serif';
        let courseName = item.courses?.name || 'مادة';
        if (courseName.length > 20) {
          courseName = courseName.slice(0, 18) + '..';
        }
        ctx.fillText(courseName, x + courseNameW / 2, startY + 54);
        
        // Draw Units value
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 20px Tajawal, Arial, sans-serif';
        ctx.fillText(String(item.courses?.units || 1), x + courseNameW + unitsW / 2, startY + 54);
      } else {
        // Draw empty space/dashes if no subject
        ctx.fillStyle = '#CBD5E1';
        ctx.textAlign = 'center';
        ctx.font = '20px Tajawal, Arial, sans-serif';
        ctx.fillText('-', x + courseNameW / 2, startY + 54);
        ctx.fillText('-', x + courseNameW + unitsW / 2, startY + 54);
      }
    }
    
    // Draw borders & content for Row 2: Grades (التقدير)
    // --------------------------------------------------
    const gradeStartY = startY + rowH;
    
    // First cell: "التقدير"
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(tableLeft, gradeStartY, labelColW, rowH);
    ctx.strokeRect(tableLeft, gradeStartY, labelColW, rowH);
    
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px Tajawal, Arial, sans-serif';
    ctx.fillText('التقدير', tableLeft + labelColW / 2, gradeStartY + 54);
    
    // Draw grade columns (merged for each subject)
    for (let i = 0; i < subjectsCount; i++) {
      const item = chunk[i];
      const x = tableLeft + labelColW + i * subjectBlockW;
      
      // Merge across both sub-columns
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, gradeStartY, subjectBlockW, rowH);
      ctx.strokeRect(x, gradeStartY, subjectBlockW, rowH);
      
      if (item) {
        const grade = item.grade_label || '';
        
        // Text styling based on grade
        const gradeColors = {
          'امتياز': '#B45309',
          'جيد جداً': '#047857',
          'جيد': '#1D4ED8',
          'متوسط': '#D97706',
          'مقبول': '#4B5563',
          'ضعيف': '#B91C1C',
        };
        ctx.fillStyle = gradeColors[grade] || '#0F172A';
        ctx.textAlign = 'center';
        ctx.font = 'bold 22px Tajawal, Arial, sans-serif';
        ctx.fillText(grade, x + subjectBlockW / 2, gradeStartY + 54);
      } else {
        ctx.fillStyle = '#CBD5E1';
        ctx.textAlign = 'center';
        ctx.font = '20px Tajawal, Arial, sans-serif';
        ctx.fillText('-', x + subjectBlockW / 2, gradeStartY + 54);
      }
    }
  };

  const tableStartY = studentY + 34;
  
  chunkedResults.forEach((chunk, idx) => {
    const chunkY = tableStartY + idx * (tableBlockHeight + tableGap);
    drawFormalTable(chunk, chunkY);
  });

  const tableEndY = tableStartY + numBlocks * tableBlockHeight + (numBlocks - 1) * tableGap;

  // ─────────────────────────────────────────
  // 12. OVERALL RESULT BOX (FORMAL STYLE)
  // ─────────────────────────────────────────
  const resultBoxY = tableEndY + 70;
  const boxW = 800;
  const boxH = 90;
  const boxX = W / 2 - boxW / 2;
  
  // Draw main border
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(boxX, resultBoxY, boxW, boxH);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(boxX, resultBoxY, boxW, boxH);
  
  // Draw middle divider
  ctx.beginPath();
  ctx.moveTo(W / 2, resultBoxY);
  ctx.lineTo(W / 2, resultBoxY + boxH);
  ctx.stroke();
  
  // Draw labels and values
  // Right side of box (RTL layout: Right is overall grade, Left is result status)
  
  // Right section: النتيجة (Result)
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 22px Tajawal, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('النتيجة الكلية:', W / 2 - 220, resultBoxY + 54);
  
  ctx.fillStyle = isPassed ? '#047857' : '#B91C1C';
  ctx.font = 'bold 26px Tajawal, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(isPassed ? 'ناجح' : 'راسب', W / 2 - 200, resultBoxY + 54);
  
  // Left section: التقدير العام (Overall Grade)
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 22px Tajawal, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('التقدير العام:', W / 2 + 160, resultBoxY + 54);
  
  const gradeColors = {
    'امتياز': '#B45309',
    'جيد جداً': '#047857',
    'جيد': '#1D4ED8',
    'متوسط': '#D97706',
    'مقبول': '#4B5563',
    'ضعيف': '#B91C1C',
  };
  ctx.fillStyle = gradeColors[overallGrade] || '#0F172A';
  ctx.font = 'bold 26px Tajawal, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(overallGrade || 'غير متوفر', W / 2 + 180, resultBoxY + 54);

  // ─────────────────────────────────────────
  // 13. EXPORT AS PDF
  // ─────────────────────────────────────────
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
  return pdf.output('blob');
};
