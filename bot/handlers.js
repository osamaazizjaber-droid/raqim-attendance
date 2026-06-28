import { supabase } from './supabase.js';

export const handleStart = async (bot, msg) => {
  const chatId = msg.chat.id;
  const welcomeText = `
أهلاً بك في بوت منصة *رَقِيم* لتسجيل الحضور الجامعي الذكي! 🎓

👤 *للطلاب:* يرجى إرسال **اسمك الكامل (الثلاثي أو الرباعي)** الآن للحصول على بطاقة الحضور وتفعيل حسابك.

👨‍🏫 *للأساتذة:* يرجى إرسال **بريدك الإلكتروني** المسجل في المنصة لربط حسابك وتلقي تقارير حضور المحاضرات تلقائياً فور انتهائها.

_ملاحظة: البوت يعمل بالكامل باللغة العربية._
`;
  await bot.sendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });
};

export const handleHelp = async (bot, msg) => {
  const chatId = msg.chat.id;
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
};

export const handleTextMessage = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // نتجاهل الأوامر التي تبدأ بـ / لأنها تُعالج في المستمع الخاص بها
  if (text.startsWith('/')) return;

  try {
    // 0. التحقق مما إذا كان المدخل بريداً إلكترونياً (للأستاذ)
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
        await bot.sendMessage(chatId, '⚠️ هذا البريد مرتبط بحساب تيليجرام آخر بالفعل. يرجى مراجعة الإدارة لإعادة تعيينه.');
        return;
      }

      // ربط حساب الأستاذ بالتيليجرام
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

    // إرسال حالة "جاري الكتابة" لإشعار الطالب بالاستجابة
    await bot.sendChatAction(chatId, 'upload_photo');

    // 1. فحص ما إذا كان حساب التيليجرام هذا مرتبطاً بطالب مسبقاً
    const { data: linkedStudent, error: linkErr } = await supabase
      .from('students')
      .select('*, universities(name)')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();

    if (linkErr) throw linkErr;

    let targetStudent = null;

    if (linkedStudent) {
      // الحساب مرتبط مسبقاً بطالب، سنرسل له بطاقته هو دائماً بغض النظر عن النص الذي أرسله
      targetStudent = linkedStudent;
    } else {
      // الحساب غير مرتبط بعد، سنبحث بالاسم (سواء كان ثلاثياً أو رباعياً) عبر المطابقة الجزئية
      const { data: students, error: searchErr } = await supabase
        .from('students')
        .select('*, universities(name)')
        .ilike('full_name', `${text}%`);

      if (searchErr) throw searchErr;

      if (!students || students.length === 0) {
        await bot.sendMessage(chatId, '❌ الاسم غير موجود بقاعدة البيانات. يرجى كتابة اسمك بدقة كما هو مسجل بالمنصة، أو مراجعة إدارة التسجيل والقبول.');
        return;
      }

      if (students.length > 1) {
        const matchesList = students.slice(0, 3).map(s => `• ${s.full_name}`).join('\n');
        await bot.sendMessage(chatId, `⚠️ تم العثور على أكثر من طالب يطابق هذا الاسم:\n${matchesList}\n\nيرجى كتابة اسمك الرباعي الكامل بدقة لتفعيل حسابك.`);
        return;
      }

      const student = students[0];

      // فحص ما إذا كان هذا الاسم مرتبطاً بحساب تيليجرام آخر بالفعل لمنع سرقة الهويات
      if (student.telegram_chat_id && student.telegram_chat_id !== chatId) {
        await bot.sendMessage(chatId, '⚠️ هذا الاسم مرتبط بحساب تيليجرام آخر بالفعل. يرجى مراجعة إدارة الكلية لإعادة تعيينه.');
        return;
      }

      // ربط حساب التيليجرام بالاسم الرباعي للطالب
      const { error: updateErr } = await supabase
        .from('students')
        .update({ telegram_chat_id: chatId })
        .eq('id', student.id);

      if (updateErr) throw updateErr;

      // تحديث الكائن المحلي
      student.telegram_chat_id = chatId;
      targetStudent = student;
    }

    // 2. إرسال الكرت كصورة للطالب
    const isNewLink = !linkedStudent;
    const caption = isNewLink 
      ? `✅ *تم تفعيل البوت وربطه بحسابك بنجاح!*\n\n*الاسم:* ${targetStudent.full_name}\n*الرقم الجامعي:* ${targetStudent.student_number}\n*الجامعة:* ${targetStudent.universities?.name || 'جامعة رقيم'}\n\n_لقد تم قفل حسابك بالتيليجرام على هذا الرقم الجامعي. في المرات القادمة ستحصل على بطاقتك فوراً بمجرد إرسال أي رسالة للبوت._`
      : `✅ *مرحباً بك مجدداً! إليك بطاقة الحضور الخاصة بك:*\n\n*الاسم:* ${targetStudent.full_name}\n*الرقم الجامعي:* ${targetStudent.student_number}\n*الجامعة:* ${targetStudent.universities?.name || 'جامعة رقيم'}`;

    if (targetStudent.telegram_file_id) {
      // إرسال الصورة مباشرة باستخدام معرف ملف تيليجرام المخزن (سرعة هائلة ومساحة صفرية)
      await bot.sendPhoto(chatId, targetStudent.telegram_file_id, {
        caption: caption,
        parse_mode: 'Markdown'
      });
    } else {
      // إرسال الصورة من الرابط لأول مرة وحفظ معرف الملف لحذفها من السحابة
      if (!targetStudent.qr_image_url) {
        await bot.sendMessage(chatId, '⚠️ تم العثور على اسمك، ولكن لم يتم توليد بطاقة الـ QR الخاصة بك بعد. يرجى التواصل مع إدارة النظام لتوليدها.');
        return;
      }

      const sentMsg = await bot.sendPhoto(chatId, targetStudent.qr_image_url, {
        caption: caption,
        parse_mode: 'Markdown'
      });

      const fileId = sentMsg.photo?.[sentMsg.photo.length - 1]?.file_id;
      
      if (fileId) {
        // تحديث قاعدة البيانات: تخزين معرف كاش تيليجرام وتصفير رابط سوبابيس
        await supabase
          .from('students')
          .update({ 
            telegram_file_id: fileId,
            qr_image_url: null 
          })
          .eq('id', targetStudent.id);

        // حذف الصورة من تخزين Supabase Storage فوراً لتحرير المساحة!
        const path = `${targetStudent.university_id}/${targetStudent.id}.png`;
        await supabase.storage
          .from('qr-cards')
          .remove([path]);
          
        console.log(`🧹 تم مسح الصورة من التخزين السحابي للطالب ${targetStudent.full_name} بعد استلامها وتخزينها في تيليجرام.`);
      }
    }

  } catch (err) {
    console.error('Error handling telegram message:', err);
    await bot.sendMessage(chatId, '⚠️ حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى لاحقاً.');
  }
};
