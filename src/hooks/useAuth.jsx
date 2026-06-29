import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({
  user: null,
  role: null, // 'super-admin' | 'university-admin' | 'college-admin' | 'professor'
  adminDetails: null,
  professor: null,
  loading: true,
  error: null,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [adminDetails, setAdminDetails] = useState(null);
  const [professor, setProfessor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkUserRole = async (sessionUser) => {
    if (!sessionUser) {
      setUser(null);
      setRole(null);
      setAdminDetails(null);
      setProfessor(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const superAdminEmail = import.meta.env.VITE_SUPER_ADMIN_EMAIL;
      
      // 1. التحقق مما إذا كان البريد هو البريد الخاص بالمدير العام
      if (sessionUser.email === superAdminEmail) {
        setUser(sessionUser);
        setRole('super-admin');
        setAdminDetails({ role: 'super-admin', name: 'المشرف العام' });
        setProfessor(null);
        setLoading(false);
        return;
      }

      // 2. التحقق من جدول المدراء (جامعة أو كلية)
      const { data: admin, error: adminErr } = await supabase
        .from('admins')
        .select('*, universities(name, subscription_expires_at)')
        .eq('user_id', sessionUser.id)
        .maybeSingle();

      if (adminErr) throw adminErr;

      if (admin) {
        setUser(sessionUser);
        setRole(admin.role === 'university' ? 'university-admin' : 'college-admin');
        setAdminDetails(admin);
        setProfessor(null);
        setLoading(false);
        return;
      }

      // 3. التحقق من جدول الأساتذة
      const { data: prof, error: profErr } = await supabase
        .from('professors')
        .select('*, universities(name, subscription_expires_at)')
        .eq('user_id', sessionUser.id)
        .maybeSingle();

      if (profErr) throw profErr;

      if (prof) {
        setUser(sessionUser);
        setRole('professor');
        setProfessor(prof);
        setAdminDetails(null);
        setLoading(false);
        return;
      }

      // مستخدم مسجل ولكن ليس له سجل أستاذ أو أدمن
      await supabase.auth.signOut();
      throw new Error('غير مصرح لك بالوصول، الحساب غير مسجل بالمنصة.');
    } catch (err) {
      console.error('Error checking user role:', err);
      setError(err.message || 'حدث خطأ أثناء تحديد دور المستخدم');
      setUser(null);
      setRole(null);
      setAdminDetails(null);
      setProfessor(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // جلب الجلسة الحالية عند تحميل الصفحة
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkUserRole(session.user);
      } else {
        setLoading(false);
      }
    });

    // الاستماع لتغييرات حالة تسجيل الدخول
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          await checkUserRole(session.user);
        } else {
          setUser(null);
          setRole(null);
          setAdminDetails(null);
          setProfessor(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) {
      console.error('❌ Detailed Login Error:', loginError);
      setLoading(false);
      let arabicMsg = `فشل تسجيل الدخول: ${loginError.message || JSON.stringify(loginError)}`;
      if (loginError.message && loginError.message.includes('Invalid login credentials')) {
        arabicMsg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      }
      setError(arabicMsg);
      throw new Error(arabicMsg);
    }
  };

  const logout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setAdminDetails(null);
    setProfessor(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, role, adminDetails, professor, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
