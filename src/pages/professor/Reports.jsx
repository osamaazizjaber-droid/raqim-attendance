import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ReportTable } from '../../components/reports/ReportTable';
import { ExportButtons } from '../../components/reports/ExportButtons';
import { ProfessorSidebar } from './Dashboard';
import { Eye, BookOpen, Calendar, Search } from 'lucide-react';
import styles from '../../styles/professor.module.css';
import compStyles from '../../styles/components.module.css';

export default function ProfessorReports() {
  const { professor } = useAuth();
  const { showToast } = useToast();

  // States
  const [sessions, setSessions] = useState([]);
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Detailed modal
  const [selectedSession, setSelectedSession] = useState(null);
  const [attendanceDetails, setAttendanceDetails] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    if (professor) {
      fetchInitialData();
    }
  }, [professor]);

  useEffect(() => {
    if (professor) {
      fetchSessions();
    }
  }, [professor, selectedCourseId, selectedStageId, startDate, endDate]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      // 1. جلب المواد المسندة للأستاذ للفلتراة
      const { data: coursesData } = await supabase
        .from('professor_courses')
        .select('course_id, courses(id, name)')
        .eq('professor_id', professor.id);
      
      const formattedCourses = (coursesData || [])
        .filter(item => item.courses !== null)
        .map(item => item.courses);
      setAssignedCourses(formattedCourses);

      // 2. جلب المراحل مرتبة تاريخياً
      const { data: stagesData } = await supabase
        .from('stages')
        .select('*')
        .order('created_at', { ascending: true });
      setStages(stagesData || []);

      await fetchSessions();
    } catch (err) {
      showToast('خطأ', 'فشل تحميل بيانات التصفية المبدئية', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('sessions')
        .select(`
          *,
          courses (
            id,
            name,
            department_id,
            stage_id,
            departments(name),
            stages(name)
          ),
          professors (
            id,
            name,
            university_id,
            universities(name)
          )
        `)
        .eq('professor_id', professor.id)
        .order('started_at', { ascending: false });

      if (selectedCourseId) {
        query = query.eq('course_id', selectedCourseId);
      }
      if (selectedStageId) {
        query = query.eq('courses.stage_id', selectedStageId);
      }
      if (startDate) {
        query = query.gte('started_at', `${startDate}T00:00:00Z`);
      }
      if (endDate) {
        query = query.lte('started_at', `${endDate}T23:59:59Z`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // تصفية السجلات المحملة لتجنب السجلات الفارغة التي تنتج عن فلاتر الفروع في Supabase
      const filteredData = (data || []).filter(session => {
        if (selectedStageId && (!session.courses || session.courses.stage_id !== selectedStageId)) return false;
        return true;
      });

      // جلب إحصائيات الحضور والغياب لكل جلسة
      const enriched = await Promise.all(filteredData.map(async (sess) => {
        // الحاضرين
        const { count: presentCount } = await supabase
          .from('attendance')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', sess.id);

        // المسجلين التابعين لنفس نوع الدراسة لتحديد النسبة بدقة
        const { count: enrolledCount } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('department_id', sess.courses.department_id)
          .eq('stage_id', sess.courses.stage_id)
          .eq('study_type', sess.study_type || 'صباحي');

        return {
          ...sess,
          present_count: presentCount || 0,
          enrolled_count: enrolledCount || 0
        };
      }));

      setSessions(enriched);
    } catch (err) {
      showToast('خطأ', 'فشل تحميل تقارير الحضور', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSessionDetails = async (session) => {
    setSelectedSession(session);
    setModalLoading(true);
    try {
      // 1. جلب كافة طلاب القسم والمرحلة والدراسة التابعين للمادة
      const { data: allStudents, error: studErr } = await supabase
        .from('students')
        .select('id, full_name, student_number, study_type')
        .eq('department_id', session.courses.department_id)
        .eq('stage_id', session.courses.stage_id)
        .eq('study_type', session.study_type || 'صباحي')
        .order('full_name', { ascending: true });

      if (studErr) throw studErr;

      // 2. جلب الحاضرين في هذه الجلسة
      const { data: presentList, error: presErr } = await supabase
        .from('attendance')
        .select('student_id, scanned_at')
        .eq('session_id', session.id);

      if (presErr) throw presErr;

      const presentMap = new Map(presentList?.map(p => [p.student_id, p.scanned_at]) || []);

      // 3. دمج الحضور والغياب
      const combined = (allStudents || []).map(student => {
        const scannedAt = presentMap.get(student.id);
        return {
          id: student.id,
          full_name: student.full_name,
          student_number: student.student_number,
          study_type: student.study_type || 'صباحي',
          is_present: !!scannedAt,
          scanned_at: scannedAt ? new Date(scannedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-'
        };
      });

      setAttendanceDetails(combined);
    } catch (err) {
      showToast('خطأ', 'فشل تحميل تفاصيل حضور الجلسة', 'danger');
    } finally {
      setModalLoading(false);
    }
  };

  // إعداد الأعمدة للتصدير
  const sessionHeaders = [
    { key: 'date', label: 'التاريخ' },
    { key: 'univ', label: 'الجامعة' },
    { key: 'prof', label: 'الأستاذ' },
    { key: 'course', label: 'المادة' },
    { key: 'dept', label: 'القسم' },
    { key: 'stage', label: 'المرحلة' },
    { key: 'study_type', label: 'الدراسة' },
    { key: 'ratio', label: 'حضور / كلي' }
  ];

  const exportSessionsData = sessions.map(s => ({
    date: new Date(s.started_at).toLocaleDateString('ar-EG'),
    univ: s.professors?.universities?.name || '-',
    prof: s.professors?.name || '-',
    course: s.courses?.name || '-',
    dept: s.courses?.departments?.name || '-',
    stage: s.courses?.stages?.name || '-',
    study_type: s.study_type || 'صباحي',
    ratio: `${s.present_count} / ${s.enrolled_count}`
  }));

  const detailHeaders = [
    { key: 'full_name', label: 'اسم الطالب' },
    { key: 'student_number', label: 'الرقم الجامعي' },
    { key: 'study_type', label: 'الدراسة' },
    { key: 'is_present', label: 'حالة الحضور', render: (val) => val ? 'حاضر ✅' : 'غائب ❌' },
    { key: 'scanned_at', label: 'توقيت المسح' }
  ];

  return (
    <div className={styles.profLayout}>
      <ProfessorSidebar activePage="reports" />
      
      <div className={styles.profContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>التقارير وسجلات الحضور الشاملة</h1>
        </div>

        {/* فلاتر الفحص والتنقيب */}
        <div className={styles.toolbar} style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div className={compStyles.inputGroup} style={{ width: '220px', marginBottom: 0 }}>
            <label className={compStyles.label}>المادة الدراسية</label>
            <select
              className={compStyles.select}
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
            >
              <option value="">كل المواد الدراسية</option>
              {assignedCourses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className={compStyles.inputGroup} style={{ width: '180px', marginBottom: 0 }}>
            <label className={compStyles.label}>المرحلة</label>
            <select
              className={compStyles.select}
              value={selectedStageId}
              onChange={e => setSelectedStageId(e.target.value)}
            >
              <option value="">كل المراحل</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className={compStyles.inputGroup} style={{ width: '160px', marginBottom: 0 }}>
            <label className={compStyles.label}>من تاريخ</label>
            <input 
              type="date" 
              className={compStyles.input}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          <div className={compStyles.inputGroup} style={{ width: '160px', marginBottom: 0 }}>
            <label className={compStyles.label}>إلى تاريخ</label>
            <input 
              type="date" 
              className={compStyles.input}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* التصدير وجدول البيانات */}
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 'bold' }}>سجل المحاضرات المحملة ({sessions.length})</h3>
            <ExportButtons 
              title="كشف محاضرات الحضور للأستاذ - رقيم"
              headers={sessionHeaders}
              data={exportSessionsData}
              fileName="محاضرات_الأستاذ"
              disabled={sessions.length === 0}
            />
          </div>

          <ReportTable 
            headers={[
              { key: 'started_at', label: 'تاريخ المحاضرة', render: (val) => new Date(val).toLocaleDateString('ar-EG') },
              { key: 'course', label: 'المادة', render: (_, row) => row.courses?.name || '-' },
              { key: 'dept', label: 'القسم', render: (_, row) => row.courses?.departments?.name || '-' },
              { key: 'stage', label: 'المرحلة', render: (_, row) => row.courses?.stages?.name || '-' },
              { key: 'study_type', label: 'الدراسة', render: (val) => val || 'صباحي' },
              { key: 'ratio', label: 'حضور / كلي', render: (_, row) => `${row.present_count} / ${row.enrolled_count}` },
              { 
                key: 'actions', 
                label: 'التفاصيل الكشف', 
                render: (_, row) => (
                  <Button 
                    variant="outline" 
                    onClick={() => handleViewSessionDetails(row)}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                    icon={Eye}
                  >
                    تفاصيل الكشف
                  </Button>
                )
              }
            ]}
            data={sessions}
            loading={loading}
            emptyMessage="لم يتم العثور على محاضرات مسجلة لك تطابق هذه الفلاتر."
          />
        </div>
      </div>

      {/* مودال كشف تفاصيل المحاضرة والطلاب */}
      <Modal
        isOpen={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        title={selectedSession ? `تفاصيل حضور مادة: ${selectedSession.courses?.name}` : ''}
        size="lg"
      >
        {selectedSession && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              <div><strong>الأستاذ:</strong> {selectedSession.professors?.name}</div>
              <div><strong>التاريخ:</strong> {new Date(selectedSession.started_at).toLocaleString('ar-EG')}</div>
              <div><strong>القسم:</strong> {selectedSession.courses?.departments?.name} | {selectedSession.courses?.stages?.name}</div>
              <div><strong>حالة الحضور:</strong> {selectedSession.present_count} حاضرين من أصل {selectedSession.enrolled_count} طالب</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <h4 style={{ fontWeight: 'bold' }}>كشف أسماء الطلاب وحالة حضورهم</h4>
              <ExportButtons 
                title={`كشف حضور مادة: ${selectedSession.courses?.name} - قسم: ${selectedSession.courses?.departments?.name} (${new Date(selectedSession.started_at).toLocaleDateString('ar-EG')})`}
                headers={detailHeaders}
                data={attendanceDetails}
                fileName={`حضور_${selectedSession.courses?.name}`}
                disabled={attendanceDetails.length === 0}
              />
            </div>

            <div style={{ marginTop: '1rem', maxHeight: '350px', overflowY: 'auto' }}>
              <ReportTable 
                headers={detailHeaders}
                data={attendanceDetails}
                loading={modalLoading}
                emptyMessage="لا يوجد طلاب مسجلين في هذا القسم والمرحلة بعد."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
              <Button variant="secondary" onClick={() => setSelectedSession(null)}>إغلاق</Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
