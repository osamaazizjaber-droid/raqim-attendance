import { createClient } from '@supabase/supabase-js';
import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// التحقق من وجود المتغيرات
if (!token || !supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables in serverless API');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const bot = new TelegramBot(token, { polling: false });

// --- ذاكرة تخزين مؤقت خفيفة الوزن للبيئة غير الدائمة (Serverless Cache) ---
let studentsList = null;
let cacheByChatId = new Map();
let cacheByStudentNumber = new Map();
let lastFetchTime = 0;
const CACHE_TTL = 60000; // دقيقة واحدة صلاحية الكاش لتجنب تكرار الاتصال بـ Supabase

async function initServerlessCache() {
  const now = Date.now();
  if (studentsList && (now - lastFetchTime < CACHE_TTL)) {
    return;
  }
  try {
    console.log('🔄 [Serverless Cache] جاري تنشيط ذاكرة التخزين المؤقت للطلاب...');
    const { data, error } = await supabase
      .from('students')
      .select('*, colleges(name, university), departments(name), stages(name)');
      
    if (error) throw error;
    
    studentsList = data || [];
    cacheByChatId.clear();
    cacheByStudentNumber.clear();
    
    for (const student of studentsList) {
      if (student.telegram_chat_id) {
        cacheByChatId.set(String(student.telegram_chat_id), student);
      }
      if (student.student_number) {
        cacheByStudentNumber.set(student.student_number.trim().toUpperCase(), student);
      }
    }
    lastFetchTime = now;
    console.log(`✅ [Serverless Cache] تم كشط ${studentsList.length} طالب بنجاح.`);
  } catch (err) {
    console.error('❌ [Serverless Cache] فشل تنشيط كاش الطلاب:', err);
    if (!studentsList) throw err;
  }
}

async function getStudentByChatId(chatId) {
  await initServerlessCache();
  return cacheByChatId.get(String(chatId)) || null;
}

async function getStudentByNumber(studentNumber) {
  await initServerlessCache();
  if (!studentNumber) return null;
  return cacheByStudentNumber.get(studentNumber.trim().toUpperCase()) || null;
}

async function searchStudentsByName(name) {
  await initServerlessCache();
  if (!name) return [];
  const normalized = name.trim().toLowerCase();
  return studentsList.filter(s => s.full_name && s.full_name.toLowerCase().includes(normalized));
}

function updateStudentInCache(student) {
  if (!studentsList) return;
  const index = studentsList.findIndex(s => s.id === student.id);
  if (index !== -1) {
    const old = studentsList[index];
    if (old.telegram_chat_id) cacheByChatId.delete(String(old.telegram_chat_id));
    if (old.student_number) cacheByStudentNumber.delete(old.student_number.trim().toUpperCase());
    studentsList[index] = student;
  } else {
    studentsList.push(student);
  }
  if (student.telegram_chat_id) cacheByChatId.set(String(student.telegram_chat_id), student);
  if (student.student_number) cacheByStudentNumber.set(student.student_number.trim().toUpperCase(), student);
}

export default async function handler(req, res) {
  // 1. معالجة طلب GET لتهيئة وإعداد الـ Webhook تلقائياً
  if (req.method === 'GET') {
    try {
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const webhookUrl = `https://${host}/api/bot`;
      
      const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`);
      const data = await response.json();

      // تسجيل قائمة الأوامر المعروضة للمستخدم في زر القائمة (Menu Button)
      try {
        await bot.setMyCommands([
          { command: 'start', description: 'البدء وتفعيل الحساب / Start and activate account' },
          { command: 'help', description: 'عرض تعليمات الاستخدام / Show usage help' }
        ]);
      } catch (cmdErr) {
        console.error('⚠️ Failed to set commands during webhook initialization:', cmdErr);
      }
      
      return res.status(200).json({
        message: 'تم إعداد وتفعيل الـ Webhook الخاص برقيم بنجاح!',
        webhookUrl,
        telegramResponse: data
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. معالجة طلبات POST الواردة من تيليجرام أو سوبابيس
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ─── إصلاح دائم: التحقق من صحة الـ Webhook وإعادة تسجيله تلقائياً عند كل نشر جديد ───
  // هذا يحل مشكلة توقف البوت بعد كل Deployment على Vercel بدون الحاجة لأي تدخل يدوي
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const expectedWebhookUrl = `https://${host}/api/bot`;
    
    // التحقق من حالة الـ Webhook الحالية
    const webhookInfoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const webhookInfo = await webhookInfoRes.json();
    const currentUrl = webhookInfo?.result?.url || '';

    // إعادة التسجيل فقط إذا كان الرابط مختلفاً أو فارغاً
    if (currentUrl !== expectedWebhookUrl) {
      console.log(`🔄 Auto-healing webhook: was "${currentUrl}", setting to "${expectedWebhookUrl}"`);
      await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${expectedWebhookUrl}`);
    }
  } catch (webhookCheckErr) {
    // نتجاهل الأخطاء هنا حتى لا تعطل معالجة الرسائل الرئيسية
    console.warn('⚠️ Webhook self-check error (non-fatal):', webhookCheckErr?.message);
  }
  // ──────────────────────────────────────────────────────────────────────────────────────────

  try {
    const body = req.body;
    console.log('Received Webhook Payload:', JSON.stringify(body));

    // أ) التحقق مما إذا كان الطلب قادماً من Supabase Database Webhook
    if (body && body.table) {
      const { table, type, record, old_record } = body;

      if (table === 'telegram_resend_requests' && type === 'INSERT') {
        await processResendRequest(record);
      } else if (table === 'sessions' && type === 'UPDATE') {
        // نتحقق مما إذا كانت الجلسة قد أُغلقت للتو (تحول حقل is_open من true إلى false)
        const justClosed = old_record && old_record.is_open === true && record.is_open === false;
        if (justClosed) {
          await sendSessionReportToProfessor(record);
        }
      }
      return res.status(200).json({ success: true });
    }

    // ب) التحقق مما إذا كان الطلب استعلام callback من زر تفاعلي (Telegram Callback Query)
    if (body && body.callback_query) {
      const cb = body.callback_query;
      const chatId = cb.message.chat.id;
      const data = cb.data;
      
      if (data === 'view_results') {
        try {
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery?callback_query_id=${cb.id}`);
        } catch (ansErr) {
          console.error('Failed to answer callback query in serverless:', ansErr);
        }
        await handleViewResults(chatId);
      }
      return res.status(200).json({ success: true });
    }

    // ج) التحقق مما إذا كان الطلب تحديثاً مرسلاً من تيليجرام (Telegram Webhook Update)
    if (body && body.message) {
      const msg = body.message;
      const chatId = msg.chat.id;
      const text = msg.text ? msg.text.trim() : '';

      if (text === '/start') {
        await handleStart(chatId);
      } else if (text === '/help') {
        await handleHelp(chatId);
      } else if (text !== '') {
        await handleTextMessage(chatId, text);
      }
      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ message: 'No action taken' });
  } catch (err) {
    console.error('Error in Vercel Telegram Webhook:', err);
    return res.status(500).json({ error: err.message });
  }
}


