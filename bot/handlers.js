import { supabase } from './supabase.js';

// مخزن حالات المستخدمين في الذاكرة لتتبع عملية البحث عن النتائج والـ CAPTCHA
const userStates = new Map();

// مساعد تحويل الأرقام إلى أرقام عربية لعرضها في الكابتشا
function toArabicNumerals(num) {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(d => arabicDigits[parseInt(d)] || d).join('');
}

// دالة لتوليد كابتشا حسابية عشوائية
function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 9) + 1; // من 1 إلى 9
  const num2 = Math.floor(Math.random() * 9) + 1; // من 1 إلى 9
  const answer = num1 + num2;
  const question = `للتحقق الأمني، كم يساوي: ${toArabicNumerals(num1)} + ${toArabicNumerals(num2)} ؟`;
  return { num1, num2, answer, question };
}

// الترحيب باللغة العربية
export const handleStart = async (bot, msg) => {
  const chatId = msg.chat.id;
  userStates.delete(chatId); // تصفير أي حالة معلقة

  const welcomeText = `
أهلاً بك في بوت منصة *رَقِيم* الرسمي لتسجيل الحضور والنتائج الجامعية! 🎓

👤 *للطلاب:*
* للحصول على بطاقة الحضور: أرسل **رقمك الجامعي** مباشرة (مثال: \`2023/CS/0142\`).
* لمعرفة درجاتك وامتحاناتك: أرسل أمر \`/results\` أو اكتب "نتائجي".

👨‍🏫 *للأساتذة:*
* لربط حسابك وتلقي تقارير المحاضرات تلقائياً: أرسل **بريدك الإلكتروني** المسجل بالمنصة.
`;
  await bot.sendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });
};

// التعليمات المساعدة
export const handleHelp = async (bot, msg) => {
  const chatId = msg.chat.id;
  userStates.delete(chatId);

  const helpText = `
💡 *تعليمات استخدام بوت رقيم:*

1️⃣ *استلام بطاقة الحضور:* أرسل رقمك الجامعي مباشرة، وسيقوم البوت بإرسال بطاقتك الشخصية المشفرة. احفظ الصورة لتظهرها للأستاذ أوفلاين في قاعة الدرس.
2️⃣ *الاستعلام عن النتائج:* اكتب أمر \`/results\` أو كلمة "نتائجي"، ثم اتبع التعليمات الموضحة للتحقق الأمني والحصول على كشف درجاتك.
3️⃣ *للأساتذة:* أرسل بريدك الإلكتروني لربط البوت وحسابك، لتستلم كشف الحضور والغياب والإحصائيات مباشرة فور إنهاء المحاضرة.
`;
  await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
};

