import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Play, 
  Calendar, 
  LogOut, 
  BookOpen, 
  FileText,
  Clock,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSession } from '../../hooks/useSession';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import logo from '../../assets/logo.png';
import styles from '../../styles/professor.module.css';
import compStyles from '../../styles/components.module.css';

export function ProfessorSidebar({ activePage }) {
  const { professor, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.logoArea}>
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
        <span style={{ fontWeight: '900', color: 'var(--text-primary)', fontSize: '1.2rem' }}>رَقِيم — أستاذ</span>
      </div>

      <div style={{ padding: '0 0.5rem 1.25rem 0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>مرحباً بك:</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '0.25rem' }}>{professor?.name}</div>
      </div>

      <nav className={styles.sidebarMenu}>
        <Link 
          to="/professor" 
          className={`${styles.navLink} ${activePage === 'dashboard' ? styles.navLinkActive : ''}`}
        >
          <Play size={20} />
          <span>لوحة التحكم</span>
        </Link>
        <Link 
          to="/professor/reports" 
          className={`${styles.navLink} ${activePage === 'reports' ? styles.navLinkActive : ''}`}
        >
          <Calendar size={20} />
          <span>سجلات الحضور</span>
        </Link>

        <div className={styles.logoutBtn}>
          <button 
            onClick={handleLogout}
            className={styles.navLink}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <LogOut size={20} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default function ProfessorDashboard() {
  const { professor } = useAuth();
  const { startSession } = useSession();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // States
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selection
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [studyType, setStudyType] = useState('صباحي');
  const [startLoading, setStartLoading] = useState(false);

  useEffect(() => {
    if (professor) {
      fetchDashboardData();
    }
  }, [professor]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. جلب المواد الأكاديمية المسندة للأستاذ
      const { data: coursesData, error: cErr } = await supabase
        .from('professor_courses')
        .select(`
          course_id,
          courses (
            id, 
            name, 
            departments(name), 
            stages(name)
          )
        `)
        .eq('professor_id', professor.id);

      if (cErr) throw cErr;
      
      const formattedCourses = (coursesData || [])
        .filter(item => item.courses !== null)
        .map(item => item.courses);
      
      setAssignedCourses(formattedCourses);

      // 2. جلب آخر 5 جلسات حضور بدأها هذا الأستاذ
      const { data: sessionsData, error: sErr } = await supabase
        .from('sessions')
        .select('*, courses(name, departments(name), stages(name))')
        .eq('professor_id', professor.id)
        .order('started_at', { ascending: false })
        .limit(5);

      if (sErr) throw sErr;
      
      // جلب عدد الطلاب الحاضرين لكل جلسة من جلسات الأستاذ
      const enrichedSessions = await Promise.all((sessionsData || []).map(async (sess) => {
        const { count } = await supabase
          .from('attendance')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', sess.id);
        
        return {
          ...sess,
          present_count: count || 0
        };
      }));

      setRecentSessions(enrichedSessions);
    } catch (err) {
      showToast('خطأ', 'فشل تحميل بيانات لوحة التحكم للأستاذ', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSessionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCourseId) return;

    setStartLoading(true);
    try {
      const session = await startSession(selectedCourseId, studyType);
      showToast('جلسة جديدة ✅', 'تم فتح المحاضرة بنجاح، جاري فتح شاشة المسح اللحظي...', 'success');
      navigate(`/professor/scan/${session.id}`);
    } catch (err) {
      showToast('خطأ', err.message || 'فشل فتح الجلسة', 'danger');
    } finally {
      setStartLoading(false);
    }
  };

  return (
    <div className={styles.profLayout}>
      <ProfessorSidebar activePage="dashboard" />
      
      <div className={styles.profContent}>
        
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Skeleton height="180px" />
            <Skeleton height="300px" />
          </div>
        ) : (
          <div className={styles.dashboardGrid}>
            
            {/* القسم الأيمن: بدء محاضرة حضور جديدة */}
            <div>
              <div className={compStyles.card} style={{ margin: 0, height: '100%' }}>
                <h2 className={compStyles.cardTitle}>
                  <Play size={20} style={{ color: 'var(--accent)' }} />
                  <span>بدء محاضرة حضور جديدة</span>
                </h2>
                
                <form onSubmit={handleStartSessionSubmit} style={{ marginTop: '1.5rem' }}>
                  <div className={compStyles.inputGroup}>
                    <label className={compStyles.label}>اختر المادة والمرحلة</label>
                    <select
                      required
                      className={compStyles.select}
                      value={selectedCourseId}
                      onChange={e => setSelectedCourseId(e.target.value)}
                    >
                      <option value="">اختر من المواد المسندة إليك</option>
                      {assignedCourses.map(course => (
                        <option key={course.id} value={course.id}>
                          {course.name} ({course.departments?.name} — {course.stages?.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={compStyles.inputGroup}>
                    <label className={compStyles.label}>نوع الدراسة (القسم)</label>
                    <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input 
                          type="radio" 
                          name="studyType" 
                          value="صباحي" 
                          checked={studyType === 'صباحي'} 
                          onChange={() => setStudyType('صباحي')}
                          style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
                        />
                        <span>الدراسة الصباحية ☀️</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input 
                          type="radio" 
                          name="studyType" 
                          value="مسائي" 
                          checked={studyType === 'مسائي'} 
                          onChange={() => setStudyType('مسائي')}
                          style={{ accentColor: '#a855f7', width: '16px', height: '16px' }}
                        />
                        <span>الدراسة المسائية 🌙</span>
                      </label>
                    </div>
                  </div>

                  {selectedCourseId && (
                    <div 
                      style={{ 
                        backgroundColor: 'var(--accent-light)', 
                        padding: '1rem', 
                        borderRadius: 'var(--radius-md)', 
                        fontSize: '0.85rem', 
                        lineHeight: '1.7', 
                        marginBottom: '1.5rem',
                        color: 'var(--text-primary)',
                        border: '1px solid rgba(59, 130, 246, 0.2)'
                      }}
                    >
                      💡 **تنبيه:** عند النقر على البدء، سيتم فتح الكاميرا فوراً لاستقبال مسح الطلاب.
                      تأكد من توفر إضاءة كافية للمسح بشكل صحيح وسريع.
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={startLoading || !selectedCourseId}
                    style={{ width: '100%', padding: '0.75rem' }}
                    icon={Play}
                  >
                    {startLoading ? 'جاري فتح الجلسة...' : 'بدء تسجيل الحضور الآن'}
                  </Button>
                </form>
              </div>
            </div>

            {/* القسم الأيسر: آخر جلسات مسجلة */}
            <div>
              <div className={compStyles.card} style={{ margin: 0, height: '100%' }}>
                <h2 className={compStyles.cardTitle}>
                  <Clock size={20} />
                  <span>المحاضرات الأخيرة</span>
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
                  {recentSessions.map(sess => (
                    <div 
                      key={sess.id} 
                      className={styles.sessionCard}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{sess.courses?.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                          <span>{sess.courses?.stages?.name}</span>
                          <span>•</span>
                          <span style={{ color: sess.study_type === 'مسائي' ? '#a855f7' : '#3b82f6', fontWeight: 'bold' }}>
                            {sess.study_type || 'صباحي'}
                          </span>
                          <span>•</span>
                          <span>{new Date(sess.started_at).toLocaleDateString('ar-EG')}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ textAlign: 'left' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                            {sess.present_count}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>
                            حاضرين
                          </span>
                        </div>
                        {sess.is_open ? (
                          <Link to={`/professor/scan/${sess.id}`} className={`${compStyles.btn} ${compStyles.btnPrimary}`} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                            متابعة المسح
                          </Link>
                        ) : (
                          <Link to={`/professor/reports`} className={`${compStyles.btn} ${compStyles.btnSecondary}`} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                            التقرير
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                  {recentSessions.length === 0 && (
                    <div className={compStyles.emptyState} style={{ border: 'none', padding: '3rem 1rem' }}>
                      <UserCheck size={32} className={styles.emptyStateIcon} />
                      <h4 className={compStyles.emptyStateTitle}>لم تقم ببدء أي محاضرات بعد</h4>
                      <p className={compStyles.emptyStateText}>اختر مادة من القائمة الجانبية وابدأ الحضور للطلاب الآن.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