async function handleStart(chatId) {
  const welcomeText = `
أهلاً بك في بوت منصة *رَقِيم* لتسجيل الحضور الجامعي الذكي! 🎓

👤 *للطلاب:* يرجى إرسال **اسمك الكامل (الثلاثي أو الرباعي)** الآن للحصول على بطاقة الحضور وتفعيل حسابك.

👨‍🏫 *للأساتذة:* يرجى إرسال **بريدك الإلكتروني** المسجل في المنصة لربط حسابك وتلقي تقارير حضور المحاضرات تلقائياً فور انتهائها.

_ملاحظة: البوت يعمل بالكامل باللغة العربية._
`;
  await bot.sendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });
}

async function handleHelp(chatId) {
  const helpText = `
💡 *تعليمات استخدام بوت رقيم:*

👤 *للطلاب:*
1. أرسل اسمك الكامل (الثلاثي أو الرباعي) لربط حسابك واستلام بطاقة الحضور الرسمية.
2. احفظ صورة البطاقة في هاتفك لإظهارها للأستاذ عند تسجيل الحضور.

👨‍🏫 *للأساتذة:*
1. أرسل بريدك الإلكتروني المسجل بالمنصة لربط حساب التليجرام الخاص بك.
2. ستتلقى تقرير حضور تفصيلي ومفصل (بالحاضرين والغائبين والنسب) تلقائياً فور إنهاء المحاضرة بالمنصة.
`;
  await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

async function handleTextMessage(chatId, text) {
  if (text.startsWith('/')) return;

  // تحقق من الكلمات المفتاحية لعرض النتائج
  const resultsKeywords = ['النتائج', 'نتائج', 'نتائجي', '/results', 'results', 'النتيجه', 'نتيجه', 'نتيجة'];
  if (resultsKeywords.includes(text.toLowerCase())) {
    await handleViewResults(chatId);
    return;
  }

  // 0. التحقق مما إذا كان المدخل بريداً إلكترونياً (للأستاذ)
  if (text.includes('@')) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(text)) {
      await bot.sendMessage(chatId, '⚠️ البريد الإلكتروني غير صالح. يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }

    const { data: professor, error: profErr } = await supabase
      .from('professors')
      .select('*')
      .eq('email', text.toLowerCase())
      .maybeSingle();

    if (profErr) throw profErr;

    if (!professor) {
      await bot.sendMessage(chatId, '❌ هذا البريد الإلكتروني غير مسجل كأستاذ في منصة رقيم.');
      return;
    }

    if (professor.telegram_chat_id && professor.telegram_chat_id !== chatId) {
      await bot.sendMessage(chatId, '⚠️ هذا البريد مرتبط بحساب تيليجرام آخر بالفعل. يرجى مراجعة الإدارة لإعادة تعيينه.');
      return;
    }

    const { error: updateErr } = await supabase
      .from('professors')
      .update({ telegram_chat_id: chatId })
      .eq('id', professor.id);

    if (updateErr) throw updateErr;

    const successMsg = `
✅ *أهلاً بك يا دكتور ${professor.name}!*
تم تفعيل البوت وربطه بحسابك كأستاذ في منصة *رَقِيم* بنجاح.

📧 *البريد الإلكتروني:* ${professor.email}
🎓 *ستتلقى تقرير الحضور التفصيلي تلقائياً عبر تيليجرام فور انتهاء كل محاضرة تقوم بتسجيلها.*
`;
    await bot.sendMessage(chatId, successMsg, { parse_mode: 'Markdown' });
    return;
  }

  // 1. ربط الطالب (من الكاش)
  const linkedStudent = await getStudentByChatId(chatId);
  let targetStudent = null;

  if (linkedStudent) {
    targetStudent = linkedStudent;
  } else {
    // محاولة البحث بالرقم الجامعي أولاً (من الكاش)
    const studentByNum = await getStudentByNumber(text);
    
    if (studentByNum) {
      targetStudent = studentByNum;
    } else {
      // البحث بالاسم عبر المطابقة الجزئية الذكية (من الكاش)
      const students = await searchStudentsByName(text);

      if (!students || students.length === 0) {
        await bot.sendMessage(chatId, '❌ الاسم أو الرقم الجامعي غير موجود بقاعدة البيانات. يرجى كتابته بدقة كما هو مسجل بالمنصة، أو مراجعة إدارة التسجيل والقبول.');
        return;
      }

      if (students.length > 1) {
        const matchesList = students.slice(0, 3).map(s => `• ${s.full_name}`).join('\n');
        await bot.sendMessage(chatId, `⚠️ تم العثور على أكثر من طالب يطابق هذا الاسم:\n${matchesList}\n\nيرجى كتابة الاسم الرباعي الكامل بدقة أو البحث برقمك الجامعي.`);
        return;
      }

      targetStudent = students[0];
    }

    if (targetStudent.telegram_chat_id && targetStudent.telegram_chat_id !== chatId) {
      await bot.sendMessage(chatId, '⚠️ هذا الحساب مرتبط بحساب تيليجرام آخر بالفعل لمنع التزوير وحماية الخصوصية. يرجى مراجعة الإدارة.');
      return;
    }

    const { error: updateErr } = await supabase
      .from('students')
      .update({ telegram_chat_id: chatId })
      .eq('id', targetStudent.id);

    if (updateErr) throw updateErr;

    targetStudent.telegram_chat_id = chatId;
    updateStudentInCache(targetStudent);
  }

  const isNewLink = !linkedStudent;
  const caption = isNewLink 
    ? `✅ *تم تفعيل البوت وربطه بحسابك بنجاح!*\n\n*الاسم:* ${targetStudent.full_name}\n*الرقم الجامعي:* ${targetStudent.student_number}\n*الجامعة:* ${targetStudent.colleges?.university || 'جامعة رقيم'}\n\n_لقد تم قفل حسابك بالتيليجرام على هذا الرقم الجامعي. في المرات القادمة ستحصل على بطاقتك فوراً بمجرد إرسال أي رسالة للبوت._`
    : `✅ *مرحباً بك مجدداً! إليك بطاقة الحضور الخاصة بك:*\n\n*الاسم:* ${targetStudent.full_name}\n*الرقم الجامعي:* ${targetStudent.student_number}\n*الجامعة:* ${targetStudent.colleges?.university || 'جامعة رقيم'}`;

  // أزرار النتائج
  const resultsUrl = `https://www.sys-wms.pro/results?q=${targetStudent.student_number}`;
  const keyboard = {
    inline_keyboard: [
      [
        { text: '📊 عرض نتائج الامتحانات بالبوت', callback_data: 'view_results' },
        { text: '🌐 بوابة النتائج (الويب)', url: resultsUrl }
      ]
    ]
  };

  if (targetStudent.telegram_file_id) {
    await bot.sendPhoto(chatId, targetStudent.telegram_file_id, {
      caption: caption,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } else {
    if (!targetStudent.qr_image_url) {
      await bot.sendMessage(chatId, '⚠️ تم العثور على اسمك، ولكن لم يتم توليد بطاقة الـ QR الخاصة بك بعد. يرجى التواصل مع إدارة النظام لتوليدها.', {
        reply_markup: keyboard
      });
      return;
    }

    const sentMsg = await bot.sendPhoto(chatId, targetStudent.qr_image_url, {
      caption: caption,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    const fileId = sentMsg.photo?.[sentMsg.photo.length - 1]?.file_id;
    if (fileId) {
      await supabase
        .from('students')
        .update({ telegram_file_id: fileId, qr_image_url: null })
        .eq('id', targetStudent.id);

      targetStudent.telegram_file_id = fileId;
      targetStudent.qr_image_url = null;
      updateStudentInCache(targetStudent);

      const path = `${targetStudent.college_id}/${targetStudent.id}.png`;
      await supabase.storage.from('qr-cards').remove([path]);
    }
  }
}

async function handleViewResults(chatId) {
  try {
    await bot.sendChatAction(chatId, 'typing');

    // جلب بيانات الطالب من الكاش الميموري
    const student = await getStudentByChatId(chatId);
    if (!student) {
      await bot.sendMessage(chatId, '❌ لم يتم ربط حسابك بالبوت بعد. يرجى إرسال رقمك الجامعي أو اسمك الكامل أولاً لتفعيل حسابك.');
      return;
    }

    // جلب درجات الطالب من قاعدة البيانات
    const { data: results, error: resErr } = await supabase
      .from('results')
      .select('*, courses(name)')
      .eq('student_id', student.id)
      .order('created_at', { ascending: true });

    if (resErr) throw resErr;

    if (!results || results.length === 0) {
      await bot.sendMessage(chatId, `ℹ️ <b>لا توجد نتائج معلنة لك حالياً في النظام.</b>\n\n👤 <b>الاسم:</b> ${student.full_name}\n🆔 <b>الرقم الجامعي:</b> ${student.student_number}`, { parse_mode: 'HTML' });
      return;
    }

    // جلب الشهادات المولدة للطالب إن وجدت
    let certificates = [];
    try {
      const { data: certs, error: certErr } = await supabase
        .from('certificates')
        .select('*')
        .eq('student_id', student.id)
        .order('generated_at', { ascending: true });
      if (!certErr && certs) {
        certificates = certs;
      }
    } catch (certErr) {
      console.error('⚠️ Failed to fetch certificates:', certErr);
    }

    // تنسيق وعرض النتائج
    let responseText = `📊 <b>كشف نتائج الامتحانات الرسمي — رقيم</b>\n\n`;
    responseText += `👤 <b>الطالب:</b> ${student.full_name}\n`;
    responseText += `🆔 <b>الرقم الجامعي:</b> ${student.student_number}\n`;
    responseText += `🏫 <b>الجامعة والكلية:</b> ${student.colleges?.university || 'جامعة رقيم'} - ${student.colleges?.name || '-'}\n`;
    responseText += `🎓 <b>القسم والمرحلة:</b> ${student.departments?.name || '-'} (${student.stages?.name || 'المرحلة الدراسية'})\n`;
    responseText += `──────────────────\n`;

    // تجميع النتائج حسب العام الدراسي
    const resultsByYear = {};
    results.forEach(res => {
      if (!resultsByYear[res.academic_year]) {
        resultsByYear[res.academic_year] = [];
      }
      resultsByYear[res.academic_year].push(res);
    });

    for (const year of Object.keys(resultsByYear)) {
      responseText += `📅 <b>العام الدراسي: ${year}</b>\n\n`;
      resultsByYear[year].forEach((res, index) => {
        const score = parseFloat(res.score);
        const statusEmoji = score >= 50 ? '🟢' : '🔴';
        responseText += `${statusEmoji} ${index + 1}. <b>${res.courses?.name || 'مادة'}</b>: <code>${score}</code> (${res.grade_label})\n`;
      });
      responseText += `──────────────────\n`;
    }

    responseText += `\n💡 <i>ملاحظة: درجة النجاح الصغرى للمواد هي 50.</i>`;

    await bot.sendMessage(chatId, responseText, { parse_mode: 'HTML' });

    // إرسال الشهادات بصيغة PDF إن وجدت
    if (certificates && certificates.length > 0) {
      for (const cert of certificates) {
        if (cert.pdf_url) {
          try {
            await bot.sendChatAction(chatId, 'upload_document');
            await bot.sendDocument(chatId, cert.pdf_url, {
              caption: `📄 <b>الشهادة الأكاديمية الرسمية للعام الدراسي: ${cert.academic_year}</b>\n• التقدير العام: <b>${cert.overall_grade}</b>\n• الحالة: <b>${cert.is_passed ? 'ناجح 🎉' : 'راسب ❌'}</b>`,
              parse_mode: 'HTML'
            });
          } catch (docErr) {
            console.error(`Failed to send certificate PDF for year ${cert.academic_year}:`, docErr.message || docErr);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error fetching results in serverless bot:', err);
    await bot.sendMessage(chatId, '⚠️ حدث خطأ أثناء جلب نتائج الامتحانات. يرجى المحاولة مرة أخرى لاحقاً.');
  }
}

async function processResendRequest(request) {
  const { id: requestId, student_id: studentId } = request;
  try {
    await supabase.from('telegram_resend_requests').update({ status: 'processing' }).eq('id', requestId);
    const { data: student, error: studErr } = await supabase
      .from('students')
      .select('*, colleges(name, university)')
      .eq('id', studentId)
      .single();

    if (studErr) throw studErr;
    if (!student || !student.telegram_chat_id) return;

    const caption = `
📥 *إعادة إرسال بطاقة الحضور الرسمية:*

*الاسم:* ${student.full_name}
*الرقم الجامعي:* ${student.student_number}
*الجامعة:* ${student.colleges?.university || 'جامعة رقيم'}

تم إرسال هذا الكارت بطلب من إدارة النظام.
`;

    const resultsUrl = `https://www.sys-wms.pro/results?q=${student.student_number}`;
    const keyboard = {
      inline_keyboard: [
        [{ text: '📊 عرض نتائج الامتحانات', url: resultsUrl }]
      ]
    };

    if (student.telegram_file_id) {
      await bot.sendPhoto(student.telegram_chat_id, student.telegram_file_id, {
        caption: caption,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else {
      if (!student.qr_image_url) return;
      const sentMsg = await bot.sendPhoto(student.telegram_chat_id, student.qr_image_url, {
        caption: caption,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      const fileId = sentMsg.photo?.[sentMsg.photo.length - 1]?.file_id;
      if (fileId) {
        await supabase.from('students').update({ telegram_file_id: fileId, qr_image_url: null }).eq('id', student.id);
        const path = `${student.college_id}/${student.id}.png`;
        await supabase.storage.from('qr-cards').remove([path]);
      }
    }
    await supabase.from('telegram_resend_requests').update({ status: 'completed' }).eq('id', requestId);
  } catch (err) {
    console.error('Error processing resend request:', err);
    await supabase.from('telegram_resend_requests').update({ status: 'failed', error_message: err.message }).eq('id', requestId);
  }
}

async function sendSessionReportToProfessor(session) {
  try {
    const { data: professor, error: profErr } = await supabase
      .from('professors')
      .select('name, telegram_chat_id')
      .eq('id', session.professor_id)
      .single();

    if (profErr) throw profErr;
    if (!professor || !professor.telegram_chat_id) return;

    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('name, department_id, stage_id, departments(name), stages(name)')
      .eq('id', session.course_id)
      .single();

    if (courseErr) throw courseErr;

    const { data: allStudents, error: studErr } = await supabase
      .from('students')
      .select('id, full_name, student_number')
      .eq('department_id', course.department_id)
      .eq('stage_id', course.stage_id)
      .eq('study_type', session.study_type || 'صباحي')
      .order('full_name', { ascending: true });

    if (studErr) throw studErr;

    const { data: attendance, error: attErr } = await supabase
      .from('attendance')
      .select('student_id, scanned_at')
      .eq('session_id', session.id);

    if (attErr) throw attErr;

    const presentMap = new Map(attendance?.map(a => [a.student_id, a.scanned_at]) || []);
    let presentCount = 0;
    let absentCount = 0;
    let presentListText = '';
    let absentListText = '';

    (allStudents || []).forEach((student, index) => {
      const scannedAt = presentMap.get(student.id);
      if (scannedAt) {
        presentCount++;
        const timeStr = new Date(scannedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        presentListText += `✅ ${presentCount}. ${student.full_name} (${student.student_number}) [${timeStr}]\n`;
      } else {
        absentCount++;
        absentListText += `❌ ${absentCount}. ${student.full_name} (${student.student_number})\n`;
      }
    });

    const totalEnrolled = (allStudents || []).length;
    const attendanceRatio = totalEnrolled > 0 ? Math.round((presentCount / totalEnrolled) * 100) : 0;
    const formattedDate = new Date(session.started_at).toLocaleDateString('ar-EG');
    const startTimeStr = new Date(session.started_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = session.ended_at ? new Date(session.ended_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-';

    const summaryMessage = `
📊 *تقرير حضور المحاضرة الرسمي — رقيم*

• *الأستاذ:* د. ${professor.name}
• *المادة:* ${course.name}
• *القسم والكلية:* ${course.departments?.name || '-'}
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

    await bot.sendMessage(professor.telegram_chat_id, summaryMessage, { parse_mode: 'Markdown' });

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
  } catch (err) {
    console.error('Error sending session report:', err);
  }
}
