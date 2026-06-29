import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, StopCircle, RefreshCw, UserCheck, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../hooks/useSession';
import { useRealtime } from '../../hooks/useRealtime';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { QRScanner } from '../../components/scanner/QRScanner';
import { Skeleton } from '../../components/ui/Skeleton';
import styles from '../../styles/professor.module.css';
import compStyles from '../../styles/components.module.css';

export default function ProfessorScan() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { recordAttendance, endSession } = useSession();
  const { showToast } = useToast();

  // States
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [repeatStudentsSet, setRepeatStudentsSet] = useState(new Set());
  
  // Realtime attendance hook
  const { presentStudents } = useRealtime(sessionId);

  // Success overlay state
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [scannedStudent, setScannedStudent] = useState(null);

  useEffect(() => {
    fetchSessionDetails();
  }, [sessionId]);

  const fetchSessionDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sessions')
        .select('*, courses(name, stages(name))')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      setSession(data);

      if (!data.is_open) {
        showToast('جلسة مغلقة ⚠️', 'هذه الجلسة مغلقة بالفعل ولا يمكن تسجيل الحضور بها.', 'warning');
      }

      // جلب درجات أو مواد الإعادة للمساق لمعرفة الطلاب المعيدين في الجلسة الحالية
      const { data: scData, error: scErr } = await supabase
        .from('student_courses')
        .select('student_id')
        .eq('course_id', data.course_id)
        .eq('type', 'repeat');
      
      if (!scErr && scData) {
        setRepeatStudentsSet(new Set(scData.map(d => d.student_id)));
      }
    } catch (err) {
      showToast('خطأ', 'فشل تحميل تفاصيل جلسة الحضور', 'danger');
      navigate('/professor');
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = async (qrToken) => {
    // التحقق من صلاحية الجلسة محلياً قبل الاستدعاء
    if (session && !session.is_open) {
      showToast('تنبيه', 'انتهت جلسة الحضور، لا يمكنك مسح بطاقات جديدة.', 'warning');
      return;
    }

    try {
      const result = await recordAttendance(sessionId, qrToken);
      
      if (result.isDuplicate) {
        showToast('مسجل مسبقاً ✋', result.message, 'warning');
      } else if (result.success) {
        // إظهار شاشة النجاح الفورية مع اسم الطالب
        setScannedStudent(result.student);
        setShowSuccessOverlay(true);
        
        // إخفاء الشاشة بعد 1.5 ثانية
        setTimeout(() => {
          setShowSuccessOverlay(false);
        }, 1500);
      }
    } catch (err) {
      showToast('خطأ في البطاقة ❌', err.message || 'فشل معالجة الكود الممسوح', 'danger');
    }
  };

  const handleEndSession = async () => {
    if (!window.confirm('هل أنت متأكد من إنهاء جلسة تسجيل الحضور وإغلاق الكاميرا؟ لن يتمكن أي طالب من مسح بطاقته بعد ذلك.')) return;
    
    try {
      await endSession(sessionId);
      showToast('تم إغلاق الجلسة', 'تم إنهاء تسجيل الحضور وحفظ الكشف بنجاح.', 'success');
      navigate('/professor/reports');
    } catch (err) {
      showToast('خطأ', 'فشل إغلاق الجلسة', 'danger');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <Skeleton width="300px" height="2rem" style={{ marginBottom: '1.5rem' }} />
        <Skeleton width="90%" height="40vh" />
      </div>
    );
  }

  return (
    <div className={styles.scanContainer}>
      
      {/* 1. النصف العلوي: مساحة الكاميرا والعداد عالي التباين */}
      <div className={styles.scanHeader}>
        
        {/* أدوات التحكم العائمة */}
        <div className={styles.scannerControls}>
          <div className={styles.sessionTitleBadge}>
            {session?.courses?.name} — {session?.courses?.stages?.name}
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div className={styles.counterBadge}>
              حاضر: {presentStudents.length}
            </div>
            
            {session?.is_open && (
              <Button 
                variant="danger" 
                onClick={handleEndSession}
                style={{ padding: '0.5rem 1rem' }}
                icon={StopCircle}
              >
                إنهاء الحضور
              </Button>
            )}
          </div>
        </div>

        {/* مشغل الكاميرا */}
        <div className={styles.cameraWrapper}>
          {session?.is_open ? (
            <QRScanner 
              onScanSuccess={handleScanSuccess} 
              onScanError={(err) => {}} 
            />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              backgroundColor: 'rgba(10, 14, 26, 0.95)',
              gap: '1rem',
              color: 'var(--text-secondary)'
            }}>
              <AlertTriangle size={48} style={{ color: 'var(--danger)' }} />
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>انتهت جلسة الحضور</div>
              <p style={{ fontSize: '0.9rem' }}>تم إغلاق المحاضرة وحفظ كشف الحضور بنجاح.</p>
              <Button onClick={() => navigate('/professor')}>
                العودة للرئيسية
              </Button>
            </div>
          )}
        </div>

        {/* الغطاء التفاعلي للنجاح (Scan Overlay) */}
        {showSuccessOverlay && scannedStudent && (
          <div className={styles.scanOverlay}>
            <div style={{ fontSize: '5rem', marginBottom: '1rem', animation: 'zoomIn 0.3s' }}>✅</div>
            <div className={styles.scanOverlayName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span>{scannedStudent.full_name}</span>
              {repeatStudentsSet.has(scannedStudent.id) && (
                <span style={{ fontSize: '0.8rem', backgroundColor: 'var(--danger)', color: '#ffffff', padding: '0.1rem 0.5rem', borderRadius: '12px' }}>إعادة</span>
              )}
            </div>
            <div className={styles.scanOverlayNum}>{scannedStudent.student_number}</div>
            <div style={{ fontSize: '1rem', marginTop: '1rem', opacity: 0.9, fontWeight: 'bold' }}>تم تسجيل الحضور بنجاح</div>
          </div>
        )}
      </div>

      {/* 2. النصف السفلي: قائمة الطلاب الحاضرين لحظياً */}
      <div className={styles.scanListArea}>
        <div className={styles.scanListTitle}>
          <span>الطلاب المسجلين في هذه الجلسة</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>الأحدث يظهر في الأعلى تلقائياً</span>
        </div>

        <div className={styles.scannedStudentsList}>
          {presentStudents.map((student, idx) => (
            <div key={student.id} className={styles.studentItem}>
              <div className={styles.studentMeta}>
                {/* رمز الصورة الافتراضية للطالب */}
                <div className={styles.studentPhotoPlaceholder}>
                  {student.full_name.slice(0, 1)}
                </div>
                <div>
                  <div className={styles.studentName} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{student.full_name}</span>
                    {repeatStudentsSet.has(student.id) && (
                      <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', padding: '1px 6px', borderRadius: '10px', fontWeight: 'bold' }}>إعادة</span>
                    )}
                  </div>
                  <div className={styles.studentNum}>{student.student_number}</div>
                </div>
              </div>
              <div className={styles.scanTime}>
                {student.scanned_at ? new Date(student.scanned_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
              </div>
            </div>
          ))}

          {presentStudents.length === 0 && (
            <div className={compStyles.emptyState} style={{ border: 'none', backgroundColor: 'transparent', padding: '2rem 1rem' }}>
              <UserCheck size={32} className={styles.emptyStateIcon} />
              <h4 className={compStyles.emptyStateTitle}>بانتظار مسح الطلاب</h4>
              <p className={compStyles.emptyStateText}>قم بتوجيه الطلاب لتوجيه بطاقات الـ QR الخاصة بهم نحو كاميرا الأستاذ لبدء الحضور.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
