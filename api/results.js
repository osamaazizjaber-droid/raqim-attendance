import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { studentNumber } = req.query || req.body || {};

  if (!studentNumber) {
    return res.status(400).json({ error: 'الرقم الجامعي مطلوب' });
  }

  try {
    // تطبيع الرقم الجامعي (تحويل الأرقام الشرقية/الفارسية إلى إنجليزية، وتكبير الأحرف وإزالة المسافات)
    const normalizedStudentNumber = studentNumber
      .trim()
      .toUpperCase()
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

    // الاستعلام عن الطالب باستخدام مفتاح الخدمة (Service Role) لتخطي RLS بأمان في الخلفية
    const { data: student, error: studErr } = await supabase
      .from('students')
      .select('*, departments(name), stages(name), colleges(name, university)')
      .ilike('student_number', normalizedStudentNumber)
      .maybeSingle();

    if (studErr) throw studErr;

    if (!student) {
      return res.status(404).json({ error: 'الرقم الجامعي المدخل غير موجود، يرجى التأكد منه.' });
    }

    // جلب نتائج امتحانات الطالب
    const { data: results, error: resErr } = await supabase
      .from('results')
      .select('*, courses(name)')
      .eq('student_id', student.id)
      .order('created_at', { ascending: true });

    if (resErr) throw resErr;

    return res.status(200).json({ student, results });
  } catch (err) {
    console.error('Error in results API:', err);
    return res.status(500).json({ error: 'حدث خطأ غير متوقع أثناء معالجة البحث.' });
  }
}
