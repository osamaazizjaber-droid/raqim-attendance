import React, { useState, useEffect } from 'react';
import { Search, Calendar, FileSpreadsheet, Eye, School, GraduationCap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ReportTable } from '../../components/reports/ReportTable';
import { ExportButtons } from '../../components/reports/ExportButtons';
import { AdminSidebar } from './Dashboard';
import styles from '../../styles/admin.module.css';
import compStyles from '../../styles/components.module.css';

export default function AdminReports() {
  const { showToast } = useToast();

  // States
  const [sessions, setSessions] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [univId, setUnivId] = useState('');
  const [deptId, setDeptId] = useState('');
  const [stageId, setStageId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Detail Modal States
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionAttendance, setSessionAttendance] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (univId) {
      fetchDepartments(univId);
    } else {
      setDepartments([]);
      setDeptId('');
    }
  }, [univId]);

  useEffect(() => {
    fetchSessions();
  }, [univId, deptId, stageId, startDate, endDate]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      const { data: univs } = await supabase
        .from('universities')
        .select('*')
        .order('name', { ascending: true });
      setUniversities(univs || []);

      const { data: stgs } = await supabase
        .from('stages')
        .select('*')
        .order('created_at', { ascending: true });
      setStages(stgs || []);

      await fetchSessions();
    } catch (err) {
      showToast('خطأ', 'فشل تحميل البيانات المبدئية للفلترة', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async (uId) => {
    try {
      const { data } = await supabase
        .from('departments')
        .select('*')
        .eq('university_id', uId)
        .order('name', { ascending: true });
      setDepartments(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSessions = async () => {
    try {
      setLoading(true);
      
      // نبني استعلام لجلب الجلسات مع الأستاذ والمادة والجامعة والقسم والمرحلة
      let query = supabase
        .from('sessions')
        .select(`
          id,
          started_at,
          ended_at,
          is_open,
          professors (id, name, university_id, universities(name)),
          courses (
            id, 
            name, 
            department_id, 
            stage_id,
            departments(name), 
            stages(name)
          )
        `)
        .order('started_at', { ascending: false });

      // تطبيق الفلاتر
      if (univId) {
        // نتحقق من الجامعة من خلال ملف الأستاذ
        query = query.eq('professors.university_id', univId);
      }
      if (deptId) {
        query = query.eq('courses.department_id', deptId);
      }
      if (stageId) {
        query = query.eq('courses.stage_id', stageId);
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
        if (univId && (!session.professors || session.professors.university_id !== univId)) return false;
        if (deptId && (!session.courses || session.courses.department_id !== deptId)) return false;
        if (stageId && (!session.courses || session.courses.stage_id !== stageId)) return false;
        return true;
      });

      // جلب عدد الحاضرين وعدد المسجلين في القسم لكل جلسة
      const enrichedSessions = await Promise.all(filteredData.map(async (session) => {
        // 1. عدد الطلاب الحاضرين
        const { count: presentCount } = await supabase
          .from('attendance')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', session.id);

        // 2. عدد الطلاب المسجلين أصلاً في هذا القسم والمرحلة ونفس نوع الدراسة
        const { count: enrolledCount } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('department_id', session.courses.department_id)
          .eq('stage_id', session.courses.stage_id)
          .eq('study_type', session.study_type || 'صباحي');

        return {
          ...session,
          present_count: presentCount || 0,
          enrolled_count: enrolledCount || 0
        };
      }));

      setSessions(enrichedSessions);
    } catch (err) {
      showToast('خطأ', 'فشل تحميل تقارير الجلسات', 'danger');
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

      // 3. دمج البيانات لبيان الحاضر والغائب
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

      setSessionAttendance(combined);
    } catch (err) {
      showToast('خطأ', 'فشل تحميل تفاصيل حضور الجلسة', 'danger');
    } finally {
      setModalLoading(false);
    }
  };

  // إعداد الأعمدة وتنسيقات الجداول للتصدير
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
    <div className={styles.adminLayout}>
      <AdminSidebar activePage="reports" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>التقارير وسجلات الحضور الشاملة</h1>
        </div>

        {/* فلاتر التقارير */}
        <div className={styles.toolbar} style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div className={compStyles.inputGroup} style={{ width: '200px', marginBottom: 0 }}>
            <label className={compStyles.label}>الجامعة</label>
            <select
              className={compStyles.select}
              value={univId}
              onChange={e => setUnivId(e.target.value)}
            >
              <option value="">كل الجامعات</option>
              {universities.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className={compStyles.inputGroup} style={{ width: '200px', marginBottom: 0 }}>
            <label className={compStyles.label}>القسم</label>
            <select
              disabled={!univId}
              className={compStyles.select}
              value={deptId}
              onChange={e => setDeptId(e.target.value)}
            >
              <option value="">كل الأقسام</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className={compStyles.inputGroup} style={{ width: '180px', marginBottom: 0 }}>
            <label className={compStyles.label}>المرحلة</label>
            <select
              className={compStyles.select}
              value={stageId}
              onChange={e => setStageId(e.target.value)}
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

        {/* أزرار التصدير وجدول الجلسات */}
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 'bold' }}>سجلات المحاضرات ({sessions.length})</h3>
            <ExportButtons 
              title="تقرير محاضرات الحضور الجامعي - رقيم"
              headers={sessionHeaders}
              data={exportSessionsData}
              fileName="تقرير_المحاضرات_الشامل"
              disabled={sessions.length === 0}
            />
          </div>

          <ReportTable 
            headers={[
              { key: 'started_at', label: 'تاريخ المحاضرة', render: (val) => new Date(val).toLocaleDateString('ar-EG') },
              { key: 'univ', label: 'الجامعة', render: (_, row) => row.professors?.universities?.name || '-' },
              { key: 'prof', label: 'الأستاذ', render: (_, row) => row.professors?.name || '-' },
              { key: 'course', label: 'المادة', render: (_, row) => row.courses?.name || '-' },
              { key: 'dept', label: 'القسم', render: (_, row) => row.courses?.departments?.name || '-' },
              { key: 'stage', label: 'المرحلة', render: (_, row) => row.courses?.stages?.name || '-' },
              { key: 'study_type', label: 'الدراسة', render: (val) => val || 'صباحي' },
              { key: 'ratio', label: 'حضور / إجمالي القسم', render: (_, row) => `${row.present_count} / ${row.enrolled_count}` },
              { 
                key: 'actions', 
                label: 'عرض التفاصيل', 
                render: (_, row) => (
                  <Button 
                    variant="outline" 
                    onClick={() => handleViewSessionDetails(row)}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                    icon={Eye}
                  >
                    تفاصيل
                  </Button>
                )
              }
            ]}
            data={sessions}
            loading={loading}
            emptyMessage="لم يتم العثور على أي جلسات حضور مسجلة تطابق هذه الفلاتر."
          />
        </div>
      </div>

      {/* مودال تفاصيل جلسة معينة وتصدير حضورها */}
      <Modal
        isOpen={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        title={selectedSession ? `تفاصيل حضور مادة: ${selectedSession.courses?.name}` : ''}
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
                data={sessionAttendance}
                fileName={`حضور_${selectedSession.courses?.name}`}
                disabled={sessionAttendance.length === 0}
              />
            </div>

            <div style={{ marginTop: '1rem', maxHeight: '350px', overflowY: 'auto' }}>
              <ReportTable 
                headers={detailHeaders}
                data={sessionAttendance}
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
