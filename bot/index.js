import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { supabase } from './supabase.js';
import { handleStart, handleHelp, handleTextMessage } from './handlers.js';

// تحميل متغيرات البيئة (يبحث في المجلد الحالي والمجلد الأب)
dotenv.config();
dotenv.config({ path: '../.env' });

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('خطأ: لم يتم تزويد TELEGRAM_BOT_TOKEN في ملف المتغيرات البيئية.');
  process.exit(1);
}

// تهيئة البوت في وضع الاستطلاع النشط (Polling Mode)
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 بوت رقيم لتيليجرام يعمل الآن بنجاح...');

// تسجيل المستمعين لأوامر البوت والرسائل
bot.onText(/\/start/, (msg) => handleStart(bot, msg));
bot.onText(/\/help/, (msg) => handleHelp(bot, msg));
bot.on('message', (msg) => handleTextMessage(bot, msg));

/**
 * وظيفة لمعالجة طلب إرسال كود QR وإرساله للطالب وتحديث قاعدة البيانات.
 */
async function processResendRequest(request) {
  const { id: requestId, student_id: studentId } = request;

  try {
    // 1. تحديث الحالة في قاعدة البيانات إلى جاري المعالجة (processing)
    await supabase
      .from('telegram_resend_requests')
      .update({ status: 'processing' })
      .eq('id', requestId);

    // 2. جلب بيانات الطالب وجامعته
    const { data: student, error: studErr } = await supabase
      .from('students')
      .select('*, universities(name)')
      .eq('id', studentId)
      .single();

    if (studErr) throw studErr;
    if (!student) throw new Error('الطالب المطلوب غير موجود في قاعدة البيانات');
    if (!student.telegram_chat_id) throw new Error('الطالب لم يقم بتسجيل وتفعيل البوت بعد');

    // 3. إرسال الكرت كصورة عبر تيليجرام
    const caption = `
📥 *إعادة إرسال بطاقة الحضور الرسمية:*

*الاسم:* ${student.full_name}
*الرقم الجامعي:* ${student.student_number}
*الجامعة:* ${student.universities?.name || 'جامعة رقيم'}

تم إرسال هذا الكارت بطلب من إدارة النظام.
`;

    if (student.telegram_file_id) {
      // إرسال الصورة باستخدام معرّف ملف تيليجرام المخزن (سريع ودون استهلاك تخزين)
      await bot.sendPhoto(student.telegram_chat_id, student.telegram_file_id, {
        caption: caption,
        parse_mode: 'Markdown'
      });
    } else {
      // إرسال الصورة باستخدام الرابط وحفظ معرّف الملف للتمكين من حذف الملف الأصلي
      if (!student.qr_image_url) throw new Error('كارت الـ QR الخاص بالطالب غير موجود في قاعدة البيانات');

      const sentMsg = await bot.sendPhoto(student.telegram_chat_id, student.qr_image_url, {
        caption: caption,
        parse_mode: 'Markdown'
      });

      const fileId = sentMsg.photo?.[sentMsg.photo.length - 1]?.file_id;
      
      if (fileId) {
        // تحديث قاعدة البيانات
        await supabase
          .from('students')
          .update({ 
            telegram_file_id: fileId,
            qr_image_url: null 
          })
          .eq('id', student.id);

        // حذف الصورة من تخزين Supabase Storage لتوفير المساحة
        const path = `${student.university_id}/${student.id}.png`;
        await supabase.storage
          .from('qr-cards')
          .remove([path]);
          
        console.log(`🧹 تم مسح الصورة من التخزين السحابي للطالب ${student.full_name} بعد إعادة الإرسال بنجاح.`);
      }
    }

    // 4. تحديث حالة الطلب إلى مكتمل (completed)
    await supabase
      .from('telegram_resend_requests')
      .update({ status: 'completed' })
      .eq('id', requestId);

    console.log(`✅ تم إرسال كود QR للطالب ${student.full_name} بنجاح.`);

  } catch (err) {
    console.error(`❌ فشل معالجة طلب إعادة الإرسال (${requestId}):`, err.message);
    
    // تحديث حالة الطلب بالفشل وتسجيل الخطأ للشفافية
    await supabase
      .from('telegram_resend_requests')
      .update({ 
        status: 'failed',
        error_message: err.message || 'حدث خطأ غير معروف أثناء الإرسال'
      })
      .eq('id', requestId);
  }
}

