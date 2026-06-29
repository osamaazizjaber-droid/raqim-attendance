import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Building, 
  Users, 
  GraduationCap, 
  LogOut, 
  Activity,
  Calendar
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Skeleton } from '../../components/ui/Skeleton';
import logo from '../../assets/logo.png';
import styles from '../../styles/admin.module.css';

// مكون الشريط الجانبي للمشرف العام
export function SuperAdminSidebar({ activePage }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.logoArea} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.5rem 1rem' }}>
        <img 
          src={logo} 
          alt="Raqim Logo" 
          style={{ 
            width: '32px', 
            height: '32px', 
            borderRadius: '50%', 
            border: '1px solid rgba(245, 158, 11, 0.3)' 
          }} 
        />
        <span style={{ fontWeight: '900', color: 'var(--text-primary)' }}>رقيم — مشرف عام</span>
      </div>
      <nav className={styles.sidebarMenu}>
        <Link 
          to="/super-admin/dashboard" 
          className={`${styles.navLink} ${activePage === 'dashboard' ? styles.navLinkActive : ''}`}
        >
          <Activity size={20} />
          <span>الإحصائيات العامة</span>
        </Link>
        <Link 
          to="/super-admin/colleges" 
          className={`${styles.navLink} ${activePage === 'colleges' ? styles.navLinkActive : ''}`}
        >
          <Building size={20} />
          <span>إدارة الكليات والاشتراكات</span>
        </Link>
        <button 
          onClick={handleLogout}
          className={`${styles.navLink} ${styles.logoutBtn}`}
          style={{ width: '100%', background: 'none', border: 'none', textAlign: 'right' }}
        >
          <LogOut size={20} />
          <span>تسجيل الخروج</span>
        </button>
      </nav>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    colleges: 0,
    professors: 0,
    students: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);

        // 1. عدد الكليات
        const { count: collegeCount } = await supabase
          .from('colleges')
          .select('*', { count: 'exact', head: true });

        // 2. عدد الأساتذة
        const { count: profCount } = await supabase
          .from('professors')
          .select('*', { count: 'exact', head: true });

        // 3. عدد الطلاب
        const { count: studCount } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true });

        setStats({
          colleges: collegeCount || 0,
          professors: profCount || 0,
          students: studCount || 0
        });
      } catch (err) {
        console.error('Error fetching super admin statistics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className={styles.adminLayout}>
      <SuperAdminSidebar activePage="dashboard" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>لوحة المشرف العام للمنصة</h1>
        </div>

        {loading ? (
          <div className={styles.statsGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <Skeleton height="120px" />
            <Skeleton height="120px" />
            <Skeleton height="120px" />
          </div>
        ) : (
          <div className={styles.statsGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div className={styles.statCard}>
              <div className={styles.statInfo}>
                <h3>إجمالي الكليات المشتركة</h3>
                <div className={styles.statNumber}>{stats.colleges}</div>
              </div>
              <div className={styles.statIcon}>
                <Building size={28} />
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statInfo}>
                <h3>أعضاء الهيئة التدريسية</h3>
                <div className={styles.statNumber}>{stats.professors}</div>
              </div>
              <div className={styles.statIcon} style={{ color: 'var(--success)', backgroundColor: 'var(--success-light)' }}>
                <Users size={28} />
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statInfo}>
                <h3>الطلاب المسجلين</h3>
                <div className={styles.statNumber}>{stats.students}</div>
              </div>
              <div className={styles.statIcon} style={{ color: 'var(--warning)', backgroundColor: 'var(--warning-light)' }}>
                <GraduationCap size={28} />
              </div>
            </div>
          </div>
        )}

        <div className={styles.glass} style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>مرحباً بك في لوحة تحكم رقيم 🔐</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' }}>
            بصفتك مشرفاً عاماً على منصة رقيم، يمكنك إضافة وإدارة الكليات الجامعية المتعاقدة بشكل مباشر، وتجديد صلاحية اشتراكاتها السنوية. 
            عند تسجيل كلية جديدة، يمكنك تفعيل حساب مدير الكلية (College Admin) مباشرة لتهيئة الأقسام الدراسية، تسجيل كشوف الطلاب، والبدء باستخدام المنصة.
          </p>
        </div>
      </div>
    </div>
  );
}
