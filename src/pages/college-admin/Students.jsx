import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Key, Users, GraduationCap, Download, Upload, RefreshCw, XCircle, BookOpen, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Table, Tr, Th, Td } from '../../components/ui/Table';
import { Skeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import { generateAndUploadQRCard } from '../../lib/qrGenerator';
import { CollegeAdminSidebar } from './Dashboard';
import styles from '../../styles/admin.module.css';
import compStyles from '../../styles/components.module.css';
import { useAuth } from '../../hooks/useAuth';

export default function CollegeAdminStudents() {
  const { showToast } = useToast();
  const { adminDetails } = useAuth();
  const fileInputRef = useRef(null);

  // States
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedStudyType, setSelectedStudyType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCoursesModalOpen, setIsCoursesModalOpen] = useState(false);

  // Forms
  const [studentForm, setStudentForm] = useState({ name: '', student_number: '', department_id: '', stage_id: '', study_type: 'صباحي' });
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [isImporting, setIsImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState([]);
  
  // Student Courses Management
  const [activeStudent, setActiveStudent] = useState(null);
  const [studentCourses, setStudentCourses] = useState([]);
  const [allCollegeCourses, setAllCollegeCourses] = useState([]);
  const [courseForm, setCourseForm] = useState({ course_id: '', academic_year: '', type: 'repeat' });

  // Calculate current academic year
  const getAcademicYear = () => {
    const now = new Date();
    return now.getMonth() >= 8 
      ? `${now.getFullYear()}/${now.getFullYear() + 1}` 
      : `${now.getFullYear() - 1}/${now.getFullYear()}`;
  };

  useEffect(() => {
    if (adminDetails?.college_id) {
      fetchInitialData();
    }
  }, [adminDetails]);

  useEffect(() => {
    if (adminDetails?.college_id) {
      fetchStudents();
    }
  }, [adminDetails, selectedDept, selectedStage, selectedStudyType]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // Departments
      const { data: depts } = await supabase
        .from('departments')
        .select('*')
        .eq('college_id', adminDetails.college_id)
        .order('name', { ascending: true });
      setDepartments(depts || []);

      // Stages
      const { data: stgs } = await supabase
        .from('stages')
        .select('*')
        .order('created_at', { ascending: true });
      setStages(stgs || []);

      // Fetch all courses in college for repeat selection
      const { data: crs } = await supabase
        .from('courses')
        .select('*, departments(name), stages(name)')
        .eq('departments.college_id', adminDetails.college_id)
        .order('name', { ascending: true });
      
      // Clean courses which might have null departments because of inner filters
      const cleanedCrs = (crs || []).filter(c => c.departments);
      setAllCollegeCourses(cleanedCrs);

    } catch (err) {
      showToast('خطأ', 'فشل تحميل بيانات الكلية المبدئية', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('students')
        .select('*, departments(name), stages(name), colleges(name)')
        .eq('college_id', adminDetails.college_id);

      if (selectedDept) query = query.eq('department_id', selectedDept);
      if (selectedStage) query = query.eq('stage_id', selectedStage);
      if (selectedStudyType) query = query.eq('study_type', selectedStudyType);

      const { data, error } = await query.order('full_name', { ascending: true });
      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      showToast('خطأ', 'فشل جلب قائمة الطلاب', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Add individual student
  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const qrToken = crypto.randomUUID();
      const studentId = crypto.randomUUID();
      const univName = adminDetails.colleges?.name || 'رقيم حضور';

      // 1. Calculate public url for QR
      const path = `${adminDetails.college_id}/${studentId}.png`;
      const { data: { publicUrl } } = supabase.storage.from('qr-cards').getPublicUrl(path);

      const newStudent = {
        id: studentId,
        college_id: adminDetails.college_id,
        department_id: studentForm.department_id,
        stage_id: studentForm.stage_id,
        full_name: studentForm.name,
        student_number: studentForm.student_number,
        qr_token: qrToken,
        qr_image_url: publicUrl,
        study_type: studentForm.study_type
      };

      // 2. Insert into DB
      const { error: dbErr } = await supabase.from('students').insert(newStudent);
      if (dbErr) throw dbErr;

      // 3. Generate QR Card
      await generateAndUploadQRCard(newStudent, univName);

      showToast('نجاح', 'تم تسجيل الطالب وتوليد بطاقة الحضور بنجاح', 'success');
      setIsCreateModalOpen(false);
      setStudentForm({ name: '', student_number: '', department_id: '', stage_id: '', study_type: 'صباحي' });
      fetchStudents();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل إضافة الطالب', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // CSV Import handling
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      parseCSV(text);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const parseCSV = (text) => {
    try {
      const lines = text.split(/\r?\n/);
      if (lines.length <= 1) {
        throw new Error('الملف فارغ أو لا يحتوي على ترويسة الأعمدة');
      }

      // ترويسة الأعمدة: الاسم، الرقم الجامعي، القسم، المرحلة، نوع الدراسة
      // full_name, student_number, department, stage, study_type
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        
        if (values.length < headers.length) continue;

        const rowObject = {};
        headers.forEach((header, idx) => {
          rowObject[header] = values[idx];
        });
        rows.push(rowObject);
      }

      setCsvPreview(rows);
    } catch (err) {
      showToast('خطأ في قراءة الملف', err.message || 'فشل تحليل ملف CSV', 'danger');
    }
  };

  const executeImport = async () => {
    if (csvPreview.length === 0) return;
    setIsImporting(true);
    setImportProgress({ current: 0, total: csvPreview.length });

    try {
      const univName = adminDetails.universities?.name || 'جامعة رقيم';
      const departmentsMap = new Map(departments.map(d => [d.name.trim(), d.id]));
      
      const studentsToInsert = [];
      const dbStages = stages;

      csvPreview.forEach(studentRow => {
        const studentId = crypto.randomUUID();
        const qrToken = crypto.randomUUID();
        const deptId = departmentsMap.get(studentRow.department.trim());
        
        let stage = dbStages?.find(s => s.name.trim() === studentRow.stage.trim());
        if (!stage) {
          stage = dbStages[0];
        }

        const path = `${adminDetails.college_id}/${studentId}.png`;
        const { data: { publicUrl } } = supabase.storage.from('qr-cards').getPublicUrl(path);

        studentsToInsert.push({
          id: studentId,
          college_id: adminDetails.college_id,
          department_id: deptId || departments[0]?.id,
          stage_id: stage?.id,
          full_name: studentRow.full_name.trim(),
          student_number: studentRow.student_number.trim(),
          qr_token: qrToken,
          qr_image_url: publicUrl,
          study_type: studentRow.study_type === 'مسائي' ? 'مسائي' : 'صباحي'
        });
      });

      // Insert students in bulk
      const { error: insertErr } = await supabase
        .from('students')
        .insert(studentsToInsert);

      if (insertErr) throw insertErr;

      // Parallel chunk generation for QR cards
      const batchSize = 6;
      for (let i = 0; i < studentsToInsert.length; i += batchSize) {
        const batch = studentsToInsert.slice(i, i + batchSize);
        await Promise.all(batch.map(async (student) => {
          try {
            await generateAndUploadQRCard(student, univName);
          } catch (qrErr) {
            console.error(`فشل رفع كود QR للطالب ${student.full_name}:`, qrErr);
          }
        }));
        setImportProgress({ current: Math.min(i + batchSize, studentsToInsert.length), total: studentsToInsert.length });
      }

      showToast('نجاح الاستيراد', `تم استيراد ${studentsToInsert.length} طالب جديد وتوليد بطاقات الـ QR بنجاح.`, 'success');
      setIsImportModalOpen(false);
      setCsvPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchStudents();
    } catch (err) {
      showToast('فشل الاستيراد', err.message || 'حدث خطأ أثناء عملية الاستيراد', 'danger');
    } finally {
      setIsImporting(false);
    }
  };

  // Student QR Telegram Resend
  const triggerTelegramResend = async (student) => {
    if (!student.telegram_chat_id) {
      showToast(
        'البوت غير مفعل للطالب ⚠️', 
        'لم يقم الطالب بتفعيل البوت بعد. يجب عليه إرسال رقمه الجامعي للبوت أولاً لربط حسابه.', 
        'warning',
        6000
      );
      return;
    }

    try {
      showToast('جاري الطلب', 'يتم إرسال طلب البطاقة للبوت...', 'info');
      const { error } = await supabase
        .from('telegram_resend_requests')
        .insert({ student_id: student.id });

      if (error) throw error;
      showToast('تم إرسال الطلب ✅', 'سيرسل البوت بطاقة الحضور للطالب على تيليجرام فوراً.', 'success');
    } catch (err) {
      showToast('خطأ', 'فشل إرسال طلب إعادة الإرسال', 'danger');
    }
  };

  // Delete individual student
  const handleDeleteStudent = async (student) => {
    if (!window.confirm(`هل أنت متأكد من حذف الطالب "${student.full_name}"؟ سيتم حذف بطاقته وسجل حضوره ودرجاته بالكامل!`)) return;
    try {
      const path = `${student.college_id}/${student.id}.png`;
      await supabase.storage.from('qr-cards').remove([path]);

      const { error } = await supabase.from('students').delete().eq('id', student.id);
      if (error) throw error;

      showToast('نجاح', 'تم حذف الطالب وبطاقته بنجاح', 'success');
      fetchStudents();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف الطالب', 'danger');
    }
  };

  // Delete all filtered students
  const handleDeleteAllStudents = async () => {
    if (filteredStudents.length === 0) return;
    if (!window.confirm(`🚨 تحذير: هل أنت متأكد من حذف جميع الطلاب المعروضين حالياً بالفلتر (${filteredStudents.length} طالب)؟ سيتم إزالة كروت الـ QR وسجلات حضورهم نهائياً!`)) return;
    if (!window.confirm('⚠️ تأكيد نهائي: هذه العملية لا يمكن التراجع عنها.')) return;

    setLoading(true);
    try {
      const paths = filteredStudents.map(s => `${s.college_id}/${s.id}.png`);
      const batchSize = 50;
      for (let i = 0; i < paths.length; i += batchSize) {
        const batch = paths.slice(i, i + batchSize);
        await supabase.storage.from('qr-cards').remove(batch);
      }

      const ids = filteredStudents.map(s => s.id);
      const { error } = await supabase.from('students').delete().in('id', ids);
      if (error) throw error;

      showToast('نجاح الحذف', `تم إزالة ${ids.length} طالب من المنصة بنجاح.`, 'success');
      fetchStudents();
    } catch (err) {
      showToast('خطأ في العملية', err.message || 'فشل حذف الطلاب', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Unlink Telegram account
  const handleUnlinkTelegram = async (student) => {
    if (!window.confirm(`هل تريد إلغاء ربط حساب التيليجرام الخاص بالطالب "${student.full_name}" وإعادة توليد بطاقة حضور سحابية عامة له؟`)) return;
    try {
      setLoading(true);
      const univName = student.colleges?.name || 'رقيم حضور';
      const newQrUrl = await generateAndUploadQRCard(student, univName);

      const { error } = await supabase
        .from('students')
        .update({
          telegram_chat_id: null,
          telegram_file_id: null,
          qr_image_url: newQrUrl
        })
        .eq('id', student.id);

      if (error) throw error;
      showToast('تم إلغاء الربط 🔓', 'تم إلغاء الربط وإعادة تهيئة البطاقة بنجاح.', 'success');
      fetchStudents();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل إلغاء ربط الحساب', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Manage student courses (such as repeat courses)
  const openStudentCourses = async (student) => {
    setActiveStudent(student);
    setCourseForm({ course_id: '', academic_year: getAcademicYear(), type: 'repeat' });
    setIsCoursesModalOpen(true);
    await fetchStudentCourses(student.id);
  };

  const fetchStudentCourses = async (studentId) => {
    try {
      const { data, error } = await supabase
        .from('student_courses')
        .select('*, courses(name, units, stages(name), departments(name))')
        .eq('student_id', studentId);

      if (error) throw error;
      setStudentCourses(data || []);
    } catch (err) {
      showToast('خطأ', 'فشل جلب مواد الطالب', 'danger');
    }
  };

  const handleRegisterCourse = async (e) => {
    e.preventDefault();
    if (!activeStudent || !courseForm.course_id) return;

    try {
      const { error } = await supabase
        .from('student_courses')
        .insert({
          student_id: activeStudent.id,
          course_id: courseForm.course_id,
          academic_year: courseForm.academic_year || getAcademicYear(),
          type: courseForm.type
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('هذا الطالب مسجل في هذه المادة بالفعل لهذه السنة الأكاديمية.');
        }
        throw error;
      }

      showToast('تم التسجيل ✅', 'تم تسجيل المقرر للطالب بنجاح.', 'success');
      fetchStudentCourses(activeStudent.id);
    } catch (err) {
      showToast('خطأ في التسجيل', err.message || 'فشل تسجيل المادة', 'danger');
    }
  };

  const handleRemoveStudentCourse = async (scId) => {
    if (!window.confirm('هل تريد إلغاء تسجيل هذه المادة عن الطالب؟')) return;
    try {
      const { error } = await supabase
        .from('student_courses')
        .delete()
        .eq('id', scId);

      if (error) throw error;
      showToast('تم الحذف', 'تم إلغاء المادة بنجاح', 'success');
      fetchStudentCourses(activeStudent.id);
    } catch (err) {
      showToast('خطأ', 'فشل حذف المادة', 'danger');
    }
  };

  // دالة لتحميل نموذج ملف كشوف الطلاب بصيغة CSV تدعم الترميز العربي بترميز UTF-8 BOM
  const downloadTemplate = () => {
    const csvContent = 'full_name,student_number,department,stage,study_type\n' +
      'علي أحمد حسين,2023/CS/0142,قسم علوم الحاسوب,المرحلة الأولى,صباحي\n' +
      'فاطمة عباس محمد,2023/CS/0143,قسم علوم الحاسوب,المرحلة الأولى,مسائي\n' +
      'أحمد رعد علي,2023/CS/0144,قسم علوم الحاسوب,المرحلة الثانية,صباحي\n' +
      'زينب جعفر حسن,2023/CS/0145,قسم هندسة البرمجيات,المرحلة الأولى,صباحي\n';
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'نموذج_طلاب_رقيم.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.student_number.includes(searchQuery);
    return matchesSearch;
  });

  return (
    <div className={styles.adminLayout}>
      <CollegeAdminSidebar activePage="students" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>إدارة كشوف الطلاب والـ QR</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => setIsImportModalOpen(true)}>
              <Upload size={18} />
              <span>استيراد كشف (CSV)</span>
            </Button>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus size={18} />
              <span>إضافة طالب فردي</span>
            </Button>
          </div>
        </div>

        {/* فلاتر الطلاب */}
        <div className={styles.glass} style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div className={compStyles.inputGroup} style={{ margin: 0, minWidth: '180px' }}>
            <select className={compStyles.input} value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
              <option value="">جميع الأقسام</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className={compStyles.inputGroup} style={{ margin: 0, minWidth: '150px' }}>
            <select className={compStyles.input} value={selectedStage} onChange={e => setSelectedStage(e.target.value)}>
              <option value="">جميع المراحل</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className={compStyles.inputGroup} style={{ margin: 0, minWidth: '120px' }}>
            <select className={compStyles.input} value={selectedStudyType} onChange={e => setSelectedStudyType(e.target.value)}>
              <option value="">جميع الدراسات</option>
              <option value="صباحي">صباحي</option>
              <option value="مسائي">مسائي</option>
            </select>
          </div>

          <div className={compStyles.inputGroup} style={{ margin: 0, flex: 1, minWidth: '200px' }}>
            <input 
              type="text" 
              className={compStyles.input} 
              placeholder="ابحث بالاسم أو الرقم الجامعي..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {filteredStudents.length > 0 && (
            <Button variant="danger" size="sm" onClick={handleDeleteAllStudents}>
              <Trash2 size={16} />
              <span>حذف كل المفلترين ({filteredStudents.length})</span>
            </Button>
          )}
        </div>

        {loading ? (
          <Skeleton height="300px" />
        ) : filteredStudents.length === 0 ? (
          <div className={styles.glass} style={{ padding: '4rem', textAlign: 'center', borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)' }}>
            لا يوجد طلاب يطابقون خيارات البحث الحالية.
          </div>
        ) : (
          <div className={compStyles.tableContainer}>
            <Table>
              <thead>
                <Tr>
                  <Th>الاسم الكامل</Th>
                  <Th>الرقم الجامعي</Th>
                  <Th>القسم</Th>
                  <Th>المرحلة</Th>
                  <Th>الدراسة</Th>
                  <Th>التيليجرام</Th>
                  <Th>العمليات</Th>
                </Tr>
              </thead>
              <tbody>
                {filteredStudents.map(student => (
                  <Tr key={student.id}>
                    <Td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{student.full_name}</Td>
                    <Td style={{ fontFamily: 'monospace' }}>{student.student_number}</Td>
                    <Td>{student.departments?.name || '-'}</Td>
                    <Td>{student.stages?.name || '-'}</Td>
                    <Td>{student.study_type}</Td>
                    <Td>
                      {student.telegram_chat_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Badge variant="success">نشط ✅</Badge>
                          <Button size="icon" style={{ padding: '2px', height: 'auto', background: 'none', border: 'none', color: 'var(--danger)' }} onClick={() => handleUnlinkTelegram(student)}>
                            <XCircle size={14} />
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="secondary">غير مرتبط</Badge>
                      )}
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <Button size="sm" variant="secondary" onClick={() => openStudentCourses(student)}>
                          <BookOpen size={14} />
                          <span>المواد</span>
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => triggerTelegramResend(student)} disabled={!student.telegram_chat_id}>
                          <RefreshCw size={14} />
                          <span>إعادة إرسال QR</span>
                        </Button>
                        <Button size="icon" variant="danger" onClick={() => handleDeleteStudent(student)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        {/* مودال الطالب الفردي */}
        <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="إضافة طالب جديد">
          <form onSubmit={handleCreateStudent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>الاسم الكامل للطالب (رباعي)</label>
              <input 
                type="text" 
                required
                className={compStyles.input}
                value={studentForm.name}
                onChange={e => setStudentForm({ ...studentForm, name: e.target.value })}
                placeholder="أحمد محمد علي حسين"
              />
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>الرقم الجامعي</label>
              <input 
                type="text" 
                required
                className={compStyles.input}
                value={studentForm.student_number}
                onChange={e => setStudentForm({ ...studentForm, student_number: e.target.value })}
                placeholder="2023/CS/0142"
              />
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>القسم العلمي</label>
              <select 
                className={compStyles.input}
                value={studentForm.department_id}
                onChange={e => setStudentForm({ ...studentForm, department_id: e.target.value })}
                required
              >
                <option value="">اختر القسم</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>المرحلة الدراسية</label>
              <select 
                className={compStyles.input}
                value={studentForm.stage_id}
                onChange={e => setStudentForm({ ...studentForm, stage_id: e.target.value })}
                required
              >
                <option value="">اختر المرحلة</option>
                {stages.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>نوع الدراسة</label>
              <select 
                className={compStyles.input}
                value={studentForm.study_type}
                onChange={e => setStudentForm({ ...studentForm, study_type: e.target.value })}
                required
              >
                <option value="صباحي">صباحي</option>
                <option value="مسائي">مسائي</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>إلغاء</Button>
              <Button type="submit">تسجيل وتوليد QR</Button>
            </div>
          </form>
        </Modal>

        {/* مودال الاستيراد الجماعي */}
        <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="استيراد كشف كروت الطلاب جماعياً">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.glass} style={{ padding: '1rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                💡 <b>صيغة ملف الاستيراد المطلوبة:</b>
                <br />
                يجب أن يكون الملف بامتداد <b>.csv</b> يحتوي على الترويسة التالية بالضبط:
                <br />
                <code style={{ direction: 'ltr', display: 'block', backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px', margin: '0.5rem 0', fontFamily: 'monospace' }}>
                  full_name, student_number, department, stage, study_type
                </code>
                تأكد من مطابقة أسماء الأقسام والمراحل كما هي مسجلة بالكلية.
              </p>
            </div>

            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>اختر ملف كشف الطلاب</label>
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".csv"
                className={compStyles.input}
                onChange={handleFileChange}
                disabled={isImporting}
              />
            </div>

            {isImporting && (
              <div style={{ width: '100%', margin: '1rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <span>جاري توليد ورفع بطاقات الـ QR...</span>
                  <span>{importProgress.current} / {importProgress.total}</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(importProgress.current / importProgress.total) * 100}%`, height: '100%', backgroundColor: 'var(--accent)', transition: 'width 0.2s' }}></div>
                </div>
              </div>
            )}

            {csvPreview.length > 0 && !isImporting && (
              <div>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>معاينة الكشف المستورد ({csvPreview.length} طالب):</h4>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <th style={{ padding: '6px' }}>الاسم</th>
                        <th style={{ padding: '6px' }}>الرقم الجامعي</th>
                        <th style={{ padding: '6px' }}>القسم</th>
                        <th style={{ padding: '6px' }}>المرحلة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 10).map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px' }}>{r.full_name}</td>
                          <td style={{ padding: '6px' }}>{r.student_number}</td>
                          <td style={{ padding: '6px' }}>{r.department}</td>
                          <td style={{ padding: '6px' }}>{r.stage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvPreview.length > 10 && <div style={{ padding: '6px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>+ {csvPreview.length - 10} طلاب آخرين...</div>}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '1rem', width: '100%' }}>
              <Button variant="secondary" onClick={downloadTemplate} style={{ marginLeft: 'auto' }}>
                <Download size={16} />
                <span>تحميل النموذج التجريبي (CSV)</span>
              </Button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="secondary" onClick={() => { setIsImportModalOpen(false); setCsvPreview([]); }} disabled={isImporting}>إلغاء</Button>
                <Button onClick={executeImport} disabled={csvPreview.length === 0 || isImporting}>
                  <span>بدء الاستيراد وتوليد الكروت</span>
                </Button>
              </div>
            </div>
          </div>
        </Modal>

        {/* مودال إدارة المقررات والانتساب للمواد ومواد الإعادة */}
        <Modal isOpen={isCoursesModalOpen} onClose={() => setIsCoursesModalOpen(false)} title={`إدارة المقررات الدراسية للطالب: ${activeStudent?.full_name || ''}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* تسجيل مادة جديدة */}
            <form onSubmit={handleRegisterCourse} className={styles.glass} style={{ padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <BookOpen size={16} />
                <span>تسجيل مقرر دراسي جديد (إعادة أو منتظم)</span>
              </h4>
              
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div className={compStyles.inputGroup} style={{ margin: 0, flex: 1, minWidth: '150px' }}>
                  <select 
                    className={compStyles.input} 
                    value={courseForm.course_id} 
                    onChange={e => setCourseForm({ ...courseForm, course_id: e.target.value })} 
                    required
                  >
                    <option value="">اختر المادة</option>
                    {allCollegeCourses.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.departments?.name} - {c.stages?.name})</option>
                    ))}
                  </select>
                </div>

                <div className={compStyles.inputGroup} style={{ margin: 0, width: '110px' }}>
                  <input 
                    type="text" 
                    className={compStyles.input} 
                    placeholder="العام الدراسي" 
                    value={courseForm.academic_year} 
                    onChange={e => setCourseForm({ ...courseForm, academic_year: e.target.value })}
                    required
                  />
                </div>

                <div className={compStyles.inputGroup} style={{ margin: 0, width: '100px' }}>
                  <select 
                    className={compStyles.input} 
                    value={courseForm.type} 
                    onChange={e => setCourseForm({ ...courseForm, type: e.target.value })}
                  >
                    <option value="regular">منتظم</option>
                    <option value="repeat">إعادة ⚠️</option>
                  </select>
                </div>

                <Button type="submit">تسجيل</Button>
              </div>
            </form>

            {/* المواد المسجلة حالياً */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>المقررات المسجلة للطالب:</h4>
              {studentCourses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
                  لا توجد مواد مسجلة للطالب بعد. (المواد الافتراضية تعتمد على مرحلته وقسمه)
                </div>
              ) : (
                <div className={compStyles.tableContainer}>
                  <Table>
                    <thead>
                      <Tr>
                        <Th>المادة</Th>
                        <Th>العام الدراسي</Th>
                        <Th>النوع</Th>
                        <Th>العمليات</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {studentCourses.map(sc => (
                        <Tr key={sc.id}>
                          <Td style={{ fontWeight: '600' }}>{sc.courses?.name}</Td>
                          <Td>{sc.academic_year}</Td>
                          <Td>
                            {sc.type === 'repeat' ? (
                              <Badge variant="danger">إعادة</Badge>
                            ) : (
                              <Badge variant="success">منتظم</Badge>
                            )}
                          </Td>
                          <Td>
                            <Button size="icon" variant="danger" onClick={() => handleRemoveStudentCourse(sc.id)}>
                              <Trash2 size={14} />
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setIsCoursesModalOpen(false)}>إغلاق النافذة</Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
