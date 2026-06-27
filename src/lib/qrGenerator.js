import QRCode from 'qrcode';
import { supabase } from './supabase';

/**
 * يولد بطاقة QR مخصصة للطالب ويرفعها إلى Supabase Storage.
 * @param {Object} student بيانات الطالب (id, full_name, student_number, qr_token, university_id)
 * @param {string} universityName اسم الجامعة لوضعه في ترويسة الكارت
 * @returns {Promise<string>} رابط الصورة المرفوعة
 */
export async function generateAndUploadQRCard(student, universityName = 'جامعة رقيم') {
  const scale = 3; // معامل تكبير الدقة 3x لبطاقة فائقة الوضوح والحدة (Retina Resolution)
  const baseWidth = 400;
  const baseHeight = 580;
  
  const width = baseWidth * scale;
  const height = baseHeight * scale;
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // 1. خلفية البطاقة بتدرج شعاعي ناعم (Radial Gradient)
  const bgGrad = ctx.createRadialGradient(width/2, height/2, 50 * scale, width/2, height/2, 300 * scale);
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(1, '#f8fafc'); // Slate-50
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);
  
  // 2. إطارات خارجية راقية ومكبرة
  // إطار خارجي كحلي داكن عريض
  ctx.strokeStyle = '#0f172a'; // Slate-900
  ctx.lineWidth = 10 * scale;
  ctx.strokeRect(5 * scale, 5 * scale, width - 10 * scale, height - 10 * scale);
  
  // إطار داخلي أزرق ملكي نحيف
  ctx.strokeStyle = '#3b82f6'; // Blue-500
  ctx.lineWidth = 2 * scale;
  ctx.strokeRect(15 * scale, 15 * scale, width - 30 * scale, height - 30 * scale);
  
  // 3. ترويسة الكارت (Header) بتدرج كحلي ملكي
  const headerGrad = ctx.createLinearGradient(16 * scale, 16 * scale, width - 32 * scale, 16 * scale);
  headerGrad.addColorStop(0, '#0f172a');
  headerGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(16 * scale, 16 * scale, width - 32 * scale, 100 * scale);
  
  // خط ذهبي تحت الترويسة
  ctx.fillStyle = '#fbbf24'; // Amber-400
  ctx.fillRect(16 * scale, 114 * scale, width - 32 * scale, 3 * scale);
  
  // نص العنوان: رَقِيم
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${22 * scale}px Tajawal, Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('مَـنْـصَّـة رَقِـيـمْ', width / 2, 55 * scale);
  
  // نص العنوان الفرعي: اسم الجامعة
  ctx.fillStyle = '#93c5fd'; // Blue-300
  ctx.font = `bold ${13 * scale}px Tajawal, Arial`;
  ctx.fillText(universityName, width / 2, 85 * scale);
  
  // 4. حاوية الـ QR (Rounded Container)
  const qrBoxSize = 250 * scale;
  const qrX = (width - qrBoxSize) / 2;
  const qrY = 135 * scale;
  
  // رسم ظل خفيف خلف حاوية الـ QR
  ctx.fillStyle = 'rgba(15, 23, 42, 0.03)';
  ctx.fillRect(qrX + 3 * scale, qrY + 3 * scale, qrBoxSize, qrBoxSize);
  
  // رسم حاوية الـ QR بيضاء مع حواف رمادية خفيفة
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e2e8f0'; // Slate-200
  ctx.lineWidth = 1 * scale;
  ctx.fillRect(qrX, qrY, qrBoxSize, qrBoxSize);
  ctx.strokeRect(qrX, qrY, qrBoxSize, qrBoxSize);
  
  // توليد رمز الـ QR بدقة عالية
  const qrSize = 220 * scale;
  const tempCanvas = document.createElement('canvas');
  await QRCode.toCanvas(tempCanvas, student.qr_token, {
    width: qrSize,
    margin: 1,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });
  
  // رسم الـ QR في المنتصف تماماً لحاويته
  const qrInnerX = qrX + (qrBoxSize - qrSize) / 2;
  const qrInnerY = qrY + (qrBoxSize - qrSize) / 2;
  ctx.drawImage(tempCanvas, qrInnerX, qrInnerY);
  
  // 5. رسم حاوية تفاصيل الطالب (Student Info Card)
  const infoX = 30 * scale;
  const infoY = 405 * scale;
  const infoW = width - 60 * scale;
  const infoH = 110 * scale;
  
  // خلفية الكارت الداخلي
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1'; // Slate-300
  ctx.lineWidth = 1 * scale;
  
  // رسم ظل خفيف ليعطي مظهر كرت مجسم حقيقي
  ctx.shadowColor = 'rgba(0,0,0,0.03)';
  ctx.shadowBlur = 4 * scale;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2 * scale;
  ctx.fillRect(infoX, infoY, infoW, infoH);
  ctx.strokeRect(infoX, infoY, infoW, infoH);
  
  // إيقاف خصائص الظل لبقية العناصر
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // رسم تفاصيل الطالب داخل الكارت
  ctx.textAlign = 'center';
  
  // أ. الاسم الكامل
  ctx.fillStyle = '#6b7280'; // Gray-500
  ctx.font = `500 ${11 * scale}px Tajawal, Arial`;
  ctx.fillText('الاسم الكامل للمستخدم / FULL NAME', width / 2, infoY + 22 * scale);
  
  // الاسم الفعلي - مع تعديل حجم الخط ديناميكياً ليتسع بالكامل بدون قص أو خروج عن الكارت
  const nameText = student.full_name.trim();
  let nameFontSize = 18 * scale; // الخط الافتراضي
  ctx.fillStyle = '#0f172a'; // Slate-900
  ctx.font = `bold ${nameFontSize}px Tajawal, Arial`;
  
  // تقليل حجم الخط ديناميكياً إذا كان الاسم طويلاً جداً
  while (ctx.measureText(nameText).width > infoW - 20 * scale && nameFontSize > 11 * scale) {
    nameFontSize -= 1 * scale;
    ctx.font = `bold ${nameFontSize}px Tajawal, Arial`;
  }
  ctx.fillText(nameText, width / 2, infoY + 45 * scale);
  
  // ب. الرقم الجامعي
  ctx.fillStyle = '#6b7280'; // Gray-500
  ctx.font = `500 ${11 * scale}px Tajawal, Arial`;
  ctx.fillText('الرقم الجامعي المعتمد / STUDENT ID', width / 2, infoY + 72 * scale);
  
  ctx.fillStyle = '#1e293b'; // Slate-800
  ctx.font = `bold ${15 * scale}px Courier New, monospace, Arial`; // خط monospace للرقم يعطيه مظهراً رقمياً رسمياً
  ctx.fillText(student.student_number, width / 2, infoY + 93 * scale);
  
  // 6. تذييل البطاقة (Security Ribbon)
  ctx.fillStyle = '#10b981'; // Emerald-500 (أخضر أمن)
  ctx.font = `bold ${11 * scale}px Tajawal, Arial`;
  ctx.fillText('🔐 بطاقة مشفرة ومعتمدة رسمياً للحضور والغياب', width / 2, 540 * scale);
  
  ctx.fillStyle = '#94a3b8'; // Slate-400
  ctx.font = `500 ${9 * scale}px Tajawal, Arial`;
  ctx.fillText('يمنع مشاركة هذه البطاقة مع أشخاص آخرين تحت طائلة المسؤولية', width / 2, 555 * scale);
  
  // 7. تحويل الكانفاس إلى Blob للرفع
  const blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
  
  if (!blob) {
    throw new Error('فشل توليد ملف الصورة من الكانفاس');
  }
  
  // 8. رفع الصورة إلى Supabase Storage
  const path = `${student.university_id}/${student.id}.png`;
  const { error: uploadError } = await supabase.storage
    .from('qr-cards')
    .upload(path, blob, {
      contentType: 'image/png',
      upsert: true
    });
    
  if (uploadError) {
    throw new Error(`فشل رفع بطاقة الـ QR: ${uploadError.message}`);
  }
  
  // 9. الحصول على الرابط العام للصورة
  const { data } = supabase.storage.from('qr-cards').getPublicUrl(path);
  
  return data.publicUrl;
}
