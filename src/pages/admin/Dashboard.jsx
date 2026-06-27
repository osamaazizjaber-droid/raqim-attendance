import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  School, 
  Users, 
  GraduationCap, 
  FileSpreadsheet, 
  LogOut, 
  Activity,
  Calendar
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Skeleton } from '../../components/ui/Skeleton';
import logo from '../../assets/logo.png';
import styles from '../../styles/admin.module.css';

// مكون الشريط الجانبي المشترك (Sidebar)
export function AdminSidebar({ activePage }) {
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
        <span style={{ fontWeight: '900', color: 'var(--text-primary)' }}>رقيم — أدمين</span>
      </div>
      <nav className={styles.sidebarMenu}>
        <Link 
          to="/admin" 
          className={`${styles.navLink} ${activePage === 'dashboard' ? styles.navLinkActive : ''}`}
        >
          <Activity size={20} />
          <span>لوحة الإحصائيات</span>
        </Link>
        <Link 
          to="/admin/universities" 
          className={`${styles.navLink} ${activePage === 'universities' ? styles.navLinkActive : ''}`}
        >
          <School size={20} />
          <span>الجامعات والهياكل</span>
        </Link>
        <Link 
          to="/admin/professors" 
          className={`${styles.navLink} ${activePage === 'professors' ? styles.navLinkActive : ''}`}
        >
          <Users size={20} />
          <span>الأساتذة والاشتراكات</span>
        </Link>
        <Link 
          to="/admin/students" 
          className={`${styles.navLink} ${activePage === 'students' ? styles.navLinkActive : ''}`}
        >
          <GraduationCap size={20} />
          <span>إدارة الطلاب والـ QR</span>
        </Link>
        <Link 
          to="/admin/reports" 
          className={`${styles.navLink} ${activePage === 'reports' ? styles.navLinkActive : ''}`}
        >
          <FileSpreadsheet size={20} />
          <span>التقارير العامة</span>
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

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    universities: 0,
    professors: 0,
    students: 0,
    activeSubscriptions: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        
        // 1. عدد الجامعات
        const { count: univCount } = await supabase
          .from('universities')
          .select('*', { count: 'exact', head: true });

        // 2. عدد الأساتذة
        const { count: profCount } = await supabase
          .from('professors')
          .select('*', { count: 'exact', head: true });

        // 3. عدد الطلاب
        const { count: studCount } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true });

        // 4. الاشتراكات النشطة
        const today = new Date().toISOString().slice(0, 10);
        const { count: activeSubsCount } = await supabase
          .from('professors')
          .select('*', { count: 'exact', head: true })
          .gte('subscription_expires_at', today);

        setStats({
          universities: univCount || 0,
          professors: profCount || 0,
          students: studCount || 0,
          activeSubscriptions: activeSubsCount || 0
        });
      } catch (err) {
        console.error('Error fetching admin statistics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className={styles.adminLayout}>
      <AdminSidebar activePage="dashboard" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>لوحة التحكم الرئيسية</h1>
        </div>

        {loading ? (
          <div className={styles.statsGrid}>
            <Skeleton height="100px" />
            <Skeleton height="100px" />
            <Skeleton height="100px" />
            <Skeleton height="100px" />
          </div>
        ) : (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statInfo}>
                <h3>إجمالي الجامعات</h3>
                <div className={styles.statNumber}>{stats.universities}</div>
              </div>
              <div className={styles.statIcon}>
                <School size={28} />
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statInfo}>
                <h3>الأساتذة المسجلين</h3>
                <div className={styles.statNumber}>{stats.professors}</div>
              </div>
              <div className={styles.statIcon}>
                <Users size={28} />
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statInfo}>
                <h3>الاشتراكات النشطة</h3>
                <div className={styles.statNumber}>{stats.activeSubscriptions}</div>
              </div>
              <div className={styles.statIcon} style={{ color: 'var(--success)', backgroundColor: 'var(--success-light)' }}>
                <Calendar size={28} />
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

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>مرحباً بك في لوحة تحكم رقيم</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
            من هنا يمكنك التحكم بالكامل في النظام الجامعي:
            <br />
            1. إضافة وتعديل الجامعات، الكليات والأقسام، وربطها بالمراحل والمواد الدراسية.
            <br />
            2. إدارة حسابات الأساتذة وتفعيل اشتراكاتهم وتعيين المواد الخاصة بهم.
            <br />
            3. استيراد كشوفات الطلاب لتوليد وحفظ بطاقات الحضور (QR Codes) الخاصة بهم لمشاركتها عبر بوت التيليجرام.
            <br />
            4. الاطلاع على تقارير الحضور والغياب الكلية وتصديرها للجامعات.
          </p>
        </div>
      </div>
    </div>
  );
}