// معالجة كافة الرسائل النصية والتحكم في الحالات
export const handleTextMessage = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // نتجاهل الأوامر الرسمية التي تبدأ بـ /start أو /help لأنها تُعالج في مستمعيها الخاصين
  if (text.startsWith('/start') || text.startsWith('/help')) return;

  try {
    // 0. التحقق من مسار طلب النتائج المبدئي
    if (text === '/results' || text === '/نتائج' || text === 'نتائجي' || text === 'نتائج') {
      userStates.set(chatId, { step: 'waiting_name' });
      await bot.sendMessage(chatId, '📋 *الاستعلام عن نتائج الامتحانات*\n\nيرجى إرسال اسمك الثلاثي كاملاً كما هو مسجل في الكلية:');
      return;
    }

    // 1. التحقق مما إذا كان المستخدم في حالة معينة لنظام النتائج
    if (userStates.has(chatId)) {
      const state = userStates.get(chatId);

      // أ. انتظار الاسم الثلاثي
      if (state.step === 'waiting_name') {
        const studentName = text;
        
        // البحث عن الاسم (تطابق جزئي غير حساس لحالة الأحرف وتجاهل الفراغات الإضافية)
        const { data: students, error: searchErr } = await supabase
          .from('students')
          .select('*, departments(name), stages(name)')
          .ilike('full_name', `%${studentName}%`);

        if (searchErr) throw searchErr;

        if (!students || students.length === 0) {
          await bot.sendMessage(chatId, '❌ عذراً، هذا الاسم غير مسجل بقاعدة بيانات الطلاب. يرجى إرسال الاسم بدقة أو مراجعة إدارة الكلية.');
          return;
        }

        if (students.length > 1) {
          // هناك تشابه في الأسماء، نطلب الرقم الجامعي للتأكيد
          const matchesIds = students.map(s => s.id);
          userStates.set(chatId, {
            step: 'waiting_student_number',
            name: studentName,
            matches: students
          });

          let disambiguationMsg = `⚠️ وجدنا أكثر من طالب يطابق هذا الاسم:\n`;
          students.forEach((s, idx) => {
            disambiguationMsg += `• ${s.full_name} (${s.departments?.name || '-'} - ${s.stages?.name || '-'})\n`;
          });
          disambiguationMsg += `\nيرجى إرسال *رقمك الجامعي المعتمد* للتأكيد وتحديد حسابك:`;

          await bot.sendMessage(chatId, disambiguationMsg, { parse_mode: 'Markdown' });
          return;
        }

        // طالب وحيد مطابق
        const targetStudent = students[0];
        const captcha = generateCaptcha();
        
        userStates.set(chatId, {
          step: 'waiting_captcha',
          studentId: targetStudent.id,
          studentName: targetStudent.full_name,
          studentDetails: targetStudent,
          captchaAnswer: captcha.answer
        });

        await bot.sendMessage(chatId, `🔒 للتحقق الأمني ومنع استخدام برمجيات التتبع:\n\n*${captcha.question}*`, { parse_mode: 'Markdown' });
        return;
      }

      // ب. انتظار الرقم الجامعي للتأكيد عند وجود تشابه أسماء
      if (state.step === 'waiting_student_number') {
        const studentNumber = text;
        const matchedStudent = state.matches.find(s => s.student_number.trim() === studentNumber);

        if (!matchedStudent) {
          await bot.sendMessage(chatId, '❌ الرقم الجامعي غير مطابق للأسماء المقترحة. يرجى إدخال الرقم الجامعي بدقة لتفادي حظر الاستعلام.');
          return;
        }

        const captcha = generateCaptcha();
        userStates.set(chatId, {
          step: 'waiting_captcha',
          studentId: matchedStudent.id,
          studentName: matchedStudent.full_name,
          studentDetails: matchedStudent,
          captchaAnswer: captcha.answer
        });

        await bot.sendMessage(chatId, `🔒 للتحقق الأمني ومنع استخدام برمجيات التتبع:\n\n*${captcha.question}*`, { parse_mode: 'Markdown' });
        return;
      }

      // ج. التحقق من الكابتشا وعرض النتيجة
      if (state.step === 'waiting_captcha') {
        const userAnswer = parseInt(text.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))); // دعم الأرقام العربية والإنجليزية
        
        if (isNaN(userAnswer) || userAnswer !== state.captchaAnswer) {
          // كابتشا خاطئة، نولد واحدة جديدة ونطلب إعادة المحاولة
          const captcha = generateCaptcha();
          userStates.set(chatId, {
            ...state,
            captchaAnswer: captcha.answer
          });
          await bot.sendMessage(chatId, `❌ إجابة خاطئة. يرجى المحاولة مجدداً:\n\n*${captcha.question}*`, { parse_mode: 'Markdown' });
          return;
        }

        // إجابة صحيحة، جلب وعرض كشف الدرجات
        await bot.sendChatAction(chatId, 'typing');

        const { data: results, error: resErr } = await supabase
          .from('results')
          .select('*, courses(name)')
          .eq('student_id', state.studentId);

        if (resErr) throw resErr;

        // جلب الشهادة الرسمية المرفوعة (إن وجدت)
        const { data: cert } = await supabase
          .from('certificates')
          .select('pdf_url')
          .eq('student_id', state.studentId)
          .maybeSingle();

        // تنظيف حالة الـ CAPTCHA
        userStates.delete(chatId);

        if (!results || results.length === 0) {
          await bot.sendMessage(chatId, `📋 نتائج الطالب: *${state.studentName}*\n\nعذراً، لم ترفع نتائج امتحاناتك لهذا العام الدراسي بعد. تواصل مع إدارة كليتك لمزيد من المعلومات.`, { parse_mode: 'Markdown' });
          return;
        }

        // صياغة وعرض كشف الدرجات
        const studentInfo = state.studentDetails;
        let resultsText = `📋 *نتائج الطالب:* ${state.studentName}\n`;
        resultsText += `🎓 *المرحلة:* ${studentInfo.stages?.name || '-'} | *القسم:* ${studentInfo.departments?.name || '-'}\n\n`;

        const gradeIcons = {
          'امتياز': '🏆 امتياز',
          'جيد جداً': '✅ جيد جداً',
          'جيد': '✅ جيد',
          'متوسط': '⚠️ متوسط',
          'مقبول': '⚠️ مقبول',
          'ضعيف': '❌ ضعيف'
        };

        results.forEach(r => {
          const badge = gradeIcons[r.grade_label] || r.grade_label;
          resultsText += `• ${r.courses?.name || 'مادة'} ............. ${badge}\n`;
        });

        if (cert?.pdf_url) {
          resultsText += `\n📜 *رابط تحميل الشهادة الرسمية (PDF):*\n[اضغط هنا لتحميل شهادتك المعتمدة](${cert.pdf_url})`;
        } else {
          resultsText += `\n⚠️ *ملاحظة:* لم تصدر شهادتك الورقية الرسمية (PDF) بعد من قبل عمادة الكلية.`;
        }

        await bot.sendMessage(chatId, resultsText, { parse_mode: 'Markdown' });
        return;
      }
    }

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
✅ *أهلاً بك يا دكتور ${professor.name}!*
تم تفعيل البوت وربطه بحسابك كأستاذ في منصة *رَقِيم* بنجاح.

