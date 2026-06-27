import { supabase } from './supabase.js';

export const handleStart = async (bot, msg) => {
  const chatId = msg.chat.id;
  const welcomeText = `
أهلاً بك في بوت منصة *رَقِيم* لتسجيل الحضور الجامعي الذكي! 🎓

لتلقي بطاقة الحضور المخصصة لك ومسحها في القاعة الدراسية، يرجى إرسال **رقمك الجامعي** الآن (مثال: \`2023/CS/0142\`).

_ملاحظة: البوت يعمل بالكامل باللغة العربية._
`;
  await bot.sendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });
};

export const handleHelp = async (bot, msg) => {
  const chatId = msg.chat.id;
  const helpText = `
💡 *تعليمات استخدام بطاقة حضور رقيم:*

1. *استلام البطاقة:* أرسل رقمك الجامعي المعتمد إلى هذا البوت وسيقوم بالبحث عنك وإرسال البطاقة فوراً.
2. *الحفظ والاستخدام:* احفظ صورة البطاقة المرسلة إليك في معرض صور هاتفك.
3. *تسجيل الحضور:* عند دخولك للقاعة، أظهر الكود الممسوح للأستاذ ليقوم بمسحه من كاميرا هاتفه.
4. *العمل بدون إنترنت:* صورة البطاقة تكفي للتسجيل، ولا تحتاج لتوفر إنترنت لديك أثناء المحاضرة!
5. ⚠️ *تنبيه هام:* بطاقة الحضور تحتوي على توكن فريد خاص بك، مشاركة بطاقتك أو استخدامها لحضور طالب آخر يعرضك للمساءلة القانونية.
`;
  await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
};

export const handleTextMessage = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // نتجاهل الأوامر التي تبدأ بـ / لأنها تُعالج في المستمع الخاص بها
  if (text.startsWith('/')) return;

  try {
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
      // الحساب غير مرتبط بعد، سنبحث بالرقم الجامعي المرسل في النص
      const { data: student, error: searchErr } = await supabase
        .from('students')
        .select('*, universities(name)')
        .eq('student_number', text)
        .maybeSingle();

      if (searchErr) throw searchErr;

      if (!student) {
        await bot.sendMessage(chatId, '❌ الرقم الجامعي غير موجود بقاعدة البيانات، يرجى مراجعة إدارة التسجيل والقبول.');
        return;
      }

      // فحص ما إذا كان هذا الرقم الجامعي مرتبطاً بحساب تيليجرام آخر بالفعل لمنع سرقة الهويات
      if (student.telegram_chat_id && student.telegram_chat_id !== chatId) {
        await bot.sendMessage(chatId, '⚠️ هذا الرقم الجامعي مرتبط بحساب تيليجرام آخر بالفعل. يرجى مراجعة إدارة الكلية لإعادة تعيينه.');
        return;
      }

      // ربط حساب التيليجرام بالرقم الجامعي للطالب
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
