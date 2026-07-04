import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import readline from 'readline';
import { supabase } from './supabase.js';

// Load environment variables
dotenv.config();
dotenv.config({ path: '../.env' });

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN is not defined in the environment variables.');
  process.exit(1);
}

const bot = new TelegramBot(token);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('\n🤖 ===============================================');
  console.log('📢 أداة إرسال الرسائل الجماعية لمنصة رقيم (Raqim Broadcast Tool)');
  console.log('===================================================\n');

  // 1. Select target audience
  console.log('اختر فئة المستلمين:');
  console.log('1. 👤 الطلاب فقط (Students)');
  console.log('2. 👨‍🏫 الأساتذة فقط (Professors)');
  console.log('3. 🌍 الجميع (الطلاب والأساتذة)');
  
  const choice = (await askQuestion('\nأدخل رقم الاختيار (1/2/3): ')).trim();
  if (!['1', '2', '3'].includes(choice)) {
    console.log('❌ اختيار غير صالح. تم إلغاء العملية.');
    rl.close();
    return;
  }

  // 2. Fetch recipients
  let recipients = [];
  console.log('\n🔄 جاري جلب المستلمين من قاعدة البيانات...');

  try {
    if (choice === '1' || choice === '3') {
      const { data: students, error: studErr } = await supabase
        .from('students')
        .select('id, full_name, telegram_chat_id')
        .not('telegram_chat_id', 'is', null);

      if (studErr) throw studErr;
      students.forEach(s => {
        recipients.push({
          id: s.id,
          name: s.full_name,
          chatId: s.telegram_chat_id,
          type: 'طالب'
        });
      });
    }

    if (choice === '2' || choice === '3') {
      const { data: professors, error: profErr } = await supabase
        .from('professors')
        .select('id, name, telegram_chat_id')
        .not('telegram_chat_id', 'is', null);

      if (profErr) throw profErr;
      professors.forEach(p => {
        recipients.push({
          id: p.id,
          name: p.name,
          chatId: p.telegram_chat_id,
          type: 'أستاذ'
        });
      });
    }
  } catch (err) {
    console.error('❌ فشل جلب المستلمين من قاعدة البيانات:', err.message);
    rl.close();
    return;
  }

  // Remove potential duplicate chatIds (if a user is somehow registered as both with the same chatId)
  const uniqueRecipients = [];
  const seenChats = new Set();
  recipients.forEach(r => {
    if (!seenChats.has(r.chatId)) {
      seenChats.add(r.chatId);
      uniqueRecipients.push(r);
    }
  });

  if (uniqueRecipients.length === 0) {
    console.log('ℹ️ لا يوجد مستخدمين مرتبطين بالبوت من الفئة المحددة حالياً.');
    rl.close();
    return;
  }

  console.log(`✅ تم العثور على (${uniqueRecipients.length}) مستخدم مرتبط بالبوت.`);

  // 3. Write message
  console.log('\n---------------------------------------------------');
  console.log('اكتب نص الرسالة التي ترغب في إرسالها.');
  console.log('• يمكنك استخدام أكواد HTML المدعومة في تيليجرام:');
  console.log('  <b>نص عريض</b>, <i>نص مائل</i>, <code>كود</code>, <a href="رابط">عنوان الرابط</a>');
  console.log('• اكتب \\n لعمل سطر جديد.');
  console.log('---------------------------------------------------\n');

  const rawMessage = await askQuestion('نص الرسالة:\n> ');
  if (!rawMessage || rawMessage.trim() === '') {
    console.log('❌ لا يمكن إرسال رسالة فارغة. تم إلغاء العملية.');
    rl.close();
    return;
  }

  const messageText = rawMessage.replace(/\\n/g, '\n');

  console.log('\n📄 معاينة الرسالة قبل الإرسال:');
  console.log('---------------------------------------------------');
  console.log(messageText);
  console.log('---------------------------------------------------');

  // 4. Confirm action
  const confirm = (await askQuestion(`\n⚠️ هل أنت متأكد من رغبتك في إرسال هذه الرسالة إلى ${uniqueRecipients.length} مستخدم؟ (y/N): `)).trim().toLowerCase();
  if (confirm !== 'y' && confirm !== 'yes') {
    console.log('❌ تم إلغاء عملية الإرسال.');
    rl.close();
    return;
  }

  // 5. Broadcast loop
  console.log('\n🚀 جاري بدء إرسال الرسائل...');
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < uniqueRecipients.length; i++) {
    const user = uniqueRecipients[i];
    try {
      await bot.sendMessage(user.chatId, messageText, { parse_mode: 'HTML' });
      successCount++;
      console.log(`[${i + 1}/${uniqueRecipients.length}] ✅ تم الإرسال إلى ${user.type}: ${user.name}`);
    } catch (sendErr) {
      failCount++;
      console.error(`[${i + 1}/${uniqueRecipients.length}] ❌ فشل الإرسال إلى ${user.type}: ${user.name} (${user.chatId}) - السبب: ${sendErr.message}`);
    }

    // Delay to respect Telegram's limit (max 30 messages per second)
    // We wait 100ms between each message
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n📊 ===============================================');
  console.log('📈 تقرير إرسال الرسائل الجماعية:');
  console.log(`• إجمالي المستهدفين: ${uniqueRecipients.length}`);
  console.log(`• نجاح الإرسال: ${successCount}`);
  console.log(`• فشل الإرسال: ${failCount}`);
  console.log('===================================================\n');

  rl.close();
}

main().catch(err => {
  console.error('❌ حدث خطأ غير متوقع:', err);
  rl.close();
});
