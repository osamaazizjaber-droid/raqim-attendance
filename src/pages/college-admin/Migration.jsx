import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, HelpCircle, AlertCircle, CheckCircle, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Table, Tr, Th, Td } from '../../components/ui/Table';
import { Skeleton } from '../../components/ui/Skeleton';
import { CollegeAdminSidebar } from './Dashboard';
import styles from '../../styles/admin.module.css';
import compStyles from '../../styles/components.module.css';
import { useAuth } from '../../hooks/useAuth';

export default function CollegeAdminMigration() {
  const { showToast } = useToast();
  const { adminDetails, user } = useAuth();

  // Lists
  const [departments, setDepartments] = useState([]);
  const [stages, setStages] = useState([]);
  
  // Selection
  const [deptId, setDeptId] = useState('');
  const [fromStageId, setFromStageId] = useState('');
  const [toStageId, setToStageId] = useState('');
  
  // States
  const [students, setStudents] = useState([]);
  const [isPreviewed, setIsPreviewed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (adminDetails?.college_id) {
      fetchInitialData();
    }
  }, [adminDetails]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // Fetch Departments
      const { data: depts } = await supabase
        .from('departments')
        .select('*')
        .eq('college_id', adminDetails.college_id)
        .order('name', { ascending: true });
      setDepartments(depts || []);

      // Fetch Stages
      const { data: stgs } = await supabase
        .from('stages')
        .select('*')
        .order('created_at', { ascending: true });
      setStages(stgs || []);
    } catch (err) {
      showToast('خطأ', 'فشل تحميل بيانات التهيئة', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!deptId || !fromStageId || !toStageId) {
      showToast('تنبيه', 'يرجى ملء جميع الحقول للبدء بالمعاينة.', 'warning');
      return;
    }

    if (fromStageId === toStageId) {
      showToast('خطأ في التحقق ⚠️', 'لا يمكن الترحيل لنفس المرحلة الدراسية!', 'danger');
      return;
    }

    try {
      setLoading(true);
      setIsPreviewed(false);

      // جلب الطلاب التابعين للقسم والمرحلة
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, student_number, study_type')
        .eq('department_id', deptId)
        .eq('stage_id', fromStageId)
        .eq('college_id', adminDetails.college_id)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
      setIsPreviewed(true);

      if (!data || data.length === 0) {
        showToast('كشف فارغ ℹ️', 'لا يوجد أي طلاب مسجلين في هذا القسم بهذه المرحلة حالياً.', 'info');
      }
    } catch (err) {
      showToast('خطأ', 'حدث خطأ أثناء معاينة الطلاب', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    if (students.length === 0) return;
    
    const fromStageName = stages.find(s => s.id === fromStageId)?.name || 'الحالية';
    const toStageName = stages.find(s => s.id === toStageId)?.name || 'الجديدة';
    
    if (!window.confirm(`هل أنت متأكد من ترحيل (${students.length}) طالب من "${fromStageName}" إلى "${toStageName}"؟ سيتم حفظ كروت الـ QR وسجلات الحضور السابقة كما هي.`)) {
      return;
    }

    setActionLoading(true);
    try {
      const studentIds = students.map(s => s.id);

      // 1. إدراج سجلات الترحيل في جدول التاريخ واللوجات لتوثيق العملية
      const migrationLogs = students.map(s => ({
        student_id: s.id,
        from_stage_id: fromStageId,
        to_stage_id: toStageId,
        migrated_by: user.id
      }));

      const { error: logError } = await supabase
        .from('student_migrations')
        .insert(migrationLogs);

      if (logError) throw logError;

      // 2. ترحيل الطلاب جماعياً بتحديث معرف المرحلة stage_id
      const { error: updateError } = await supabase
        .from('students')
        .update({ stage_id: toStageId })
        .in('id', studentIds)
        .eq('college_id', adminDetails.college_id);

      if (updateError) throw updateError;

      showToast('تم الترحيل بنجاح 🎉', `تم ترحيل ${students.length} طالب إلى ${toStageName} بنجاح تام وسرعة عالية.`, 'success');
      
      // إعادة تصفير المدخلات
      setIsPreviewed(false);
      setStudents([]);
      setDeptId('');
      setFromStageId('');
      setToStageId('');

    } catch (err) {
      showToast('خطأ في الترحيل', err.message || 'فشل ترحيل الطلاب جماعياً', 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className={styles.adminLayout}>
      <CollegeAdminSidebar activePage="migration" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>ترحيل الطلاب بين المراحل</h1>
        </div>

        {/* نموذج الترحيل والفلترة */}
        <div className={styles.glass} style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowRightLeft size={22} style={{ color: 'var(--accent)' }} />
            <span>معايير الترحيل السنوي للطلاب</span>
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>القسم العلمي</label>
              <select className={compStyles.input} value={deptId} onChange={e => { setDeptId(e.target.value); setIsPreviewed(false); }} disabled={loading || actionLoading}>
                <option value="">اختر القسم</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>المرحلة الحالية (From Stage)</label>
              <select className={compStyles.input} value={fromStageId} onChange={e => { setFromStageId(e.target.value); setIsPreviewed(false); }} disabled={loading || actionLoading}>
                <option value="">اختر المرحلة</option>
                {stages.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>المرحلة المستهدفة (To Stage)</label>
              <select className={compStyles.input} value={toStageId} onChange={e => { setToStageId(e.target.value); setIsPreviewed(false); }} disabled={loading || actionLoading}>
                <option value="">اختر المرحلة</option>
                {stages.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button onClick={handlePreview} disabled={loading || actionLoading || !deptId || !fromStageId || !toStageId}>
              <Eye size={18} />
              <span>معاينة كشف الطلاب</span>
            </Button>
          </div>
        </div>

        {/* شاشة المعاينة ونتائج الفلترة قبل التأكيد */}
        {loading ? (
          <Skeleton height="300px" />
        ) : isPreviewed && (
          <div className={styles.glass} style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', animation: 'fadeIn var(--transition-normal)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>كشف معاينة الطلاب الجاهزين للترحيل</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>يرجى التحقق من الأسماء والأرقام الجامعية بعناية قبل اعتماد الترحيل.</span>
              </div>
              <Button variant="primary" disabled={students.length === 0 || actionLoading} onClick={handleMigrate}>
                <CheckCircle size={18} />
                <span>{actionLoading ? 'جاري الترحيل...' : 'تأكيد الترحيل النهائي'}</span>
              </Button>
            </div>

            {students.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                لا يوجد طلاب لترحيلهم ضمن الخيارات المحددة.
              </div>
            ) : (
              <div className={compStyles.tableContainer}>
                <Table>
                  <thead>
                    <Tr>
                      <Th>ت</Th>
                      <Th>اسم الطالب</Th>
                      <Th>الرقم الجامعي</Th>
                      <Th>نوع الدراسة</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => (
                      <Tr key={student.id}>
                        <Td>{index + 1}</Td>
                        <Td style={{ fontWeight: '600' }}>{student.full_name}</Td>
                        <Td style={{ fontFamily: 'monospace' }}>{student.student_number}</Td>
                        <Td>{student.study_type}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* تنبيهات إضافية */}
        {!isPreviewed && (
          <div className={styles.glass} style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <AlertCircle size={24} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>تعليمات هامة حول الترحيل السنوي:</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                • بطاقة الحضور ورموز الـ QR للطلاب **لا تتغير** عند الترحيل، حيث تنتقل نفس الرموز مع الطلاب تلقائياً.
                <br />
                • جميع سجلات الحضور والتقارير للمرحلة الدراسية السابقة **محفوظة ومحميّة** من التغيير ومرتبطة بـ تاريخ تسجيلها الفعلي.
                <br />
                • العملية عكسية؛ حيث يمكنك إعادة الطلاب مجدداً إلى المرحلة السابقة عند ترحيلهم بالخطأ باختيار نفس الطلاب وإعادتهم.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
