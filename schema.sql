-- Raqim Database Schema (Supabase / PostgreSQL)
-- منصة رقيم لإدارة الحضور الجامعي

-- تفعيل إضافات PostgreSQL المطلوبة
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. جدول مدراء النظام (Super Admins)
CREATE TABLE system_admins (
    email text PRIMARY KEY,
    created_at timestamptz DEFAULT now()
);

-- إدراج حساب المدير الافتراضي (يمكن تغييره لاحقاً)
INSERT INTO system_admins (email) VALUES ('admin@raqim.com') ON CONFLICT DO NOTHING;

-- 2. جدول الجامعات
CREATE TABLE universities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    city text,
    created_at timestamptz DEFAULT now()
);

-- 3. جدول الأقسام الكليات
CREATE TABLE departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    university_id uuid REFERENCES universities(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 4. جدول المراحل الدراسية
CREATE TABLE stages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL, -- مثل: المرحلة الأولى، المرحلة الثانية...
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

-- 5. جدول المواد الدراسية (Courses)
CREATE TABLE courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
    stage_id uuid REFERENCES stages(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

-- 6. جدول الأساتذة
CREATE TABLE professors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    university_id uuid REFERENCES universities(id) ON DELETE SET NULL,
    subscription_expires_at date NOT NULL,
    telegram_chat_id bigint, -- معرّف التيليجرام لإرسال التقارير التلقائية
    created_at timestamptz DEFAULT now()
);

-- 7. جدول ربط الأساتذة بالمواد (Professor Courses)
CREATE TABLE professor_courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professor_id uuid REFERENCES professors(id) ON DELETE CASCADE,
    course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(professor_id, course_id)
);

-- 8. جدول الطلاب
CREATE TABLE students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    university_id uuid REFERENCES universities(id) ON DELETE SET NULL,
    department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
    stage_id uuid REFERENCES stages(id) ON DELETE SET NULL,
    full_name text NOT NULL,
    student_number text NOT NULL UNIQUE,
    qr_token uuid UNIQUE DEFAULT gen_random_uuid(),
    qr_image_url text,
    telegram_chat_id bigint,
    telegram_file_id text,
    created_at timestamptz DEFAULT now()
);

-- 9. جدول جلسات الحضور (Attendance Sessions)
CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professor_id uuid REFERENCES professors(id) ON DELETE CASCADE,
    course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
    study_type text DEFAULT 'صباحي',
    started_at timestamptz DEFAULT now(),
    ended_at timestamptz,
    is_open boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 10. جدول تسجيل الحضور (Attendance)
CREATE TABLE attendance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
    student_id uuid REFERENCES students(id) ON DELETE CASCADE,
    scanned_at timestamptz DEFAULT now(),
    UNIQUE(session_id, student_id)
);

-- 11. جدول طلبات إعادة إرسال كود الـ QR عبر البوت
CREATE TABLE telegram_resend_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES students(id) ON DELETE CASCADE,
    status text DEFAULT 'pending', -- pending, processing, completed, failed
    error_message text,
    created_at timestamptz DEFAULT now()
);

-- =========================================================================
-- دالات الأمان والمساعدات (Security Functions & Helpers)
-- =========================================================================

-- دالة التحقق مما إذا كان المستخدم الحالي مديراً للنظام
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM system_admins
    WHERE email = (auth.jwt() ->> 'email')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة جلب معرف الأستاذ المرتبط بالمستخدم الحالي
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

-- دالة لإنشاء مستخدم أستاذ جديد في auth.users وربطه بجدول professors
CREATE OR REPLACE FUNCTION create_professor_user(
  p_email text,
  p_password text,
  p_name text,
  p_university_id uuid,
  p_subscription_expires_at date
) RETURNS uuid SECURITY DEFINER AS $$
DECLARE
  new_user_id uuid;
