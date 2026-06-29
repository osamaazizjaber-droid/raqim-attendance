-- =========================================================================
-- Raqim Database Schema (Supabase / PostgreSQL)
-- منصة رقيم لإدارة الحضور والنتائج الجامعية
-- =========================================================================

-- تفعيل إضافات PostgreSQL المطلوبة
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- تنظيف الجداول القديمة إن وجدت لضمان بناء نظيف ومتناسق
DROP TABLE IF EXISTS telegram_resend_requests CASCADE;
DROP TABLE IF EXISTS professor_creation_requests CASCADE;
DROP TABLE IF EXISTS user_creation_requests CASCADE;
DROP TABLE IF EXISTS certificates CASCADE;
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS grade_scales CASCADE;
DROP TABLE IF EXISTS student_migrations CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS student_courses CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS professor_courses CASCADE;
DROP TABLE IF EXISTS professors CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS stages CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS colleges CASCADE;
DROP TABLE IF EXISTS universities CASCADE;
DROP TABLE IF EXISTS system_admins CASCADE;

-- 1. جدول المشرفين العامين لمنصة رقيم (Super Admins)
CREATE TABLE system_admins (
    email text PRIMARY KEY,
    created_at timestamptz DEFAULT now()
);

-- إدراج المشرف الافتراضي للمنصة
INSERT INTO system_admins (email) VALUES ('osamaazizjaber@gmail.com') ON CONFLICT DO NOTHING;

-- 2. جدول الجامعات
CREATE TABLE universities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    city text,
    subscription_expires_at date NOT NULL DEFAULT (now() + interval '1 year')::date,
    created_at timestamptz DEFAULT now()
);

-- 3. جدول الكليات التابعة للجامعة
CREATE TABLE colleges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    university_id uuid REFERENCES universities(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 4. جدول الأقسام التابعة للكليات
CREATE TABLE departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id uuid REFERENCES colleges(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 5. جدول المراحل الدراسية
CREATE TABLE stages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE, -- مثل: المرحلة الأولى، الثانية، الثالثة، الرابعة، الخامسة
    created_at timestamptz DEFAULT now()
);

-- إدراج المراحل الافتراضية
INSERT INTO stages (name) VALUES 
('المرحلة الأولى'),
('المرحلة الثانية'),
('المرحلة الثالثة'),
('المرحلة الرابعة'),
('المرحلة الخامسة')
ON CONFLICT DO NOTHING;

-- 6. جدول المواد الدراسية (Courses)
CREATE TABLE courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
    stage_id uuid REFERENCES stages(id) ON DELETE CASCADE,
    units int DEFAULT 1,
    created_at timestamptz DEFAULT now()
);

-- 7. جدول مدراء النظام (University & College Admins)
CREATE TABLE admins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    role text NOT NULL CHECK (role IN ('university', 'college')),
    university_id uuid REFERENCES universities(id) ON DELETE CASCADE,
    college_id uuid REFERENCES colleges(id) ON DELETE CASCADE, -- NULL لمدير الجامعة
    created_at timestamptz DEFAULT now()
);

-- 8. جدول الأساتذة
CREATE TABLE professors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    university_id uuid REFERENCES universities(id) ON DELETE CASCADE,
    college_id uuid REFERENCES colleges(id) ON DELETE CASCADE,
    subscription_expires_at date NOT NULL,
    telegram_chat_id bigint,
    created_at timestamptz DEFAULT now()
);

-- 9. جدول ربط الأساتذة بالمواد
CREATE TABLE professor_courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professor_id uuid REFERENCES professors(id) ON DELETE CASCADE,
    course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(professor_id, course_id)
);

-- 10. جدول الطلاب
CREATE TABLE students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    university_id uuid REFERENCES universities(id) ON DELETE SET NULL,
    college_id uuid REFERENCES colleges(id) ON DELETE SET NULL,
    department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
    stage_id uuid REFERENCES stages(id) ON DELETE SET NULL,
    full_name text NOT NULL,
    student_number text NOT NULL UNIQUE,
    qr_token uuid UNIQUE DEFAULT gen_random_uuid(),
    qr_image_url text,
    telegram_chat_id bigint,
    telegram_file_id text,
    study_type text DEFAULT 'صباحي' CHECK (study_type IN ('صباحي', 'مسائي')),
    created_at timestamptz DEFAULT now()
);

-- 11. جدول المواد والسنوات الأكاديمية المسجل بها الطالب (الانتظام والإعادة)
CREATE TABLE student_courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES students(id) ON DELETE CASCADE,
    course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
    academic_year text NOT NULL, -- مثل "2025/2026"
    type text DEFAULT 'regular' CHECK (type IN ('regular', 'repeat')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(student_id, course_id, academic_year)
);

