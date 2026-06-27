import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 Supabase Config URL:', supabaseUrl);
console.log('🔍 Supabase Config Key (First 10 chars):', supabaseAnonKey ? supabaseAnonKey.substring(0, 10) + '...' : 'Missing');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('تنبيه: إعدادات Supabase غير مكتملة في ملف .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
