import { supabase } from './supabase.js';
import { getStudentByChatId, getStudentByNumber, searchStudentsByName, updateStudentInCache } from './studentCache.js';

// الترحيب باللغة العربية
export const handleStart = async (bot, msg) => {
  const chatId = msg.chat.id;

  const welcomeText = `
أهلاً بك في بوت منصة <b>رَقِيم</b> الرسمي لتسجيل الحضور الجامعي! 🎓

👤 <b>للطلاب:</b>
• للحصول على بطاقة الحضور الرسمية (QR Card): أرسل <b>الرقم الجامعي</b> أو <b>الاسم الثلاثي الكامل</b> مباشرة (مثال: <code>2023/CS/0142</code>).

👨‍🏫 <b>للأساتذة:</b>
• لربط حسابك وتلقي تقارير المحاضرات تلقائياً: أرسل <b>بريدك الإلكتروني</b> المسجل بالمنصة.

----------------------------------
<b>منصة رقيم © 2026 جميع الحقوق محفوظة</b>
📞 للتواصل والدعم الفني:
• البريد: osamaazizjaber@gmail.com
• واتساب / هاتف: +9647716739456
`;
  await bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' });
};

// التعليمات المساعدة
export const handleHelp = async (bot, msg) => {
  const chatId = msg.chat.id;

  const helpText = `
💡 <b>تعليمات استخدام بوت رقيم:</b>

1️⃣ <b>استلام بطاقة الحضور:</b> أرسل رقمك الجامعي أو اسمك الثلاثي المعتمد مباشرة، وسيقوم البوت بإرسال بطاقتك الشخصية المشفرة. احفظ الصورة لتظهرها للأستاذ أوفلاين في قاعة الدرس.
2️⃣ <b>للأساتذة:</b> أرسل بريدك الإلكتروني لربط البوت وحسابك، لتستلم كشف الحضور والغياب والإحصائيات مباشرة فور إنهاء المحاضرة.

----------------------------------
<b>منصة رقيم © 2026 جميع الحقوق محفوظة</b>
📞 للتواصل والدعم الفني:
• البريد: osamaazizjaber@gmail.com
• واتساب / هاتف: +9647716739456
`;
  await bot.sendMessage(chatId, helpText, { parse_mode: 'HTML' });
};