/**
 * دالة تفحص الطلبات المعلقة في الطابور عند إقلاع البوت لمعالجتها (في حال كان البوت متوقفاً وقت الطلب)
 */
async function processOldPendingRequests() {
  try {
    const { data: pendingRequests, error } = await supabase
      .from('telegram_resend_requests')
      .select('*')
      .eq('status', 'pending');

    if (error) throw error;

    if (pendingRequests && pendingRequests.length > 0) {
      console.log(`⚙️ وجدنا (${pendingRequests.length}) طلبات معلقة من قبل. جاري معالجتها الآن...`);
      for (const req of pendingRequests) {
        await processResendRequest(req);
      }
    }
  } catch (err) {
    console.error('Error processing old pending requests:', err);
  }
}

// تشغيل فحص المعلقات لإعادة إرسال البطاقات
processOldPendingRequests();

// --- طابور معالجة طلبات إنشاء الأساتذة ---

async function processProfessorRequest(request) {
  console.log(`👤 البدء في معالجة طلب إنشاء الأستاذ: ${request.email}`);
  try {
    // 1. تحديث الحالة إلى جاري المعالجة
    await supabase
      .from('professor_creation_requests')
      .update({ status: 'processing' })
      .eq('id', request.id);

    // 2. إنشاء المستخدم في Supabase Auth عبر الـ Admin API الرسمي
    const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
      email: request.email,
      password: request.password,
      email_confirm: true,
      user_metadata: { name: request.name }
    });

    if (createError) throw createError;

    // 3. إدخال الأستاذ في جدول professors
    const { error: profError } = await supabase.from('professors').insert({
      user_id: user.id,
      name: request.name,
      email: request.email,
      university_id: request.university_id,
      subscription_expires_at: request.subscription_expires_at
    });

    if (profError) {
      // تراجع عن إنشاء الحساب في حال فشل الإدخال في جدول الأساتذة لضمان الاتساق
      await supabase.auth.admin.deleteUser(user.id);
      throw profError;
    }

    // 4. تحديث الحالة إلى مكتمل
    await supabase
      .from('professor_creation_requests')
      .update({ status: 'completed' })
      .eq('id', request.id);

    console.log(`✅ تم إنشاء حساب الأستاذ ${request.email} بنجاح.`);
  } catch (err) {
    console.error(`❌ فشل إنشاء حساب الأستاذ ${request.email}:`, err);
    await supabase
      .from('professor_creation_requests')
      .update({ 
        status: 'failed', 
        error_message: err.message || 'حدث خطأ غير معروف' 
      })
      .eq('id', request.id);
  }
}

async function processOldProfessorRequests() {
  try {
    const { data: pendingRequests, error } = await supabase
      .from('professor_creation_requests')
      .select('*')
      .eq('status', 'pending');

    if (error) throw error;

    if (pendingRequests && pendingRequests.length > 0) {
      console.log(`⚙️ وجدنا (${pendingRequests.length}) طلبات إنشاء أساتذة معلقة من قبل. جاري معالجتها الآن...`);
      for (const req of pendingRequests) {
        await processProfessorRequest(req);
      }
    }
  } catch (err) {
    console.error('Error processing old professor requests:', err);
  }
}

// تشغيل فحص معلقات الأساتذة عند إقلاع البوت
processOldProfessorRequests();

// الاشتراك الفوري في الإضافات الجديدة لجدول telegram_resend_requests
supabase
  .channel('bot_resend_queue')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'telegram_resend_requests',
    },
    async (payload) => {
      console.log('🔔 استقبلنا طلب إعادة إرسال كرت جديد عبر Realtime:', payload.new.id);
      await processResendRequest(payload.new);
    }
  )
  .subscribe();

// الاشتراك الفوري في الإضافات لجدول professor_creation_requests لإنشاء الحسابات
supabase
  .channel('professor_creation_queue')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'professor_creation_requests',
    },
    async (payload) => {
      console.log('🔔 استقبلنا طلب إنشاء أستاذ جديد عبر Realtime:', payload.new.email);
      await processProfessorRequest(payload.new);
    }
  )
  .subscribe();