-- 12. جدول جلسات الحضور (Attendance Sessions)
CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professor_id uuid REFERENCES professors(id) ON DELETE CASCADE,
    course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
    study_type text DEFAULT 'صباحي' CHECK (study_type IN ('صباحي', 'مسائي')),
    started_at timestamptz DEFAULT now(),
    ended_at timestamptz,
    is_open boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 13. جدول تسجيل الحضور الفعلي
CREATE TABLE attendance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
    student_id uuid REFERENCES students(id) ON DELETE CASCADE,
    scanned_at timestamptz DEFAULT now(),
    UNIQUE(session_id, student_id)
);

-- 14. جدول ترحيل الطلاب للمراحل
CREATE TABLE student_migrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES students(id) ON DELETE CASCADE,
    from_stage_id uuid REFERENCES stages(id) ON DELETE CASCADE,
    to_stage_id uuid REFERENCES stages(id) ON DELETE CASCADE,
    migrated_at timestamptz DEFAULT now(),
    migrated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 15. جدول مقياس التقديرات الثابت
CREATE TABLE grade_scales (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    min_score int NOT NULL,
    max_score int NOT NULL,
    label text NOT NULL
);

-- تغذية جدول التقديرات بالبيانات الافتراضية
INSERT INTO grade_scales (min_score, max_score, label) VALUES
(0, 49, 'ضعيف'),
(50, 59, 'مقبول'),
(60, 69, 'متوسط'),
(70, 79, 'جيد'),
(80, 89, 'جيد جداً'),
(90, 100, 'امتياز')
ON CONFLICT DO NOTHING;

-- 16. جدول نتائج درجات الطلاب
CREATE TABLE results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES students(id) ON DELETE CASCADE,
    course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
    academic_year text NOT NULL,
    score numeric NOT NULL CHECK (score >= 0 AND score <= 100),
    grade_label text NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(student_id, course_id, academic_year)
);

-- 17. جدول الشهادات الأكاديمية المولدة
CREATE TABLE certificates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES students(id) ON DELETE CASCADE,
    academic_year text NOT NULL,
    overall_grade text NOT NULL,
    is_passed boolean NOT NULL,
    pdf_url text,
    generated_at timestamptz DEFAULT now(),
    generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(student_id, academic_year)
);

-- 18. طابور طلبات إعادة الإرسال عبر البوت
CREATE TABLE telegram_resend_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES students(id) ON DELETE CASCADE,
    status text DEFAULT 'pending', -- pending, processing, completed, failed
    error_message text,
    created_at timestamptz DEFAULT now()
);

-- 19. طابور طلبات إنشاء المستخدمين (المدراء والأساتذة) عبر البوت لتجاوز قيود RLS
CREATE TABLE user_creation_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    password text NOT NULL,
    name text NOT NULL,
    role text NOT NULL CHECK (role IN ('university', 'college', 'professor')),
    university_id uuid REFERENCES universities(id) ON DELETE CASCADE,
    college_id uuid REFERENCES colleges(id) ON DELETE CASCADE,
    subscription_expires_at date, -- للأستاذ فقط
    status text NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    error_message text,
    created_at timestamptz DEFAULT now()
);

-- =========================================================================
-- دالات الأمان والمساعدات (Security Functions & Helpers)
-- =========================================================================

-- دالة للتحقق من هوية المشرف العام
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM system_admins
    WHERE email = (auth.jwt() ->> 'email')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة جلب معرف الأستاذ للمستخدم الحالي
CREATE OR REPLACE FUNCTION get_professor_id()
RETURNS uuid AS $$
DECLARE
  prof_id uuid;
BEGIN
  SELECT id INTO prof_id FROM professors
  WHERE user_id = auth.uid();
  RETURN prof_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة جلب معرف جامعة المشرف للمستخدم الحالي
CREATE OR REPLACE FUNCTION get_admin_university_id(usr_id uuid)
RETURNS uuid AS $$
DECLARE
  univ_id uuid;
BEGIN
  SELECT university_id INTO univ_id FROM admins WHERE user_id = usr_id;
  RETURN univ_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة جلب معرف كلية المشرف للمستخدم الحالي
CREATE OR REPLACE FUNCTION get_admin_college_id(usr_id uuid)
RETURNS uuid AS $$
DECLARE
  col_id uuid;
BEGIN
  SELECT college_id INTO col_id FROM admins WHERE user_id = usr_id;
  RETURN col_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة جلب دور المشرف للمستخدم الحالي
CREATE OR REPLACE FUNCTION get_admin_role(usr_id uuid)
RETURNS text AS $$
DECLARE
  r text;
