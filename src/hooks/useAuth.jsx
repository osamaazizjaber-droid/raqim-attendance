import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({
  user: null,
  isAdmin: false,
  professor: null,
  loading: true,
  error: null,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [professor, setProfessor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkUserRole = async (sessionUser) => {
    if (!sessionUser) {
      setUser(null);
      setIsAdmin(false);
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
        setIsAdmin(true);
        setProfessor(null);
        setLoading(false);
        return;
      }

      // 2. التحقق من جدول الأساتذة
      const { data, error: profError } = await supabase
        .from('professors')
        .select('*')
        .eq('user_id', sessionUser.id)
        .maybeSingle();

      if (profError) {
        throw profError;
      }

      if (data) {
        setUser(sessionUser);
        setIsAdmin(false);
        setProfessor(data);
      } else {
        // مستخدم مسجل ولكن ليس له سجل أستاذ وليس أدمن
        await supabase.auth.signOut();
        throw new Error('غير مصرح لك بالوصول، البريد غير مسجل كأستاذ.');
      }
    } catch (err) {
      console.error('Error checking user role:', err);
      setError(err.message || 'حدث خطأ أثناء تحديد دور المستخدم');
      setUser(null);
      setIsAdmin(false);
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
          setIsAdmin(false);
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
    setIsAdmin(false);
    setProfessor(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, professor, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
