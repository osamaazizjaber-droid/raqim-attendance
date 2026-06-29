import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Building, 
  Users, 
  GraduationCap, 
  LogOut, 
  Activity,
  School
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Skeleton } from '../../components/ui/Skeleton';
import logo from '../../assets/logo.png';
import styles from '../../styles/admin.module.css';

// مكون الشريط الجانبي لمدير الجامعة
export function UniversityAdminSidebar({ activePage }) {
  const { logout, adminDetails } = useAuth();
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
        <span style={{ fontWeight: '900', color: 'var(--text-primary)' }}>رقيم — مدير الجامعة</span>
      </div>
      <div style={{ padding: '0 1rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
        🏛️ {adminDetails?.universities?.name || 'جامعتنا'}
      </div>
      <nav className={styles.sidebarMenu}>
        <Link 
          to="/university-admin/dashboard" 
          className={`${styles.navLink} ${activePage === 'dashboard' ? styles.navLinkActive : ''}`}
        >
          <Activity size={20} />
          <span>لوحة التحكم</span>
        </Link>
        <Link 
          to="/university-admin/colleges" 
          className={`${styles.navLink} ${activePage === 'colleges' ? styles.navLinkActive : ''}`}
        >
          <Building size={20} />
          <span>إدارة الكليات</span>
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

export default function UniversityAdminDashboard() {
  const { adminDetails } = useAuth();
  const [stats, setStats] = useState({
    colleges: 0,
    professors: 0,
    students: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (adminDetails?.university_id) {
      fetchStats();
    }
  }, [adminDetails]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const uId = adminDetails.university_id;
      
      // 1. عدد الكليات
      const { count: collegeCount } = await supabase
        .from('colleges')
        .select('*', { count: 'exact', head: true })
        .eq('university_id', uId);

      // 2. عدد الأساتذة
      const { count: profCount } = await supabase
        .from('professors')
        .select('*', { count: 'exact', head: true })
        .eq('university_id', uId);

      // 3. عدد الطلاب
      const { count: studCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('university_id', uId);

      setStats({
        colleges: collegeCount || 0,
        professors: profCount || 0,
        students: studCount || 0
      });
    } catch (err) {
      console.error('Error fetching university stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.adminLayout}>
      <UniversityAdminSidebar activePage="dashboard" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>لوحة إدارة الجامعة</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              مرحباً بك يا {adminDetails?.name || 'مدير الجامعة'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className={styles.statsGrid}>
            <Skeleton height="120px" />
            <Skeleton height="120px" />
            <Skeleton height="120px" />
          </div>
        ) : (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statInfo}>
                <h3>إجمالي الكليات</h3>
                <div className={styles.statNumber}>{stats.colleges}</div>
              </div>
              <div className={styles.statIcon}>
                <Building size={28} />
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statInfo}>
                <h3>الأساتذة المسجلين</h3>
                <div className={styles.statNumber}>{stats.professors}</div>
              </div>
              <div className={styles.statIcon} style={{ color: 'var(--success)', backgroundColor: 'var(--success-light)' }}>
                <Users size={28} />
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statInfo}>
                <h3>الطلاب المضافين</h3>
                <div className={styles.statNumber}>{stats.students}</div>
              </div>
              <div className={styles.statIcon} style={{ color: 'var(--warning)', backgroundColor: 'var(--warning-light)' }}>
                <GraduationCap size={28} />
              </div>
            </div>
          </div>
        )}

        <div className={styles.glass} style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>صلاحيات إدارة الجامعة 🔐</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' }}>
            بصفتك مديراً للجامعة، تقتصر صلاحياتك على جامعتمك الحالية فقط. يمكنك إضافة الكليات المختلفة، وتفعيل حسابات مدراء الكليات (College Admins) الذين سيتولون إدارة شؤون الطلاب والدرجات والأساتذة.
          </p>
        </div>
      </div>
    </div>
  );
}