BEGIN
  SELECT role INTO r FROM admins WHERE user_id = usr_id;
  RETURN r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- سياسات حماية البيانات (Row Level Security - RLS)
-- =========================================================================

ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE professors ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_resend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_creation_requests ENABLE ROW LEVEL SECURITY;

-- 1. سياسات system_admins
CREATE POLICY "Super Admins can manage admins" ON system_admins FOR ALL USING (is_super_admin());
CREATE POLICY "Authenticated users can view admins" ON system_admins FOR SELECT TO authenticated USING (true);

-- 2. سياسات universities
CREATE POLICY "Everyone authenticated can view universities" ON universities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super Admins can manage universities" ON universities FOR ALL USING (is_super_admin());

-- 3. سياسات colleges
CREATE POLICY "Everyone authenticated can view colleges" ON colleges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super Admin and Univ Admin can manage colleges" ON colleges FOR ALL USING (
  is_super_admin() OR 
  (university_id = get_admin_university_id(auth.uid()) AND get_admin_role(auth.uid()) = 'university')
);

-- 4. سياسات departments
CREATE POLICY "Everyone authenticated can view departments" ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super Admin and College Admin can manage departments" ON departments FOR ALL USING (
  is_super_admin() OR 
  (college_id = get_admin_college_id(auth.uid()) AND get_admin_role(auth.uid()) = 'college')
);

-- 5. سياسات stages
CREATE POLICY "Everyone authenticated can view stages" ON stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage stages" ON stages FOR ALL USING (is_super_admin() OR get_admin_role(auth.uid()) IS NOT NULL);

-- 6. سياسات courses
CREATE POLICY "Everyone authenticated can view courses" ON courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super Admin and College Admin can manage courses" ON courses FOR ALL USING (
  is_super_admin() OR 
  department_id IN (
    SELECT id FROM departments 
    WHERE college_id = get_admin_college_id(auth.uid()) 
    AND get_admin_role(auth.uid()) = 'college'
  )
);

-- 7. سياسات admins
CREATE POLICY "Admins can view matching admin profiles" ON admins FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR 
  is_super_admin() OR 
  (university_id = get_admin_university_id(auth.uid()) AND get_admin_role(auth.uid()) = 'university')
);
CREATE POLICY "Super Admin and Univ Admin can write admins" ON admins FOR ALL USING (
  is_super_admin() OR 
  (
    university_id = get_admin_university_id(auth.uid()) 
    AND get_admin_role(auth.uid()) = 'university' 
    AND role = 'college'
  )
);

-- 8. سياسات professors
CREATE POLICY "Professors can be viewed by admins and themselves" ON professors FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR 
  is_super_admin() OR 
  college_id = get_admin_college_id(auth.uid()) OR
  university_id = get_admin_university_id(auth.uid())
);
CREATE POLICY "Super Admin and College Admin can manage professors" ON professors FOR ALL USING (
  is_super_admin() OR 
  college_id = get_admin_college_id(auth.uid())
);

-- 9. سياسات professor_courses
CREATE POLICY "Professors and admins can view course assignments" ON professor_courses FOR SELECT TO authenticated USING (
  is_super_admin() OR 
  professor_id IN (
    SELECT id FROM professors 
    WHERE user_id = auth.uid() 
    OR college_id = get_admin_college_id(auth.uid())
  )
);
CREATE POLICY "Super Admin and College Admin can manage assignments" ON professor_courses FOR ALL USING (
  is_super_admin() OR 
  professor_id IN (
    SELECT id FROM professors 
    WHERE college_id = get_admin_college_id(auth.uid())
  )
);

-- 10. سياسات students
CREATE POLICY "Everyone authenticated can view students" ON students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super Admin and College Admin can manage students" ON students FOR ALL USING (
  is_super_admin() OR 
  college_id = get_admin_college_id(auth.uid())
);

-- 11. سياسات student_courses
CREATE POLICY "Everyone authenticated can view student courses" ON student_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super Admin and College Admin can manage student courses" ON student_courses FOR ALL USING (
  is_super_admin() OR 
  student_id IN (
    SELECT id FROM students 
    WHERE college_id = get_admin_college_id(auth.uid())
  )
);

-- 12. سياسات sessions
CREATE POLICY "Everyone authenticated can view sessions" ON sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Professors can manage their sessions" ON sessions FOR ALL USING (
  is_super_admin() OR 
  professor_id = get_professor_id() OR 
  get_admin_college_id(auth.uid()) = (SELECT college_id FROM professors WHERE id = professor_id)
);

