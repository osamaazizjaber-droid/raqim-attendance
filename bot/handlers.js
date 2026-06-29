import { supabase } from './supabase.js';

// الترحيب باللغة العربية
export const handleStart = async (bot, msg) => {
  const chatId = msg.chat.id;

  const welcomeText = `
أهلاً بك في بوت منصة <b>رَقِيم</b> الرسمي لتسجيل الحضور الجامعي! 🎓

👤 <b>للطلاب:</b>
• للحصول على بطاقة الحضور الرسمية (QR Card): أرسل <b>الرقم الجامعي</b> أو <b>الاسم الثلاثي الكامل</b> مباشرة (مثال: <code>2023/CS/0142</code>).

👨‍🏫 <b>للأساتذة:</b>
• لربط حسابك وتلقي تقارير المحاضرات تلقائياً: أرسل <b>بريدك الإلكتروني</b> المسجل بالمنصة.
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
`;
  await bot.sendMessage(chatId, helpText, { parse_mode: 'HTML' });
};

// معالجة كافة الرسائل النصية والتحكم في الحالات
export const handleTextMessage = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // نتجاهل الأوامر الرسمية التي تبدأ بـ /start أو /help لأنها تُعالج في مستمعيها الخاصين
  if (text.startsWith('/start') || text.startsWith('/help')) return;

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

    // 0. التحقق أولاً مما إذا كان حساب التيليجرام هذا مرتبطاً بالفعل بطالب مسجل
    const { data: linkedStudent, error: linkedErr } = await supabase
      .from('students')
      .select('*, colleges(name, university), departments(name)')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();

    if (linkedErr) throw linkedErr;

    if (linkedStudent) {
      student = linkedStudent;
    } else {
      // 1. محاولة البحث أولاً بمطابقة الرقم الجامعي بدقة
      const { data: studentByNum, error: numErr } = await supabase
        .from('students')
        .select('*, colleges(name, university), departments(name)')
        .eq('student_number', searchText)
        .maybeSingle();

      if (numErr) throw numErr;

      if (studentByNum) {
        student = studentByNum;
      } else {
        // 2. إذا لم يعثر عليه بالرقم، نبحث بالاسم الثلاثي (بحث جزئي ذكي)
        const { data: studentsByName, error: nameErr } = await supabase
          .from('students')
          .select('*, colleges(name, university), departments(name)')
          .ilike('full_name', `%${searchText}%`);

        if (nameErr) throw nameErr;

        if (studentsByName && studentsByName.length > 0) {
          if (studentsByName.length === 1) {
            student = studentsByName[0];
          } else {
            // وجد أكثر من طالب بنفس الاسم
            let responseMsg = `🔍 <b>تم العثور على أكثر من طالب يطابق هذا الاسم:</b>\n\n`;
            studentsByName.slice(0, 5).forEach((s, index) => {
              responseMsg += `${index + 1}. <b>الاسم:</b> ${s.full_name}\n   <b>الرقم الجامعي:</b> <code>${s.student_number}</code>\n   <b>القسم:</b> ${s.departments?.name || '-'}\n\n`;
            });
            responseMsg += `⚠️ يرجى إعادة إرسال اسمك الثلاثي الكامل بدقة، أو إرسال <b>الرقم الجامعي</b> المكتوب أمام اسمك للحصول على بطاقتك الخاصة.`;
            
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
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://raqim-attendance.vercel.app';
    const caption = `✅ <b>إليك بطاقة الحضور الرسمية الخاصة بك:</b>\n\n<b>الاسم:</b> ${student.full_name}\n<b>الرقم الجامعي:</b> ${student.student_number}\n<b>الجامعة:</b> ${student.colleges?.university || 'جامعة رقيم'}\n<b>الكلية:</b> ${student.colleges?.name || 'الكلية'}\n\n<i>احفظ هذه الصورة بجهازك لتتمكن من تسجيل حضورك بدون إنترنت بمسحها بواسطة جهاز الأستاذ.</i>\n\n📊 <b>للاستعلام عن نتائج امتحاناتك وتحميل شهادتك الرسمية:</b>\n<a href="${frontendUrl}/results">اضغط هنا لفتح بوابة النتائج وتنزيل الشهادة</a>\n<i>(يرجى إدخال رقمك الجامعي وحل مسألة التحقق الرياضية البسيطة التي ستظهر لك لاستلام النتيجة وتنزيل الشهادة)</i>`;

    if (student.telegram_file_id) {
      // إرسال كاش تيليجرام
      await bot.sendPhoto(chatId, student.telegram_file_id, {
        caption: caption,
        parse_mode: 'HTML'
      });
    } else {
      if (!student.qr_image_url) {
        await bot.sendMessage(chatId, '⚠️ تم العثور على اسمك، ولكن لم يتم توليد بطاقة الحضور الخاصة بك بعد. يرجى مراجعة الإدارة.');
        return;
      }

      // إرسال من رابط سوبابيس لأول مرة
      const sentMsg = await bot.sendPhoto(chatId, student.qr_image_url, {
        caption: caption,
        parse_mode: 'HTML'
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

        const path = `${student.university_id}/${student.id}.png`;
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