BEGIN
  -- التحقق من صلاحيات المشرف
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'غير مصرح لك بإجراء هذه العملية';
  END IF;

  -- 1. إدراج في auth.users
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
    is_super_admin,
    created_at,
    updated_at,
    last_sign_in_at,
    phone,
    phone_confirmed_at,
    email_change,
    email_change_sent_at,
    phone_change,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf', 10)),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('name', p_name, 'email_verified', true),
    NULL,
    now(),
    now(),
    NULL,
    NULL,
    NULL,
    '',
    NULL,
    '',
    NULL,
    '',
    0,
    NULL,
    '',
    NULL,
    false,
    NULL,
    false
  ) RETURNING id INTO new_user_id;

  -- 2. إدراج في auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id, 'email', p_email, 'email_verified', false, 'phone_verified', false),
    'email',
    new_user_id::text,
    now(),
    now(),
    now()
  );

  -- 3. إدراج في professors
  INSERT INTO professors (
    user_id,
    name,
    email,
    university_id,
    subscription_expires_at
  ) VALUES (
    new_user_id,
    p_name,
    p_email,
    p_university_id,
    p_subscription_expires_at
  );

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql;

-- دالة لحذف الأستاذ وحسابه في auth.users
CREATE OR REPLACE FUNCTION delete_professor_user(p_professor_id uuid)
RETURNS void SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- التحقق من صلاحيات المشرف
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'غير مصرح لك بإجراء هذه العملية';
  END IF;

  SELECT user_id INTO v_user_id FROM professors WHERE id = p_professor_id;

  -- 1. حذف من auth.users (سينعكس الحذف تلقائياً على الهويات وتفرعات الحساب)
  IF v_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;

  -- 2. تأكيد حذف سجل الأستاذ
  DELETE FROM professors WHERE id = p_professor_id;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- سياسات حماية البيانات (Row Level Security - RLS)
-- =========================================================================

-- تفعيل RLS على جميع الجداول
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE professors ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_resend_requests ENABLE ROW LEVEL SECURITY;

-- 1. سياسات جدول system_admins
CREATE POLICY "Admins can manage admins" ON system_admins
    FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "Authenticated users can read admins list" ON system_admins
    FOR SELECT TO authenticated USING (true);

-- 2. سياسات جدول universities
CREATE POLICY "Everyone authenticated can view universities" ON universities
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage universities" ON universities
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 3. سياسات جدول departments
CREATE POLICY "Everyone authenticated can view departments" ON departments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage departments" ON departments
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 4. سياسات جدول stages
CREATE POLICY "Everyone authenticated can view stages" ON stages
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage stages" ON stages
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 5. سياسات جدول courses
CREATE POLICY "Everyone authenticated can view courses" ON courses
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage courses" ON courses
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 6. سياسات جدول professors
CREATE POLICY "Professors can view their own record" ON professors
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can manage professors" ON professors
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 7. سياسات جدول professor_courses
CREATE POLICY "Professors can view their own course assignments" ON professor_courses
    FOR SELECT TO authenticated USING (professor_id = get_professor_id() OR is_admin());

CREATE POLICY "Admins can manage professor courses" ON professor_courses
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 8. سياسات جدول students
CREATE POLICY "Professors and admins can view students" ON students
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage students" ON students
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 9. سياسات جدول sessions
CREATE POLICY "Professors can manage their sessions" ON sessions
    FOR ALL TO authenticated 
    USING (professor_id = get_professor_id() OR is_admin())
    WITH CHECK (professor_id = get_professor_id() OR is_admin());

-- 10. سياسات جدول attendance
CREATE POLICY "Professors can manage attendance for their sessions" ON attendance
    FOR ALL TO authenticated
    USING (
        session_id IN (SELECT id FROM sessions WHERE professor_id = get_professor_id())
        OR is_admin()
    )
    WITH CHECK (
        session_id IN (SELECT id FROM sessions WHERE professor_id = get_professor_id())
        OR is_admin()
    );

-- 11. سياسات جدول telegram_resend_requests
CREATE POLICY "Admins can manage telegram resend requests" ON telegram_resend_requests
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 12. جدول وسياسات طابور إنشاء الأساتذة
CREATE TABLE IF NOT EXISTS public.professor_creation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password text NOT NULL,
  name text NOT NULL,
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  subscription_expires_at date NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.professor_creation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage creation requests" ON public.professor_creation_requests
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- =========================================================================
-- تفعيل البث اللحظي (Supabase Realtime)
-- =========================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE telegram_resend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE professor_creation_requests;