-- 13. سياسات attendance
CREATE POLICY "Everyone authenticated can view attendance" ON attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Professors can manage session attendance" ON attendance FOR ALL USING (
  is_super_admin() OR 
  session_id IN (SELECT id FROM sessions WHERE professor_id = get_professor_id())
);

-- 14. سياسات student_migrations
CREATE POLICY "Everyone authenticated can view student migrations" ON student_migrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "College admins can log migrations" ON student_migrations FOR ALL USING (
  is_super_admin() OR 
  get_admin_role(auth.uid()) = 'college'
);

-- 15. سياسات results
CREATE POLICY "Public results read access" ON results FOR SELECT USING (true);
CREATE POLICY "Super Admin and College Admin can manage results" ON results FOR ALL USING (
  is_super_admin() OR 
  student_id IN (
    SELECT id FROM students 
    WHERE college_id = get_admin_college_id(auth.uid())
  )
);

-- 16. سياسات certificates
CREATE POLICY "Public certificates read access" ON certificates FOR SELECT USING (true);
CREATE POLICY "Super Admin and College Admin can manage certificates" ON certificates FOR ALL USING (
  is_super_admin() OR 
  student_id IN (
    SELECT id FROM students 
    WHERE college_id = get_admin_college_id(auth.uid())
  )
);

-- 17. سياسات telegram_resend_requests
CREATE POLICY "Admins can manage resend requests" ON telegram_resend_requests FOR ALL USING (
  is_super_admin() OR 
  get_admin_role(auth.uid()) = 'college'
);

-- 18. سياسات user_creation_requests
CREATE POLICY "Admins can manage creation requests" ON user_creation_requests FOR ALL USING (
  is_super_admin() OR 
  get_admin_role(auth.uid()) IS NOT NULL
);

-- =========================================================================
-- تفعيل البث اللحظي (Supabase Realtime)
-- =========================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE telegram_resend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE user_creation_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;

-- =========================================================================
-- دالة إنشاء حساب مستخدم جديد مباشرة (RPC - Direct User Creation)
-- =========================================================================

CREATE OR REPLACE FUNCTION create_new_user(
  p_email text,
  p_password text,
  p_name text,
  p_role text,
  p_university_id uuid,
  p_college_id uuid DEFAULT NULL,
  p_subscription_expires_at date DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  new_user_id uuid;
  encrypted_pw text;
BEGIN
  -- 1. التحقق من صلاحية المنشئ للعملية
  IF NOT (
    is_super_admin() OR 
    get_admin_role(auth.uid()) = 'university' OR 
    get_admin_role(auth.uid()) = 'college'
  ) THEN
    RAISE EXCEPTION 'غير مصرح لك بإنشاء مستخدمين جدد في المنصة';
  END IF;

  -- 2. التحقق من وجود المستخدم مسبقاً في auth.users
  SELECT id INTO new_user_id FROM auth.users WHERE email = p_email;

  IF new_user_id IS NOT NULL THEN
    -- التحقق مما إذا كان لديه بروفايل في جدول admins أو professors
    IF EXISTS (SELECT 1 FROM admins WHERE user_id = new_user_id) OR 
       EXISTS (SELECT 1 FROM professors WHERE user_id = new_user_id) THEN
      RAISE EXCEPTION 'البريد الإلكتروني المدخل مسجل بالفعل في النظام ومربوط بملف شخصي';
    ELSE
      -- الحساب معلق في auth.users بلا ملف شخصي، نقوم بإعادة تهيئته وربطه
      encrypted_pw := crypt(p_password, gen_salt('bf'));
      UPDATE auth.users 
      SET encrypted_password = encrypted_pw, 
          raw_user_meta_data = jsonb_build_object('full_name', p_name),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = new_user_id;
    END IF;
  ELSE
    -- 3. تشفير كلمة المرور بنمط bcrypt متوافق مع Supabase Auth
    encrypted_pw := crypt(p_password, gen_salt('bf'));

    -- 4. إدخال المستخدم في جدول auth.users التابع لسوبابيس
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      p_email,
      encrypted_pw,
      now(), -- تأكيد فوري لتجاوز إيميل التحقق
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', p_name),
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO new_user_id;
  END IF;

  -- 5. إدخال البيانات في الجدول المناسب للدور
  IF p_role = 'university' OR p_role = 'college' THEN
    INSERT INTO admins (user_id, name, email, role, university_id, college_id)
    VALUES (new_user_id, p_name, p_email, p_role, p_university_id, p_college_id);
  ELSIF p_role = 'professor' THEN
    INSERT INTO professors (user_id, name, email, university_id, college_id, subscription_expires_at)
    VALUES (new_user_id, p_name, p_email, p_university_id, p_college_id, COALESCE(p_subscription_expires_at, (now() + interval '1 year')::date));
  END IF;

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
