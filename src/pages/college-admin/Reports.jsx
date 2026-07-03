import React, { useState, useEffect } from 'react';
import { Search, Calendar, FileSpreadsheet, Eye, School, GraduationCap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ReportTable } from '../../components/reports/ReportTable';
import { ExportButtons } from '../../components/reports/ExportButtons';
import { CollegeAdminSidebar } from './Dashboard';
import styles from '../../styles/admin.module.css';
import compStyles from '../../styles/components.module.css';
import { useAuth } from '../../hooks/useAuth';

export default function CollegeAdminReports() {
  const { showToast } = useToast();
  const { adminDetails } = useAuth();

  // States
  const [sessions, setSessions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [deptId, setDeptId] = useState('');
  const [stageId, setStageId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Detail Modal States
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionAttendance, setSessionAttendance] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    if (adminDetails?.college_id) {
      fetchInitialData();
    }
  }, [adminDetails]);

  useEffect(() => {
    if (adminDetails?.college_id) {
      fetchSessions();
    }
  }, [adminDetails, deptId, stageId, startDate, endDate]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      const { data: depts } = await supabase
        .from('departments')
        .select('*')
        .eq('college_id', adminDetails.college_id)
        .order('name', { ascending: true });
      setDepartments(depts || []);

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

  const fetchSessions = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('sessions')
        .select(`
          id,
          started_at,
          ended_at,
          is_open,
          study_type,
          professors!inner (id, name, college_id),
          courses!inner (
            id, 
            name, 
            department_id, 
            stage_id,
            departments(name), 
            stages(name)
          )
        `)
        .eq('professors.college_id', adminDetails.college_id)
        .order('started_at', { ascending: false });

      // تطبيق الفلاتر
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

      // جلب عدد الحاضرين والمسجلين لكل جلسة
      const enrichedSessions = await Promise.all((data || []).map(async (session) => {
        const { count: presentCount } = await supabase
          .from('attendance')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', session.id);

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
      const { data: allStudents, error: studErr } = await supabase
        .from('students')
        .select('id, full_name, student_number, study_type')
        .eq('department_id', session.courses.department_id)
        .eq('stage_id', session.courses.stage_id)
        .eq('study_type', session.study_type || 'صباحي')
        .order('full_name', { ascending: true });

      if (studErr) throw studErr;

      const { data: presentList, error: presErr } = await supabase
        .from('attendance')
        .select('student_id, scanned_at')
        .eq('session_id', session.id);

      if (presErr) throw presErr;

      const presentMap = new Map(presentList?.map(p => [p.student_id, p.scanned_at]) || []);

      const combined = (allStudents || []).map(student => {
        const scannedAt = presentMap.get(student.id);
        return {
          id: student.id,
          full_name: student.full_name,
          student_number: student.student_number,
          study_type: student.study_type,
          present: !!scannedAt,
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

  // بيانات التصدير بصيغة متوافقة مع أداة Excel/PDF
  const getExportData = () => {
    return sessions.map(s => ({
      course_name: s.courses?.name || '-',
      prof_name: s.professors?.name || '-',
      dept_name: s.courses?.departments?.name || '-',
      stage_name: s.courses?.stages?.name || '-',
      study_type: s.study_type || 'صباحي',
      date: new Date(s.started_at).toLocaleDateString('ar-EG'),
      time: new Date(s.started_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      present_count: s.present_count,
      enrolled_count: s.enrolled_count,
      ratio: s.enrolled_count > 0 ? `${Math.round((s.present_count / s.enrolled_count) * 100)}%` : '0%'
    }));
  };

  const exportHeaders = [
    { key: 'course_name', label: 'المادة الدراسية' },
    { key: 'prof_name', label: 'الأستاذ' },
    { key: 'dept_name', label: 'القسم' },
    { key: 'stage_name', label: 'المرحلة' },
    { key: 'study_type', label: 'الدراسة' },
    { key: 'date', label: 'التاريخ' },
    { key: 'time', label: 'وقت البدء' },
    { key: 'present_count', label: 'عدد الحاضرين' },
    { key: 'enrolled_count', label: 'الإجمالي المسجل' },
    { key: 'ratio', label: 'نسبة الحضور' }
  ];

  return (
    <div className={styles.adminLayout}>
      <CollegeAdminSidebar activePage="reports" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>تقارير حضور المحاضرات بالكلية</h1>
          {sessions.length > 0 && (
            <ExportButtons 
              headers={exportHeaders} 
              data={getExportData()} 
              title="كشف_حضور_محاضرات_الكلية" 
              fileName="تقرير_حضور_الكلية"
            />
          )}
        </div>

        {/* شريط الفلترة والبحث */}
        <div className={styles.glass} style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div className={compStyles.inputGroup} style={{ margin: 0, minWidth: '180px' }}>
            <select className={compStyles.input} value={deptId} onChange={e => setDeptId(e.target.value)}>
              <option value="">جميع الأقسام</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className={compStyles.inputGroup} style={{ margin: 0, minWidth: '150px' }}>
            <select className={compStyles.input} value={stageId} onChange={e => setStageId(e.target.value)}>
              <option value="">جميع المراحل</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
            <input 
              type="date" 
              className={compStyles.input} 
              style={{ width: '130px', padding: '0.4rem' }} 
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)' }}>إلى</span>
            <input 
              type="date" 
              className={compStyles.input} 
              style={{ width: '130px', padding: '0.4rem' }}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <Skeleton height="300px" />
        ) : sessions.length === 0 ? (
          <div className={styles.glass} style={{ padding: '4rem', textAlign: 'center', borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)' }}>
            لا توجد جلسات حضور مسجلة تطابق الفلاتر المحددة حالياً.
          </div>
        ) : (
          <div className={compStyles.tableContainer}>
            <Table>
              <thead>
                <Tr>
                  <Th>المادة</Th>
                  <Th>الأستاذ</Th>
                  <Th>القسم والمرحلة</Th>
                  <Th>الدراسة</Th>
                  <Th>التاريخ</Th>
                  <Th>الحاضرين</Th>
                  <Th>نسبة الحضور</Th>
                  <Th>تفاصيل</Th>
                </Tr>
              </thead>
              <tbody>
                {sessions.map(session => {
                  const ratio = session.enrolled_count > 0 ? Math.round((session.present_count / session.enrolled_count) * 100) : 0;
                  return (
                    <Tr key={session.id}>
                      <Td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{session.courses?.name}</Td>
                      <Td>{session.professors?.name || '-'}</Td>
                      <Td>{session.courses?.departments?.name} — {session.courses?.stages?.name}</Td>
                      <Td>{session.study_type || 'صباحي'}</Td>
                      <Td>{new Date(session.started_at).toLocaleDateString('ar-EG')} {new Date(session.started_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</Td>
                      <Td>{session.present_count} / {session.enrolled_count}</Td>
                      <Td style={{ fontWeight: 'bold', color: ratio >= 75 ? 'var(--success)' : ratio >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                        {ratio}%
                      </Td>
                      <Td>
                        <Button size="icon" variant="secondary" onClick={() => handleViewSessionDetails(session)}>
                          <Eye size={16} />
                        </Button>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}

        {/* مودال تفاصيل الجلسة */}
        <Modal 
          isOpen={!!selectedSession} 
          onClose={() => setSelectedSession(null)} 
          title={`تفاصيل حضور المحاضرة: ${selectedSession?.courses?.name || ''}`}
        >
          {modalLoading ? (
            <Skeleton height="200px" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span><b>الأستاذ:</b> {selectedSession?.professors?.name}</span>
                <span><b>التاريخ:</b> {selectedSession && new Date(selectedSession.started_at).toLocaleDateString('ar-EG')}</span>
                <span><b>الشعبة:</b> {selectedSession?.study_type}</span>
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-tertiary)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '8px' }}>اسم الطالب</th>
                      <th style={{ padding: '8px' }}>الرقم الجامعي</th>
                      <th style={{ padding: '8px' }}>الحالة</th>
                      <th style={{ padding: '8px' }}>وقت المسح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionAttendance.map(sa => (
                      <tr key={sa.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
                        <td style={{ padding: '8px', fontWeight: '600' }}>{sa.full_name}</td>
                        <td style={{ padding: '8px', fontFamily: 'monospace' }}>{sa.student_number}</td>
                        <td style={{ padding: '8px' }}>
                          {sa.present ? (
                            <Badge variant="success">حاضر ✅</Badge>
                          ) : (
                            <Badge variant="danger">غائب ❌</Badge>
                          )}
                        </td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{sa.scanned_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <Button variant="secondary" onClick={() => setSelectedSession(null)}>إغلاق</Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
