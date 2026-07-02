import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import http from 'http';
import dns from 'dns';
import { supabase } from './supabase.js';
import { handleStart, handleHelp, handleTextMessage, handleCallbackQuery } from './handlers.js';
import { initStudentCache, updateStudentInCache, removeStudentFromCache } from './studentCache.js';

// إجبار Node.js على تفضيل IPv4 لتفادي مشاكل الاتصال المعلق في بعض بيئات Docker (Hugging Face)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// تحميل متغيرات البيئة (يبحث في المجلد الحالي والمجلد الأب)
dotenv.config();
dotenv.config({ path: '../.env' });

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('خطأ: لم يتم تزويد TELEGRAM_BOT_TOKEN في ملف المتغيرات البيئية.');
  process.exit(1);
}

console.log('🔑 TELEGRAM_BOT_TOKEN is loaded: length =', token.length, ', prefix =', token.substring(0, 5) + '...' + token.substring(token.length - 5));
console.log('🔗 SUPABASE_URL is loaded: prefix =', (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').substring(0, 15) + '...');

// اختبار الاتصال بـ Telegram API عند الإقلاع
try {
  const testRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const testData = await testRes.json();
  console.log('📡 Telegram API Connection Test:', testRes.status, testData.ok ? 'SUCCESS' : 'FAILED', testData.result?.username);
} catch (err) {
  console.error('❌ Failed to connect to Telegram API:', err.message || err);
}

// تهيئة البوت وتأجيل بدء الاستطلاع لضمان تسجيل المستمعين أولاً
const bot = new TelegramBot(token);

// تسجيل قائمة الأوامر المعتمدة في تيليجرام لتظهر في زر القائمة (Menu Button)
bot.setMyCommands([
  { command: 'start', description: 'البدء وتفعيل الحساب / Start and activate account' },
  { command: 'help', description: 'عرض تعليمات الاستخدام / Show usage help' }
]).then(() => {
  console.log('📌 تم تسجيل قائمة الأوامر (/start, /help) في تيليجرام بنجاح.');
}).catch((err) => {
  console.error('⚠️ فشل تسجيل قائمة الأوامر في تيليجرام:', err.message || err);
});

// تسجيل مستمع لأخطاء الاستطلاع لتجنب توقف البوت
bot.on('polling_error', (error) => {
  console.error('⚠️ Polling error:', error.message || error);
});

// تسجيل مستمع للأخطاء العامة للبوت
bot.on('error', (error) => {
  console.error('⚠️ General Bot Error:', error.message || error);
});

console.log('🤖 بوت رقيم لتيليجرام يعمل الآن بنجاح...');

// تسجيل المستمعين لأوامر البوت والرسائل
bot.onText(/\/start/, (msg) => {
  console.log(`📥 [Command /start] received from ${msg.from?.username || msg.from?.id}`);
  handleStart(bot, msg);
});

bot.onText(/\/help/, (msg) => {
  console.log(`📥 [Command /help] received from ${msg.from?.username || msg.from?.id}`);
  handleHelp(bot, msg);
});

bot.on('message', (msg) => {
  // تفادي طباعة الأوامر المسجلة بالفعل مرتين
  if (msg.text && (msg.text.startsWith('/start') || msg.text.startsWith('/help'))) return;
  console.log(`📥 [Message] received from ${msg.from?.username || msg.from?.id}: "${msg.text || '[Non-text message]'}"`);
  handleTextMessage(bot, msg);
});

// تسجيل مستمع للـ Callback Queries (الأزرار التفاعلية)
bot.on('callback_query', (callbackQuery) => {
  console.log(`📥 [Callback Query] received from ${callbackQuery.from?.username || callbackQuery.from?.id}: "${callbackQuery.data}"`);
  handleCallbackQuery(bot, callbackQuery);
});

// تهيئة ذاكرة التخزين المؤقت للطلاب عند البدء ومن ثم تفعيل الاستطلاع
initStudentCache()
  .then(() => {
    console.log('🔄 البدء الفعلي للاستطلاع (Manual Polling Start)...');
    bot.startPolling();
  })
  .catch(err => {
    console.error('⚠️ فشل تهيئة ذاكرة التخزين المؤقت للطلاب عند الإقلاع، بدء الاستطلاع على كل حال:', err);
    bot.startPolling();
  });

/**
 * وظيفة لمعالجة طلب إعادة إرسال كود QR وتحديث قاعدة البيانات.
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
      .select('*, colleges(name, university)')
      .eq('id', studentId)
      .single();

    if (studErr) throw studErr;
    if (!student) throw new Error('الطالب المطلوب غير موجود في قاعدة البيانات');
    if (!student.telegram_chat_id) throw new Error('الطالب لم يقم بتسجيل وتفعيل البوت بعد');

    // 3. إرسال الكرت كصورة عبر تيليجرام
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.sys-wms.pro';
    const caption = `
📥 <b>إعادة إرسال بطاقة الحضور الرسمية:</b>

<b>الاسم:</b> ${student.full_name}
<b>الرقم الجامعي:</b> ${student.student_number}
<b>الجامعة:</b> ${student.colleges?.university || 'جامعة رقيم'}
<b>الكلية:</b> ${student.colleges?.name || 'الكلية'}

تم إرسال هذا الكارت بطلب من إدارة النظام.

📊 <b>للاستعلام عن نتائج امتحاناتك وتحميل شهادتك الرسمية:</b>
<a href="${frontendUrl}/results">اضغط هنا لفتح بوابة النتائج وتنزيل الشهادة</a>
<i>(يرجى إدخال رقمك الجامعي وحل مسألة التحقق الرياضية البسيطة التي ستظهر لك لاستلام النتيجة وتنزيل الشهادة)</i>
`;

    if (student.telegram_file_id) {
      // إرسال الصورة باستخدام معرّف ملف تيليجرام المخزن (سريع ودون استهلاك تخزين)
      await bot.sendPhoto(student.telegram_chat_id, student.telegram_file_id, {
        caption: caption,
        parse_mode: 'HTML'
      });
    } else {
      // إرسال الصورة باستخدام الرابط وحفظ معرّف الملف للتمكين من حذف الملف الأصلي
      if (!student.qr_image_url) throw new Error('كارت الـ QR الخاص بالطالب غير موجود في قاعدة البيانات');

      const sentMsg = await bot.sendPhoto(student.telegram_chat_id, student.qr_image_url, {
        caption: caption,
        parse_mode: 'HTML'
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
        const path = `${student.college_id}/${student.id}.png`;
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

// تشغيل فحص معلقات إعادة إرسال البطاقات
processOldPendingRequests();

// --- طابور معالجة طلبات إنشاء المستخدمين (المدراء والأساتذة) ---

async function processUserCreationRequest(request) {
  console.log(`👤 البدء في معالجة طلب إنشاء حساب: ${request.email} بدور: ${request.role}`);
  try {
    // 1. تحديث الحالة إلى جاري المعالجة
    await supabase
      .from('user_creation_requests')
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

    // 3. إدخال السجل في الجدول المناسب بناءً على الدور
    if (request.role === 'university' || request.role === 'college') {
      const { error: adminError } = await supabase.from('admins').insert({
        user_id: user.id,
        name: request.name,
        email: request.email,
        role: request.role,
        university_id: request.university_id,
        college_id: request.college_id
      });
      if (adminError) {
        await supabase.auth.admin.deleteUser(user.id);
        throw adminError;
      }
    } else if (request.role === 'professor') {
      const { error: profError } = await supabase.from('professors').insert({
        user_id: user.id,
        name: request.name,
        email: request.email,
        university_id: request.university_id,
        college_id: request.college_id,
        subscription_expires_at: request.subscription_expires_at
      });
      if (profError) {
        await supabase.auth.admin.deleteUser(user.id);
        throw profError;
      }
    }

    // 4. تحديث الحالة إلى مكتمل
    await supabase
      .from('user_creation_requests')
      .update({ status: 'completed' })
      .eq('id', request.id);

    console.log(`✅ تم إنشاء حساب ${request.email} بنجاح.`);
  } catch (err) {
    console.error(`❌ فشل إنشاء حساب ${request.email}:`, err);
    await supabase
      .from('user_creation_requests')
      .update({
        status: 'failed',
        error_message: err.message || 'حدث خطأ غير معروف'
      })
      .eq('id', request.id);
  }
}

async function processOldUserCreationRequests() {
  try {
    const { data: pendingRequests, error } = await supabase
      .from('user_creation_requests')
      .select('*')
      .eq('status', 'pending');

    if (error) throw error;

    if (pendingRequests && pendingRequests.length > 0) {
      console.log(`⚙️ وجدنا (${pendingRequests.length}) طلبات إنشاء حسابات معلقة من قبل. جاري معالجتها الآن...`);
      for (const req of pendingRequests) {
        await processUserCreationRequest(req);
      }
    }
  } catch (err) {
    console.error('Error processing old user creation requests:', err);
  }
}

// تشغيل فحص معلقات الحسابات عند إقلاع البوت
processOldUserCreationRequests();

// الاشتراك الفوري في الإضافات لجدول user_creation_requests لإنشاء الحسابات
supabase
  .channel('user_creation_queue')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'user_creation_requests',
    },
    async (payload) => {
      console.log('🔔 استقبلنا طلب إنشاء مستخدم جديد عبر Realtime:', payload.new.email);
      await processUserCreationRequest(payload.new);
    }
  )
  .subscribe();

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

// الاشتراك اللحظي في تحديثات جدول الطلاب لمزامنة ذاكرة التخزين المؤقت (Cache Sync)
supabase
  .channel('students_cache_sync')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'students',
    },
    async (payload) => {
      console.log(`🔔 استقبلنا تحديثاً لجدول الطلاب عبر Realtime: ${payload.eventType}`);
      const { eventType, new: newRecord, old: oldRecord } = payload;
      
      if (eventType === 'DELETE') {
        removeStudentFromCache(oldRecord.id);
      } else {
        try {
          const { data, error } = await supabase
            .from('students')
            .select('*, colleges(name, university), departments(name), stages(name)')
            .eq('id', newRecord.id)
            .single();
            
          if (error) throw error;
          if (data) {
            updateStudentInCache(data);
          }
        } catch (err) {
          console.error('❌ فشل جلب تفاصيل الطالب لتحديث الكاش:', err);
        }
      }
    }
  )
  .subscribe();

/**
 * وظيفة لتوليد وإرسال تقرير تفصيلي للأستاذ عبر تيليجرام فور انتهاء الجلسة.
 */
async function sendSessionReportToProfessor(session) {
  try {
    // 1. جلب بيانات الأستاذ للتحقق من ربط حسابه بالتيليجرام
    const { data: professor, error: profErr } = await supabase
      .from('professors')
      .select('name, telegram_chat_id')
      .eq('id', session.professor_id)
      .single();

    if (profErr) throw profErr;
    if (!professor || !professor.telegram_chat_id) {
      console.log(`ℹ️ الأستاذ ${session.professor_id} لم يقم بربط حسابه بالتليجرام بعد، تخطي إرسال التقرير.`);
      return;
    }

    // 2. جلب بيانات المادة والقسم والمرحلة
    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('name, department_id, stage_id, departments(name, college_id), stages(name)')
      .eq('id', session.course_id)
      .single();

    if (courseErr) throw courseErr;

    // حساب العام الدراسي الحالي
    const now = new Date();
    const currentYear = now.getMonth() >= 8
      ? `${now.getFullYear()}/${now.getFullYear() + 1}`
      : `${now.getFullYear() - 1}/${now.getFullYear()}`;

    // جلب الطلاب المعيدين في المادة من جدول student_courses
    const { data: studentCoursesData, error: scErr } = await supabase
      .from('student_courses')
      .select('student_id, type')
      .eq('course_id', session.course_id)
      .eq('academic_year', currentYear);

    if (scErr) throw scErr;

    const repeatStudentIds = (studentCoursesData || []).filter(sc => sc.type === 'repeat').map(sc => sc.student_id);

    // 3. جلب جميع الطلاب (المنتظمين بالقسم والمرحلة + المعيدين في هذه المادة)
    let query = supabase
      .from('students')
      .select('id, full_name, student_number');

    if (repeatStudentIds.length > 0) {
      query = query.or(`and(department_id.eq.${course.department_id},stage_id.eq.${course.stage_id},study_type.eq.${session.study_type || 'صباحي'}),id.in.(${repeatStudentIds.join(',')})`);
    } else {
      query = query.eq('department_id', course.department_id)
        .eq('stage_id', course.stage_id)
        .eq('study_type', session.study_type || 'صباحي');
    }

    const { data: allStudents, error: studErr } = await query.order('full_name', { ascending: true });
    if (studErr) throw studErr;

    // 4. جلب سجلات الحاضرين في الجلسة
    const { data: attendance, error: attErr } = await supabase
      .from('attendance')
      .select('student_id, scanned_at')
      .eq('session_id', session.id);

    if (attErr) throw attErr;

    const presentMap = new Map(attendance?.map(a => [a.student_id, a.scanned_at]) || []);
    const repeatSet = new Set(repeatStudentIds);

    let presentCount = 0;
    let absentCount = 0;
    let presentListText = '';
    let absentListText = '';

    (allStudents || []).forEach((student) => {
      const scannedAt = presentMap.get(student.id);
      const suffix = repeatSet.has(student.id) ? ' (إعادة)' : '';

      if (scannedAt) {
        presentCount++;
        const timeStr = new Date(scannedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        presentListText += `✅ ${presentCount}. ${student.full_name}${suffix} (${student.student_number}) [${timeStr}]\n`;
      } else {
        absentCount++;
        absentListText += `❌ ${absentCount}. ${student.full_name}${suffix} (${student.student_number})\n`;
      }
    });

    const totalEnrolled = (allStudents || []).length;
    const attendanceRatio = totalEnrolled > 0 ? Math.round((presentCount / totalEnrolled) * 100) : 0;
    const formattedDate = new Date(session.started_at).toLocaleDateString('ar-EG');
    const startTimeStr = new Date(session.started_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = session.ended_at ? new Date(session.ended_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-';

    // التقرير الملخص وقائمة الغيابات
    const summaryMessage = `
📊 *تقرير حضور المحاضرة الرسمي — رقيم*

• *الأستاذ:* د. ${professor.name}
• *المادة:* ${course.name}
• *القسم:* ${course.departments?.name || '-'}
• *المرحلة:* ${course.stages?.name || '-'}
• *نوع الدراسة:* ${session.study_type || 'صباحي'}
• *التاريخ:* ${formattedDate}
• *وقت البدء:* ${startTimeStr}
• *وقت الانتهاء:* ${endTimeStr}

📈 *إحصائيات الجلسة:*
• الحاضرين: *${presentCount}* طلاب
• الغائبين: *${absentCount}* طلاب
• الإجمالي الكلي للشعبة: *${totalEnrolled}*
• نسبة حضور الشعبة: *${attendanceRatio}%*

------------------------------------------

*🚫 قائمة الطلاب الغائبين (${absentCount}):*
${absentListText || 'لا يوجد غيابات (الحضور مكتمل) 🎉'}
`;

    // إرسال الرسالة الأولى (الملخص والغائبين)
    await bot.sendMessage(professor.telegram_chat_id, summaryMessage, { parse_mode: 'Markdown' });

    // إرسال الرسالة الثانية (الحاضرين)
    if (presentCount > 0) {
      const presentMessageHeader = `*🟢 قائمة الطلاب الحاضرين (${presentCount}):*\n`;
      let currentMsg = presentMessageHeader;

      const lines = presentListText.split('\n');
      for (const line of lines) {
        if ((currentMsg + line + '\n').length > 4000) {
          await bot.sendMessage(professor.telegram_chat_id, currentMsg, { parse_mode: 'Markdown' });
          currentMsg = '';
        }
        currentMsg += line + '\n';
      }

      if (currentMsg.trim() !== '') {
        await bot.sendMessage(professor.telegram_chat_id, currentMsg, { parse_mode: 'Markdown' });
      }
    } else {
      await bot.sendMessage(professor.telegram_chat_id, '*🟢 قائمة الطلاب الحاضرين (0):*\nلا يوجد حضور في هذه الجلسة ❌', { parse_mode: 'Markdown' });
    }

    console.log(`✉️ تم إرسال تقرير الجلسة ${session.id} للأستاذ ${professor.name} عبر تيليجرام بنجاح.`);

  } catch (err) {
    console.error(`❌ فشل توليد وإرسال تقرير الجلسة ${session.id} للأستاذ:`, err);
  }
}

// الاشتراك في تعديلات جدول الجلسات لإرسال التقارير عند الإغلاق
supabase
  .channel('sessions_update_queue')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'sessions',
    },
    async (payload) => {
      console.log('🔔 Received UPDATE on sessions:', payload);
      const newSession = payload.new;
      const oldSession = payload.old;

      // نتحقق مما إذا كانت الجلسة قد أغلقت للتو
      let justClosed = false;
      if (newSession.ended_at && !newSession.is_open) {
        if (oldSession && typeof oldSession.is_open === 'boolean') {
          justClosed = oldSession.is_open === true && newSession.is_open === false;
        } else {
          const endedTime = new Date(newSession.ended_at).getTime();
          const nowTime = Date.now();
          const diffMs = Math.abs(nowTime - endedTime);
          justClosed = diffMs < 300000;
        }
      }

      if (justClosed) {
        console.log(`📊 جلسة الحضور أغلقت حديثاً: ${newSession.id}. جاري إرسال التقرير للأستاذ...`);
        await sendSessionReportToProfessor(newSession);
      }
    }
  )
  .subscribe();

// خادم ويب بسيط لإبقاء خدمة البوت قيد العمل
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('🤖 بوت رقيم لتيليجرام يعمل بنجاح في الخلفية!');
}).listen(port, () => {
  console.log(`🌐 خادم ويب البوت يعمل على المنفذ ${port}`);
});