// معالجة كافة الرسائل النصية والتحكم في الحالات
export const handleTextMessage = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // نتجاهل الأوامر الرسمية التي تبدأ بـ /start أو /help لأنها تُعالج في مستمعيها الخاصين
  if (text.startsWith('/start') || text.startsWith('/help')) return;

  // تحقق من الكلمات المفتاحية لعرض النتائج
  const resultsKeywords = ['النتائج', 'نتائج', 'نتائجي', '/results', 'results', 'النتيجه', 'نتيجه', 'نتيجة'];
  if (resultsKeywords.includes(text.toLowerCase())) {
    await handleViewResults(bot, chatId);
    return;
  }

  try {
    // 2. التحقق مما إذا كان المدخل بريداً إلكترونياً (للأستاذ)
    if (text.includes('@')) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(text)) {
        await bot.sendMessage(chatId, '⚠️ البريد الإلكتروني غير صالح. يرجى إدخال بريد إلكتروني صحيح.');
        return;
      }

      // البحث في جدول الأساتذة
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

      // التحقق مما إذا كان مرتبطاً بحساب تيليجرام آخر بالفعل
      if (professor.telegram_chat_id && professor.telegram_chat_id !== chatId) {
        await bot.sendMessage(chatId, '⚠️ هذا البريد مرتبط بحساب تيليجرام آخر بالفعل. يرجى مراجعة إدارة كليتك لإعادة تعيينه.');
        return;
      }

      // ربط حساب الأستاذ بالتيليجرام
      const { error: updateErr } = await supabase
        .from('professors')
        .update({ telegram_chat_id: chatId })
        .eq('id', professor.id);

      if (updateErr) throw updateErr;

      const successMsg = `
✅ <b>أهلاً بك يا دكتور ${professor.name}!</b>
تم تفعيل البوت وربطه بحسابك كأستاذ في منصة <b>رَقِيم</b> بنجاح.

📧 <b>البريد الإلكتروني:</b> ${professor.email}
🎓 <b>ستتلقى تقرير الحضور التفصيلي تلقائياً عبر تيليجرام فور انتهاء كل محاضرة تقوم بتسجيلها.</b>
`;
      await bot.sendMessage(chatId, successMsg, { parse_mode: 'HTML' });
      return;
    }

    // 3. المعاملة الافتراضية: الحصول على بطاقة الـ QR للطالب
    await bot.sendChatAction(chatId, 'upload_photo');

    const searchText = text.trim();
    let student = null;

    // 0. التحقق أولاً مما إذا كان حساب التيليجرام هذا مرتبطاً بالفعل بطالب مسجل (من الكاش)
    const linkedStudent = await getStudentByChatId(chatId);

    if (linkedStudent) {
      student = linkedStudent;
    } else {
      // 1. محاولة البحث أولاً بمطابقة الرقم الجامعي بدقة (من الكاش)
      const studentByNum = await getStudentByNumber(searchText);

      if (studentByNum) {
        student = studentByNum;
      } else {
        // 2. إذا لم يعثر عليه بالرقم، نبحث بالاسم الثلاثي (من الكاش)
        const studentsByName = await searchStudentsByName(searchText);

        if (studentsByName && studentsByName.length > 0) {
          if (studentsByName.length === 1) {
            student = studentsByName[0];
          } else {
            // وجد أكثر من طالب بنفس الاسم
            let responseMsg = `🔍 <b>تم العثور على أكثر من طالب يطابق هذا الاسم:</b>\n\n`;
            studentsByName.slice(0, 5).forEach((s, index) => {
              responseMsg += `${index + 1}. <b>الاسم:</b> ${s.full_name}\n   <b>القسم:</b> ${s.departments?.name || '-'}\n   <b>نوع الدراسة:</b> ${s.study_type || '-'}\n\n`;
            });
            responseMsg += `⚠️ يرجى إعادة إرسال اسمك الرباعي الكامل بدقة، أو البحث مباشرة بواسطة <b>الرقم الجامعي الخاص بك</b> للحصول على بطاقتك الخاصة.`;
            
            await bot.sendMessage(chatId, responseMsg, { parse_mode: 'HTML' });
            return;
          }
        }
      }
    }

    if (!student) {
      await bot.sendMessage(chatId, '❌ لم يتم العثور على أي طالب يطابق هذا الاسم أو الرقم الجامعي. يرجى كتابة الاسم الثلاثي الكامل بشكل صحيح، أو إدخال الرقم الجامعي كما هو مسجل بالكلية.');
      return;
    }

    // التحقق من حالة الربط لحماية الخصوصية ومنع الحصول على الـ QR من طالب آخر
    if (student.telegram_chat_id && student.telegram_chat_id !== chatId) {
      await bot.sendMessage(chatId, '❌ هذا الحساب الجامعي مرتبط بالفعل بحساب تيليجرام آخر لمنع التزوير وحماية خصوصية الطالب.\n\nإذا كنت صاحب الحساب وتواجه مشكلة، يرجى مراجعة عمادة الكلية لإلغاء الربط وإعادة تفعيل الحساب.');
      return;
    }

    // ربط الحساب لأول مرة إذا لم يكن مرتبطاً
    if (!student.telegram_chat_id) {
      await supabase
        .from('students')
        .update({ telegram_chat_id: chatId })
        .eq('id', student.id);
      student.telegram_chat_id = chatId;
      updateStudentInCache(student);
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://www.sys-wms.pro';
    const caption = `✅ <b>إليك بطاقة الحضور الرسمية الخاصة بك:</b>\n\n<b>الاسم:</b> ${student.full_name}\n<b>الرقم الجامعي:</b> ${student.student_number}\n<b>الجامعة:</b> ${student.colleges?.university || 'جامعة رقيم'}\n<b>الكلية:</b> ${student.colleges?.name || 'الكلية'}\n\n<i>احفظ هذه الصورة بجهازك لتتمكن من تسجيل حضورك بدون إنترنت بمسحها بواسطة جهاز الأستاذ.</i>`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📊 عرض نتائج الامتحانات بالبوت', callback_data: 'view_results' }
        ]
      ]
    };

    if (student.telegram_file_id) {
      // إرسال كاش تيليجرام
      await bot.sendPhoto(chatId, student.telegram_file_id, {
        caption: caption,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    } else {
      if (!student.qr_image_url) {
        await bot.sendMessage(chatId, '⚠️ تم العثور على اسمك، ولكن لم يتم توليد بطاقة الحضور الخاصة بك بعد. يرجى مراجعة الإدارة.');
        return;
      }

      // إرسال من رابط سوبابيس لأول مرة
      const sentMsg = await bot.sendPhoto(chatId, student.qr_image_url, {
        caption: caption,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });

      const fileId = sentMsg.photo?.[sentMsg.photo.length - 1]?.file_id;

      if (fileId) {
        // تحديث قاعدة البيانات بكاش تيليجرام وحذف الصورة من Storage لتوفير المساحة
        await supabase
          .from('students')
          .update({ 
            telegram_file_id: fileId,
            qr_image_url: null 
          })
          .eq('id', student.id);

        student.telegram_file_id = fileId;
        student.qr_image_url = null;
        updateStudentInCache(student);

        const path = `${student.college_id}/${student.id}.png`;
        await supabase.storage
          .from('qr-cards')
          .remove([path]);
          
        console.log(`🧹 تم مسح الصورة من التخزين السحابي للطالب ${student.full_name} بعد استلامها وتخزينها في تيليجرام.`);
      }
    }

  } catch (err) {
    console.error('Error handling telegram message:', err);
    try {
      await bot.sendMessage(chatId, '⚠️ حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى لاحقاً.');
    } catch (sendErr) {
      console.error('Failed to send error fallback message to user:', sendErr.message || sendErr);
    }
  }
};

