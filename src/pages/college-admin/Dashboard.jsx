import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Folder, 
  Users, 
  GraduationCap, 
  LogOut, 
  Activity,
  ArrowRightLeft,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Skeleton } from '../../components/ui/Skeleton';
import logo from '../../assets/logo.png';
import styles from '../../styles/admin.module.css';

// مكون الشريط الجانبي لمدير الكلية
export function CollegeAdminSidebar({ activePage }) {
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
        <span style={{ fontWeight: '900', color: 'var(--text-primary)' }}>رقيم — مدير الكلية</span>
      </div>
      <div style={{ padding: '0 1rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
        🏛️ {adminDetails?.universities?.name || 'الجامعة'}
      </div>
      <nav className={styles.sidebarMenu}>
        <Link 
          to="/college-admin/dashboard" 
          className={`${styles.navLink} ${activePage === 'dashboard' ? styles.navLinkActive : ''}`}
        >
          <Activity size={20} />
          <span>لوحة الإحصائيات</span>
        </Link>
        <Link 
          to="/college-admin/departments" 
          className={`${styles.navLink} ${activePage === 'departments' ? styles.navLinkActive : ''}`}
        >
          <Folder size={20} />
          <span>الهيكل الأكاديمي</span>
        </Link>
        <Link 
          to="/college-admin/professors" 
          className={`${styles.navLink} ${activePage === 'professors' ? styles.navLinkActive : ''}`}
        >
          <Users size={20} />
          <span>إدارة الأساتذة</span>
        </Link>
        <Link 
          to="/college-admin/students" 
          className={`${styles.navLink} ${activePage === 'students' ? styles.navLinkActive : ''}`}
        >
          <GraduationCap size={20} />
          <span>إدارة الطلاب</span>
        </Link>
        <Link 
          to="/college-admin/migration" 
          className={`${styles.navLink} ${activePage === 'migration' ? styles.navLinkActive : ''}`}
        >
          <ArrowRightLeft size={20} />
          <span>ترحيل الطلاب</span>
        </Link>
        <Link 
          to="/college-admin/results" 
          className={`${styles.navLink} ${activePage === 'results' ? styles.navLinkActive : ''}`}
        >
          <FileText size={20} />
          <span>النتائج والشهادات</span>
        </Link>
        <Link 
          to="/college-admin/reports" 
          className={`${styles.navLink} ${activePage === 'reports' ? styles.navLinkActive : ''}`}
        >
          <FileSpreadsheet size={20} />
          <span>تقارير الحضور</span>
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

export default function CollegeAdminDashboard() {
  const { adminDetails } = useAuth();
  const [stats, setStats] = useState({
    departments: 0,
    professors: 0,
    students: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (adminDetails?.college_id) {
      fetchStats();
    }
  }, [adminDetails]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const cId = adminDetails.college_id;
      
      // 1. عدد الأقسام
      const { count: deptCount } = await supabase
        .from('departments')
        .select('*', { count: 'exact', head: true })
        .eq('college_id', cId);

      // 2. عدد الأساتذة
      const { count: profCount } = await supabase
        .from('professors')
        .select('*', { count: 'exact', head: true })
        .eq('college_id', cId);

      // 3. عدد الطلاب
      const { count: studCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('college_id', cId);

      setStats({
        departments: deptCount || 0,
        professors: profCount || 0,
        students: studCount || 0
      });
    } catch (err) {
      console.error('Error fetching college stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.adminLayout}>
      <CollegeAdminSidebar activePage="dashboard" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>لوحة التحكم — إدارة الكلية</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              مرحباً بك يا {adminDetails?.name || 'مدير الكلية'}
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
                <h3>الأقسام العلمية</h3>
                <div className={styles.statNumber}>{stats.departments}</div>
              </div>
              <div className={styles.statIcon}>
                <Folder size={28} />
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
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>صلاحيات إدارة الكلية 🏛️</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.7' }}>
            بصفتك مديراً للكلية، يمكنك تهيئة الهياكل الأكاديمية (الأقسام، المراحل، المواد)، وتعيين عدد الوحدات للمواد. كما يمكنك تسجيل الأساتذة وإسناد المواد إليهم، واستيراد كشوف الطلاب والدرجات، وترحيل الطلاب بين المراحل في نهاية كل عام دراسي، وتوليد شهادات النتائج بصيغة PDF.
          </p>
        </div>
      </div>
    </div>
  );
}
