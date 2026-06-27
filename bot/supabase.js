import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// تحميل متغيرات البيئة من ملف .env (يبحث في المجلد الحالي والمجلد الأب)
dotenv.config();
dotenv.config({ path: '../.env' });

// دعم المتغيرات سواء بدأت بـ VITE_ أو لا
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('خطأ: متغيرات Supabase (URL أو Service Role Key) غير متوفرة في بيئة عمل البوت.');
  process.exit(1);
}

// تهيئة العميل باستخدام المفتاح الإداري الخدمي لتخطي الـ RLS
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