/**
 * معالجة الاستعلامات التفاعلية (Callback Queries) من الأزرار
 */
export const handleCallbackQuery = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === 'view_results') {
    try {
      // إجابة التنبيه التفاعلي لإنهاء حالة التحميل
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (ansErr) {
      console.warn('⚠️ Failed to answer callback query (non-fatal):', ansErr.message);
    }
    await handleViewResults(bot, chatId);
  } else if (data.startsWith('download_pdf_')) {
    try {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'جاري جلب ملف الشهادة... 📥' });
    } catch (ansErr) {
      console.warn('⚠️ Failed to answer callback query (non-fatal):', ansErr.message);
    }
    await handleDownloadPdfCallback(bot, chatId, data);
  }
};

/**
 * جلب وعرض نتائج الامتحانات الرسمية للطالب داخل البوت
 */
export const handleViewResults = async (bot, chatId) => {
  try {
    await bot.sendChatAction(chatId, 'typing');

    // جلب بيانات الطالب من الكاش الميموري
    const student = await getStudentByChatId(chatId);
    if (!student) {
      await bot.sendMessage(chatId, '❌ لم يتم ربط حسابك بالبوت بعد. يرجى إرسال رقمك الجامعي أو اسمك الكامل أولاً لتفعيل حسابك.');
      return;
    }

    // التحقق من حجب النتائج لطلاب المسائي غير مسددي القسط
    if (student.study_type === 'مسائي' && student.fees_paid === false) {
      await bot.sendMessage(chatId, '❌ <b>عذراً، تم حجب نتائجك مؤقتاً بسبب عدم تسديد القسط الدراسي.</b>\n\nيرجى مراجعة القسم ودفع القسط لتفعيل عرض النتيجة.', { parse_mode: 'HTML' });
      return;
    }

    // التحقق من حجب النتائج لعدم التسجيل في منصة HEPIC
    if (student.hepic_registered === false) {
      await bot.sendMessage(chatId, '❌ <b>عذراً، تم حجب نتائجك بسبب عدم التسجيل في منصة HEPIC.</b>\n\nيرجى مراجعة القسم لإكمال التسجيل وتفعيل عرض النتيجة.', { parse_mode: 'HTML' });
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
        .order('generated_at', { ascending: false });
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
    responseText += `\n👨‍💻 <b>مطور النظام:</b> م.اسامة العياش\n`;
    responseText += `✉️ <b>البريد:</b> osamaazizjaber@gmail.com\n`;
    responseText += `📞 <b>هاتف / واتساب:</b> +9647716739456\n`;

    // تجهيز أزرار تحميل الشهادات المتوفرة للتحميل المباشر داخل البوت
    const inlineButtons = [];
    if (certificates && certificates.length > 0) {
      certificates.forEach(cert => {
        if (cert.pdf_url && results.some(res => res.academic_year === cert.academic_year)) {
          const semCode = cert.semester === 'الكورس الثاني' ? '2' : '1';
          inlineButtons.push([
            {
              text: `📥 تحميل شهادة ${cert.semester || 'الكورس الأول'} لعام ${cert.academic_year} (PDF)`,
              callback_data: `download_pdf_${cert.academic_year.replace('/', '_')}_${semCode}`
            }
          ]);
        }
      });
    }

    const messageOptions = { parse_mode: 'HTML' };
    if (inlineButtons.length > 0) {
      messageOptions.reply_markup = { inline_keyboard: inlineButtons };
    }

    await bot.sendMessage(chatId, responseText, messageOptions);
  } catch (err) {
    console.error('Error fetching results in bot:', err);
    await bot.sendMessage(chatId, '⚠️ حدث خطأ أثناء جلب نتائج الامتحانات. يرجى المحاولة مرة أخرى لاحقاً.');
  }
};

/**
 * جلب وإرسال ملف الشهادة الـ PDF مباشرة للمستخدم داخل المحادثة
 */
export const handleDownloadPdfCallback = async (bot, chatId, data) => {
  try {
    const parts = data.replace('download_pdf_', '').split('_');
    const academicYear = `${parts[0]}/${parts[1]}`;
    const semester = parts[2] === '2' ? 'الكورس الثاني' : 'الكورس الأول';

    const student = await getStudentByChatId(chatId);
    if (!student) {
      await bot.sendMessage(chatId, '❌ لم يتم ربط حسابك بالبوت بعد.');
      return;
    }

    // التحقق من حجب النتائج لطلاب المسائي غير مسددي القسط
    if (student.study_type === 'مسائي' && student.fees_paid === false) {
      await bot.sendMessage(chatId, '❌ <b>عذراً، لا يمكنك تحميل الشهادة بسبب عدم تسديد القسط الدراسي.</b>\n\nيرجى مراجعة القسم ودفع القسط لتفعيل عرض النتيجة.', { parse_mode: 'HTML' });
      return;
    }

    // التحقق من حجب النتائج لعدم التسجيل في منصة HEPIC
    if (student.hepic_registered === false) {
      await bot.sendMessage(chatId, '❌ <b>عذراً، لا يمكنك تحميل الشهادة بسبب عدم التسجيل في منصة HEPIC.</b>\n\nيرجى مراجعة القسم لإكمال التسجيل وتفعيل عرض النتيجة.', { parse_mode: 'HTML' });
      return;
    }

    await bot.sendChatAction(chatId, 'upload_document');

    // التحقق من وجود نتائج نشطة لهذا العام الدراسي أولاً (لتجنب إرسال شهادات للنتائج المحذوفة)
    const { data: resCheck, error: resCheckErr } = await supabase
      .from('results')
      .select('id')
      .eq('student_id', student.id)
      .eq('academic_year', academicYear)
      .limit(1);

    if (resCheckErr) throw resCheckErr;

    if (!resCheck || resCheck.length === 0) {
      await bot.sendMessage(chatId, `⚠️ لا توجد نتائج معلنة لك حالياً للعام الدراسي ${academicYear}.`);
      return;
    }

    const { data: cert, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('student_id', student.id)
      .eq('academic_year', academicYear)
      .eq('semester', semester)
      .maybeSingle();

    if (error) throw error;

    if (!cert || !cert.pdf_url) {
      await bot.sendMessage(chatId, `⚠️ لم يتم إصدار شهادة PDF للعام الدراسي ${academicYear} - ${semester} بعد من قبل إدارة الكلية.`);
      return;
    }

    // تحميل ملف الـ PDF على الخادم أولاً ثم إرساله كـ Buffer لتجنب مشاكل Telegram مع روابط Supabase وتجنب الكاش
    const pdfResponse = await fetch(`${cert.pdf_url}?t=${Date.now()}`);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    const fileName = `شهادة_${student.full_name?.replace(/\s+/g, '_') || 'الطالب'}_${cert.academic_year.replace('/', '-')}_${semester.replace(/\s+/g, '_')}.pdf`;

    // إرسال ملف الـ PDF مباشرة داخل المحادثة كـ Buffer
    await bot.sendDocument(chatId, pdfBuffer, {
      caption: `📄 <b>الشهادة الأكاديمية الرسمية - ${semester}\nالعام الدراسي: ${cert.academic_year}</b>\n• التقدير العام: <b>${(cert.overall_grade === 'مكمل' || cert.overall_grade === 'راسب') ? '-' : cert.overall_grade}</b>\n• الحالة: <b>${cert.is_passed ? 'ناجح 🎉' : (cert.overall_grade === 'مكمل' ? 'مكمل ⚠️' : 'راسب ❌')}</b>`,
      parse_mode: 'HTML'
    }, {
      filename: fileName,
      contentType: 'application/pdf'
    });
  } catch (err) {
    console.error('Error in handleDownloadPdfCallback:', err);
    await bot.sendMessage(chatId, '⚠️ حدث خطأ أثناء جلب وتحميل ملف الشهادة. يرجى المحاولة مرة أخرى لاحقاً.');
  }
};
