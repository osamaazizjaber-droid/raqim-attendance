import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit, Folder, School, PlusCircle, Download, Upload, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Table, Tr, Th, Td } from '../../components/ui/Table';
import { Skeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import { CollegeAdminSidebar } from './Dashboard';
import styles from '../../styles/admin.module.css';
import compStyles from '../../styles/components.module.css';
import { useAuth } from '../../hooks/useAuth';
import { exportToExcel } from '../../lib/exportUtils';

// دالة لتسوية الحروف العربية لتجنب اختلاف الإملاء
const normalizeArabic = (str) => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
};

export default function CollegeAdminDepartments() {
  const { showToast } = useToast();
  const { adminDetails } = useAuth();
  const fileInputRef = useRef(null);
  
  // States
  const [departments, setDepartments] = useState([]);
  const [stages, setStages] = useState([]);
  const [courses, setCourses] = useState([]);
  
  const [selectedDept, setSelectedDept] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Form inputs
  const [deptForm, setDeptForm] = useState({ id: null, name: '' });
  const [courseForm, setCourseForm] = useState({ id: null, name: '', stage_id: '', units: 1, semester: 'الكورس الأول' });

  // CSV / Excel Import states
  const [csvPreview, setCsvPreview] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [updateExisting, setUpdateExisting] = useState(true);

  // Initial load
  useEffect(() => {
    if (adminDetails?.college_id) {
      fetchInitialData();
    }
  }, [adminDetails]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      // Fetch Stages ordered by name
      const { data: stgs, error: sErr } = await supabase
        .from('stages')
        .select('*')
        .order('created_at', { ascending: true });
      if (sErr) throw sErr;
      setStages(stgs || []);
      
      // Fetch Departments in this college
      await fetchDepartments();
      
    } catch (err) {
      showToast('خطأ', 'حدث خطأ أثناء تحميل البيانات المبدئية', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data: depts, error } = await supabase
        .from('departments')
        .select('*')
        .eq('college_id', adminDetails.college_id)
        .order('name', { ascending: true });
      
      if (error) throw error;
      setDepartments(depts || []);
      
      if (depts && depts.length > 0) {
        setSelectedDept(prev => {
          const match = prev ? depts.find(d => d.id === prev.id) : null;
          const chosen = match || depts[0];
          fetchDeptCourses(chosen.id);
          return chosen;
        });
      } else {
        setSelectedDept(null);
        setCourses([]);
      }
    } catch (err) {
      showToast('خطأ', 'فشل تحميل الأقسام', 'danger');
    }
  };

  // Fetch Courses for a selected Department
  const fetchDeptCourses = async (deptId) => {
    try {
      const { data: crs, error } = await supabase
        .from('courses')
        .select('*, stages(name)')
        .eq('department_id', deptId)
        .order('name', { ascending: true });
      
      if (error) throw error;
      setCourses(crs || []);
    } catch (err) {
      showToast('خطأ', 'فشل تحميل المواد الدراسية', 'danger');
    }
  };

  const handleDeptSelect = async (dept) => {
    setSelectedDept(dept);
    await fetchDeptCourses(dept.id);
  };

  // Department CRUD
  const saveDepartment = async (e) => {
    e.preventDefault();
    try {
      if (deptForm.id) {
        // Edit
        const { error } = await supabase
          .from('departments')
          .update({ name: deptForm.name })
          .eq('id', deptForm.id);
        if (error) throw error;
        showToast('نجاح', 'تم تحديث القسم بنجاح', 'success');
      } else {
        // Create
        const { error } = await supabase
          .from('departments')
          .insert({ name: deptForm.name, college_id: adminDetails.college_id });
        if (error) throw error;
        showToast('نجاح', 'تم إضافة القسم بنجاح', 'success');
      }
      setIsDeptModalOpen(false);
      setDeptForm({ id: null, name: '' });
      fetchDepartments();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حفظ القسم', 'danger');
    }
  };

  const deleteDepartment = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف قسم "${name}"؟ سيتم حذف جميع المواد الدراسية التابعة له!`)) return;
    try {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;
      showToast('نجاح', 'تم حذف القسم بنجاح', 'success');
      fetchDepartments();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف القسم', 'danger');
    }
  };

  // Course CRUD
  const saveCourse = async (e) => {
    e.preventDefault();
    if (!selectedDept) return;
    try {
      if (courseForm.id) {
        // Edit
        const { error } = await supabase
          .from('courses')
          .update({ 
            name: courseForm.name, 
            stage_id: courseForm.stage_id,
            units: parseFloat(courseForm.units) || 1,
            semester: courseForm.semester || 'الكورس الأول'
          })
          .eq('id', courseForm.id);
        if (error) throw error;
        showToast('نجاح', 'تم تحديث المادة بنجاح', 'success');
      } else {
        // Create
        const { error } = await supabase
          .from('courses')
          .insert({
            name: courseForm.name,
            stage_id: courseForm.stage_id,
            department_id: selectedDept.id,
            units: parseFloat(courseForm.units) || 1,
            semester: courseForm.semester || 'الكورس الأول'
          });
        if (error) throw error;
        showToast('نجاح', 'تم إضافة المادة الدراسية بنجاح', 'success');
      }
      setIsCourseModalOpen(false);
      setCourseForm({ id: null, name: '', stage_id: '', units: 1, semester: 'الكورس الأول' });
      fetchDeptCourses(selectedDept.id);
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حفظ المادة', 'danger');
    }
  };

  const deleteCourse = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف مادة "${name}"؟`)) return;
    try {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) throw error;
      showToast('نجاح', 'تم حذف المادة بنجاح', 'success');
      fetchDeptCourses(selectedDept.id);
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف المادة', 'danger');
    }
  };

  const handleDownloadCourses = () => {
    if (courses.length === 0) return;
    const exportData = courses.map(course => ({
      name: course.name,
      stage: course.stages?.name || '-',
      units: course.units || 1,
      semester: course.semester || 'الكورس الأول'
    }));
    const headers = [
      { key: 'name', label: 'اسم المادة' },
      { key: 'stage', label: 'المرحلة' },
      { key: 'units', label: 'عدد الوحدات' },
      { key: 'semester', label: 'الكورس الدراسي' }
    ];
    exportToExcel(exportData, headers, `مواد_قسم_${selectedDept.name}`);
  };

  const openEditCourse = (course) => {
    setCourseForm({
      id: course.id,
      name: course.name,
      stage_id: course.stage_id,
      units: course.units || 1,
      semester: course.semester || 'الكورس الأول'
    });
    setIsCourseModalOpen(true);
  };

  // ==========================================
  // CSV / Excel Import & Template Functions
  // ==========================================

  // تحميل نموذج استيراد المواد CSV بترميز UTF-8 BOM
  const downloadCoursesTemplate = () => {
    const deptName = selectedDept ? selectedDept.name : 'علوم الحاسوب';
    const csvContent = 
      'اسم المادة,المرحلة,عدد الوحدات,الكورس,القسم\n' +
      `هندسة البرمجيات,المرحلة الأولى,3,الكورس الأول,${deptName}\n` +
      `تراكيب البيانات,المرحلة الأولى,3,الكورس الأول,${deptName}\n` +
      `الذكاء الاصطناعي,المرحلة الثانية,4,الكورس الثاني,${deptName}\n` +
      `شبكات الحاسوب,المرحلة الثالثة,3,الكورس الأول,${deptName}\n` +
      `أمن المعلومات,المرحلة الرابعة,3,الكورس الثاني,${deptName}\n`;

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `نموذج_استيراد_مواد_${selectedDept ? selectedDept.name : 'رقيم'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // معالجة اختيار ملف Excel أو CSV
  const handleCoursesFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        parseCoursesRows(rows);
      } catch (err) {
        showToast('خطأ في قراءة الملف', 'فشل قراءة الملف المختار. تأكد من صحة ملف CSV أو Excel.', 'danger');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // مطابقة ذكية للمرحلة الدراسية
  const matchStage = (stageInput, stagesList) => {
    if (!stageInput) return stagesList[0] || null;
    const str = String(stageInput).trim();
    const normInput = normalizeArabic(str);

    // 1. مطابقة مباشرة بالمعرف أو الاسم الكامل
    const direct = stagesList.find(s => s.id === stageInput || normalizeArabic(s.name) === normInput);
    if (direct) return direct;

    // 2. مطابقة بالأرقام أو الكلمات
    if (str.includes('1') || normInput.includes('اول') || normInput.includes('first')) {
      return stagesList.find(s => s.name.includes('أولى') || s.name.includes('الاولى') || s.name.includes('1')) || stagesList[0];
    }
    if (str.includes('2') || normInput.includes('ثاني') || normInput.includes('second')) {
      return stagesList.find(s => s.name.includes('ثانية') || s.name.includes('الثانية') || s.name.includes('2')) || stagesList[1] || stagesList[0];
    }
    if (str.includes('3') || normInput.includes('ثالث') || normInput.includes('third')) {
      return stagesList.find(s => s.name.includes('ثالثة') || s.name.includes('الثالثة') || s.name.includes('3')) || stagesList[2] || stagesList[0];
    }
    if (str.includes('4') || normInput.includes('رابع') || normInput.includes('fourth')) {
      return stagesList.find(s => s.name.includes('رابعة') || s.name.includes('الرابعة') || s.name.includes('4')) || stagesList[3] || stagesList[0];
    }
    if (str.includes('5') || normInput.includes('خامس') || normInput.includes('fifth')) {
      return stagesList.find(s => s.name.includes('خامسة') || s.name.includes('الخامسة') || s.name.includes('5')) || stagesList[4] || stagesList[0];
    }
    return stagesList[0] || null;
  };

  // مطابقة ذكية للفصل الدراسي
  const matchSemester = (semesterInput) => {
    if (!semesterInput) return 'الكورس الأول';
    const norm = normalizeArabic(String(semesterInput));
    if (norm.includes('2') || norm.includes('ثاني') || norm.includes('second') || norm.includes('s2')) {
      return 'الكورس الثاني';
    }
    return 'الكورس الأول';
  };

  // تفسير ومعاينة صفوف المواد
  const parseCoursesRows = (rows) => {
    if (!rows || rows.length === 0) {
      showToast('تنبيه', 'الملف المختار فارغ.', 'warning');
      return;
    }

    const headerKeys = {
      name: ['name', 'course_name', 'subject', 'subject_name', 'اسم المادة', 'المادة', 'مادة', 'اسم الكورس', 'المادة الدراسية', 'اسم الماده'],
      stage: ['stage', 'stage_id', 'stage_name', 'المرحلة', 'المرحله', 'المرحلة الدراسية', 'مرحلة'],
      units: ['units', 'unit', 'credit_hours', 'credits', 'عدد الوحدات', 'الوحدات', 'وحدات', 'الساعات', 'النقاط'],
      semester: ['semester', 'term', 'course_term', 'الكورس', 'الفصل', 'الفصل الدراسي', 'الكورس الدراسي', 'الدور'],
      dept: ['department', 'dept', 'dept_name', 'القسم', 'القسم العلمي', 'قسم']
    };

    const findKey = (row, candidateKeys) => {
      const rowKeys = Object.keys(row);
      for (const k of candidateKeys) {
        const found = rowKeys.find(rk => normalizeArabic(rk) === normalizeArabic(k) || rk.trim().toLowerCase() === k.toLowerCase());
        if (found !== undefined) return found;
      }
      return null;
    };

    const sample = rows[0];
    const nameKey = findKey(sample, headerKeys.name);
    const stageKey = findKey(sample, headerKeys.stage);
    const unitsKey = findKey(sample, headerKeys.units);
    const semesterKey = findKey(sample, headerKeys.semester);
    const deptKey = findKey(sample, headerKeys.dept);

    if (!nameKey) {
      showToast('خطأ في التنسيق', 'لم يتم العثور على عمود "اسم المادة" في الملف.', 'danger');
      return;
    }

    const parsed = [];
    rows.forEach((row, idx) => {
      const rawName = String(row[nameKey] || '').trim();
      if (!rawName) return;

      const rawStage = stageKey ? row[stageKey] : '';
      const matchedStage = matchStage(rawStage, stages);

      const rawSemester = semesterKey ? row[semesterKey] : '';
      const semester = matchSemester(rawSemester);

      const rawUnits = unitsKey ? row[unitsKey] : '';
      const parsedUnits = parseFloat(rawUnits);
      const units = (!isNaN(parsedUnits) && parsedUnits > 0) ? parsedUnits : 1;

      const rawDept = deptKey ? String(row[deptKey] || '').trim() : '';
      let targetDept = selectedDept;
      if (rawDept) {
        const normRawDept = normalizeArabic(rawDept);
        const matchDept = departments.find(d => normalizeArabic(d.name) === normRawDept || normalizeArabic(d.name).includes(normRawDept));
        if (matchDept) targetDept = matchDept;
      }

      parsed.push({
        id: idx,
        name: rawName,
        stage_id: matchedStage?.id || null,
        stage_name: matchedStage?.name || 'المرحلة الأولى',
        units: units,
        semester: semester,
        department_id: targetDept?.id || selectedDept?.id || null,
        department_name: targetDept?.name || selectedDept?.name || 'القسم الافتراضي'
      });
    });

    if (parsed.length === 0) {
      showToast('تنبيه', 'لم يتم استخراج أي مواد صالحة من الملف.', 'warning');
      return;
    }

    setCsvPreview(parsed);
  };

  // تنفيذ استيراد المواد إلى قاعدة البيانات
  const executeCoursesImport = async () => {
    if (csvPreview.length === 0) return;
    setIsImporting(true);
    setImportProgress({ current: 0, total: csvPreview.length });

    try {
      // 1. جلب كافة المواد المسجلة حالياً بالكلية للمقارنة وتجنب التكرار غير المرغوب
      const { data: allExistingCourses, error: fetchErr } = await supabase
        .from('courses')
        .select('id, name, department_id, stage_id, semester, units')
        .in('department_id', departments.map(d => d.id));

      if (fetchErr) throw fetchErr;

      let insertedCount = 0;
      let updatedCount = 0;

      const toInsert = [];
      const toUpdate = [];

      csvPreview.forEach(item => {
        const normItemName = normalizeArabic(item.name);
        
        // البحث عن مادة تطابق الاسم والقسم والمرحلة والكورس
        const existing = (allExistingCourses || []).find(c => 
          c.department_id === item.department_id &&
          c.stage_id === item.stage_id &&
          c.semester === item.semester &&
          normalizeArabic(c.name) === normItemName
        );

        if (existing) {
          if (updateExisting) {
            toUpdate.push({
              id: existing.id,
              name: item.name,
              units: item.units,
              stage_id: item.stage_id,
              semester: item.semester,
              department_id: item.department_id
            });
          }
        } else {
          toInsert.push({
            name: item.name,
            department_id: item.department_id,
            stage_id: item.stage_id,
            units: item.units,
            semester: item.semester
          });
        }
      });

      // إدراج المواد الجديدة
      if (toInsert.length > 0) {
        // تجنب التكرار داخل نفس الدفعة المرفوعة
        const uniqueToInsert = [];
        const seenKeys = new Set();
        toInsert.forEach(row => {
          const key = `${row.department_id}_${row.stage_id}_${row.semester}_${normalizeArabic(row.name)}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueToInsert.push(row);
          }
        });

        const { error: insErr } = await supabase
          .from('courses')
          .insert(uniqueToInsert);
        if (insErr) throw insErr;
        insertedCount = uniqueToInsert.length;
      }

      // تحديث المواد القائمة إذا تم تفعيل الخيار
      if (toUpdate.length > 0 && updateExisting) {
        for (let i = 0; i < toUpdate.length; i++) {
          const u = toUpdate[i];
          await supabase
            .from('courses')
            .update({ units: u.units, name: u.name })
            .eq('id', u.id);
          updatedCount++;
          setImportProgress({ current: insertedCount + updatedCount, total: csvPreview.length });
        }
      }

      showToast('تم الاستيراد بنجاح ✅', `تم إضافة ${insertedCount} مادة جديدة وتحديث ${updatedCount} مادة مسبقة.`, 'success');
      setIsImportModalOpen(false);
      setCsvPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // إعادة تحميل المواد للقسم المختار
      if (selectedDept) {
        await fetchDeptCourses(selectedDept.id);
      }
    } catch (err) {
      showToast('خطأ في الاستيراد', err.message || 'حدث خطأ أثناء حفظ المواد في قاعدة البيانات', 'danger');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className={styles.adminLayout}>
      <CollegeAdminSidebar activePage="departments" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>إدارة الأقسام والمواد الدراسية</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              إدارة الهيكل الأكاديمي، وإضافة واستيراد المواد عبر ملفات Excel / CSV وربطها بنظام النتائج.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button onClick={() => { setDeptForm({ id: null, name: '' }); setIsDeptModalOpen(true); }}>
              <Plus size={18} />
              <span>إضافة قسم جديد</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' }}>
            <Skeleton height="300px" />
            <Skeleton height="300px" />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem', alignItems: 'start' }}>
            {/* الأقسام العلمية */}
            <div className={styles.glass} style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>الأقسام العلمية</h2>
                <Badge variant="info">{departments.length} أقسام</Badge>
              </div>
              {departments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  لا توجد أقسام مضافة. اضغط "إضافة قسم جديد" للبدء.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {departments.map(dept => (
                    <div 
                      key={dept.id} 
                      className={`${styles.navLink} ${selectedDept?.id === dept.id ? styles.navLinkActive : ''}`}
                      onClick={() => handleDeptSelect(dept)}
                      style={{ 
                        cursor: 'pointer', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                        <Folder size={18} />
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{dept.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }} onClick={e => e.stopPropagation()}>
                        <button 
                          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0.25rem' }}
                          onClick={() => { setDeptForm({ id: dept.id, name: dept.name }); setIsDeptModalOpen(true); }}
                          title="تعديل اسم القسم"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.25rem' }}
                          onClick={() => deleteDepartment(dept.id, dept.name)}
                          title="حذف القسم"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* المواد الدراسية في القسم المختار */}
            {selectedDept ? (
              <div className={styles.glass} style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)' }}>المواد الدراسية لقسم {selectedDept.name}</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>إدارة وتعيين المواد لكافة المراحل والكورسات الدراسية وربطها بالنتائج.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      onClick={downloadCoursesTemplate}
                      title="تحميل ملف CSV فارغ كنموذج جاهز لتعبئة المواد"
                    >
                      <FileSpreadsheet size={16} />
                      <span>نموذج CSV</span>
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      onClick={() => { setCsvPreview([]); setIsImportModalOpen(true); }}
                      title="استيراد قائمة مواد دفعة واحدة من ملف Excel أو CSV"
                      style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                    >
                      <Upload size={16} />
                      <span>استيراد مواد (CSV)</span>
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleDownloadCourses} disabled={courses.length === 0}>
                      <Download size={16} />
                      <span>تصدير المواد</span>
                    </Button>
                    <Button size="sm" onClick={() => { setCourseForm({ id: null, name: '', stage_id: stages[0]?.id || '', units: 1, semester: 'الكورس الأول' }); setIsCourseModalOpen(true); }}>
                      <PlusCircle size={16} />
                      <span>إضافة مادة</span>
                    </Button>
                  </div>
                </div>

                {courses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3.5rem 2rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
                    <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                    <p style={{ fontWeight: '600', marginBottom: '0.25rem' }}>لا توجد مواد مضافة لهذا القسم حتى الآن</p>
                    <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>يمكنك إضافة مادة يدوياً أو استيراد ملف CSV / Excel جاهز للمواد بكافة المراحل.</p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <Button size="sm" variant="secondary" onClick={() => { setCsvPreview([]); setIsImportModalOpen(true); }}>
                        <Upload size={16} />
                        <span>استيراد ملف المواد</span>
                      </Button>
                      <Button size="sm" onClick={() => { setCourseForm({ id: null, name: '', stage_id: stages[0]?.id || '', units: 1, semester: 'الكورس الأول' }); setIsCourseModalOpen(true); }}>
                        <Plus size={16} />
                        <span>إضافة مادة يدوياً</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className={compStyles.tableContainer}>
                    <Table>
                      <thead>
                        <Tr>
                          <Th>اسم المادة</Th>
                          <Th>المرحلة</Th>
                          <Th>عدد الوحدات</Th>
                          <Th>الكورس</Th>
                          <Th>العمليات</Th>
                        </Tr>
                      </thead>
                      <tbody>
                        {courses.map(course => (
                          <Tr key={course.id}>
                            <Td style={{ fontWeight: '600' }}>{course.name}</Td>
                            <Td>
                              <span style={{ 
                                display: 'inline-flex',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--accent)',
                                fontWeight: '600'
                              }}>
                                {course.stages?.name || '-'}
                              </span>
                            </Td>
                            <Td style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{course.units || 1}</Td>
                            <Td>
                              <span style={{ 
                                display: 'inline-flex',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                backgroundColor: course.semester === 'الكورس الثاني' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                color: course.semester === 'الكورس الثاني' ? '#10B981' : '#F59E0B',
                                fontWeight: '600'
                              }}>
                                {course.semester || 'الكورس الأول'}
                              </span>
                            </Td>
                            <Td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <Button size="icon" variant="secondary" onClick={() => openEditCourse(course)} title="تعديل المادة">
                                  <Edit size={14} />
                                </Button>
                                <Button size="icon" variant="danger" onClick={() => deleteCourse(course.id, course.name)} title="حذف المادة">
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
              </div>
            ) : (
              <div className={styles.glass} style={{ padding: '3rem', textAlign: 'center', borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)' }}>
                يرجى اختيار أو إضافة قسم لعرض وإدارة المواد التابعة له.
              </div>
            )}
          </div>
        )}

        {/* مودال القسم */}
        <Modal 
          isOpen={isDeptModalOpen} 
          onClose={() => setIsDeptModalOpen(false)} 
          title={deptForm.id ? 'تعديل قسم' : 'إضافة قسم جديد'}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setIsDeptModalOpen(false)}>إلغاء</Button>
              <Button type="submit" form="deptForm">حفظ القسم</Button>
            </>
          }
        >
          <form id="deptForm" onSubmit={saveDepartment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>اسم القسم</label>
              <input 
                type="text" 
                required
                className={compStyles.input}
                value={deptForm.name}
                onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder="علوم الحاسوب مثلاً"
              />
            </div>
          </form>
        </Modal>

        {/* مودال المادة الفردية */}
        <Modal 
          isOpen={isCourseModalOpen} 
          onClose={() => setIsCourseModalOpen(false)} 
          title={courseForm.id ? 'تعديل مادة' : 'إضافة مادة جديدة'}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setIsCourseModalOpen(false)}>إلغاء</Button>
              <Button type="submit" form="courseForm">حفظ المادة</Button>
            </>
          }
        >
          <form id="courseForm" onSubmit={saveCourse} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>اسم المادة</label>
              <input 
                type="text" 
                required
                className={compStyles.input}
                value={courseForm.name}
                onChange={e => setCourseForm({ ...courseForm, name: e.target.value })}
                placeholder="هندسة البرمجيات"
              />
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>المرحلة الدراسية</label>
              <select 
                className={compStyles.select}
                value={courseForm.stage_id}
                onChange={e => setCourseForm({ ...courseForm, stage_id: e.target.value })}
                required
              >
                <option value="">اختر المرحلة</option>
                {stages.map(st => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>عدد الوحدات (Units)</label>
              <input 
                type="number" 
                step="any"
                min="1"
                required
                className={compStyles.input}
                value={courseForm.units}
                onChange={e => setCourseForm({ ...courseForm, units: e.target.value })}
              />
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>الفصل الدراسي / الكورس</label>
               <select 
                 className={compStyles.select}
                 value={courseForm.semester}
                 onChange={e => setCourseForm({ ...courseForm, semester: e.target.value })}
                 required
               >
                 <option value="الكورس الأول">الكورس الأول</option>
                 <option value="الكورس الثاني">الكورس الثاني</option>
               </select>
            </div>
          </form>
        </Modal>

        {/* مودال استيراد المواد الجماعي (CSV / Excel) */}
        <Modal
          isOpen={isImportModalOpen}
          onClose={() => { if (!isImporting) { setIsImportModalOpen(false); setCsvPreview([]); } }}
          title="استيراد المواد الدراسية جماعياً (CSV / Excel)"
          maxWidth="850px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <Button variant="secondary" size="sm" onClick={downloadCoursesTemplate}>
                <Download size={14} />
                <span>تحميل النموذج التجريبي (CSV)</span>
              </Button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="secondary" onClick={() => { setIsImportModalOpen(false); setCsvPreview([]); }} disabled={isImporting}>
                  إلغاء
                </Button>
                <Button onClick={executeCoursesImport} disabled={csvPreview.length === 0 || isImporting}>
                  {isImporting ? `جاري الحفظ (${importProgress.current}/${importProgress.total})...` : `حفظ وتثبيت المواد (${csvPreview.length})`}
                </Button>
              </div>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <p style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                📋 تنسيق الأعمدة المدعومة في الملف (.csv أو .xlsx):
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div>🔹 <b>اسم المادة:</b> إجباري (مثل: هياكل البيانات)</div>
                <div>🔹 <b>المرحلة:</b> الأولى / الثانية / 1 / 2</div>
                <div>🔹 <b>عدد الوحدات:</b> رقم اختياري (افتراضي 1)</div>
                <div>🔹 <b>الكورس:</b> الكورس الأول / الكورس الثاني</div>
                <div>🔹 <b>القسم:</b> اسم القسم (اختياري)</div>
              </div>
            </div>

            {/* Dropzone File Upload */}
            <div 
              className={styles.dropzone}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              style={{ cursor: isImporting ? 'not-allowed' : 'pointer', padding: '2rem 1.5rem', marginBottom: 0 }}
            >
              <Upload size={36} className={styles.dropzoneIcon} />
              <div className={styles.dropzoneText}>
                <span>اضغط هنا لاختيار ملف المواد</span> أو اسحب الملف وأفلته هنا
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>الملفات المدعومة: CSV (.csv), Excel (.xlsx, .xls)</span>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".csv, .xlsx, .xls" 
                style={{ display: 'none' }} 
                onChange={handleCoursesFileChange}
                disabled={isImporting}
              />
            </div>

            {/* معاينة المواد المستخرجة */}
            {csvPreview.length > 0 && !isImporting && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    معاينة المواد المستوردة ({csvPreview.length} مادة):
                  </h4>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={updateExisting} 
                      onChange={e => setUpdateExisting(e.target.checked)} 
                    />
                    <span>تحديث المواد المتطابقة مسبقاً بنفس المرحلة والكورس</span>
                  </label>
                </div>

                <div className={compStyles.tableContainer} style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  <Table>
                    <thead>
                      <Tr>
                        <Th>#</Th>
                        <Th>اسم المادة</Th>
                        <Th>المرحلة</Th>
                        <Th>الوحدات</Th>
                        <Th>الكورس</Th>
                        <Th>القسم المستهدف</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((item, index) => (
                        <Tr key={index}>
                          <Td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{index + 1}</Td>
                          <Td style={{ fontWeight: '600' }}>{item.name}</Td>
                          <Td>
                            <span style={{ 
                              display: 'inline-flex',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              color: 'var(--accent)'
                            }}>
                              {item.stage_name}
                            </span>
                          </Td>
                          <Td style={{ fontWeight: 'bold' }}>{item.units}</Td>
                          <Td>
                            <span style={{ 
                              display: 'inline-flex',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              backgroundColor: item.semester === 'الكورس الثاني' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: item.semester === 'الكورس الثاني' ? '#10B981' : '#F59E0B'
                            }}>
                              {item.semester}
                            </span>
                          </Td>
                          <Td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.department_name}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            )}

            {/* مؤشر التقدم أثناء الرفع */}
            {isImporting && (
              <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--accent)' }}>
                  جاري معالجة وحفظ المواد في قاعدة البيانات... ({importProgress.current} / {importProgress.total})
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${importProgress.total ? (importProgress.current / importProgress.total) * 100 : 0}%`, 
                      height: '100%', 
                      backgroundColor: 'var(--accent)',
                      transition: 'width 0.2s ease'
                    }} 
                  />
                </div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
}