📧 *البريد الإلكتروني:* ${professor.email}
🎓 *ستتلقى تقرير الحضور التفصيلي تلقائياً عبر تيليجرام فور انتهاء كل محاضرة تقوم بتسجيلها.*
`;
      await bot.sendMessage(chatId, successMsg, { parse_mode: 'Markdown' });
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
            let responseMsg = `🔍 *تم العثور على أكثر من طالب يطابق هذا الاسم:*\n\n`;
            studentsByName.slice(0, 5).forEach((s, index) => {
              responseMsg += `${index + 1}. *الاسم:* ${s.full_name}\n   *الرقم الجامعي:* \`${s.student_number}\`\n   *القسم:* ${s.departments?.name || '-'}\n\n`;
            });
            responseMsg += `⚠️ يرجى إعادة إرسال اسمك الثلاثي الكامل بدقة، أو إرسال *الرقم الجامعي* المكتوب أمام اسمك للحصول على بطاقتك الخاصة.`;
            
            await bot.sendMessage(chatId, responseMsg, { parse_mode: 'Markdown' });
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

    const caption = `✅ *إليك بطاقة الحضور الرسمية الخاصة بك:*\n\n*الاسم:* ${student.full_name}\n*الرقم الجامعي:* ${student.student_number}\n*الجامعة:* ${student.colleges?.university || 'جامعة رقيم'}\n*الكلية:* ${student.colleges?.name || 'الكلية'}\n\n_احفظ هذه الصورة بجهازك لتتمكن من تسجيل حضورك بدون إنترنت بمسحها بواسطة جهاز الأستاذ._`;

    if (student.telegram_file_id) {
      // إرسال كاش تيليجرام
      await bot.sendPhoto(chatId, student.telegram_file_id, {
        caption: caption,
        parse_mode: 'Markdown'
      });
    } else {
      if (!student.qr_image_url) {
        await bot.sendMessage(chatId, '⚠️ تم العثور على اسمك، ولكن لم يتم توليد بطاقة الحضور الخاصة بك بعد. يرجى مراجعة الإدارة.');
        return;
      }

      // إرسال من رابط سوبابيس لأول مرة
      const sentMsg = await bot.sendPhoto(chatId, student.qr_image_url, {
        caption: caption,
        parse_mode: 'Markdown'
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
