import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Upload, 
  Send, 
  Download, 
  Search, 
  School,
  QrCode,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Table, Tr, Th, Td } from '../../components/ui/Table';
import { Skeleton } from '../../components/ui/Skeleton';
import { AdminSidebar } from './Dashboard';
import { generateAndUploadQRCard } from '../../lib/qrGenerator';
import styles from '../../styles/admin.module.css';
import compStyles from '../../styles/components.module.css';

export default function AdminStudents() {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  // States
  const [students, setStudents] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedUnivFilter, setSelectedUnivFilter] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState('');
  const [selectedTelegramFilter, setSelectedTelegramFilter] = useState('');
  const [selectedStudyTypeFilter, setSelectedStudyTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Import Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importUnivId, setImportUnivId] = useState('');
  const [csvPreview, setCsvPreview] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  // View QR Modal
  const [selectedQrStudent, setSelectedQrStudent] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedUnivFilter) {
      fetchDepartments(selectedUnivFilter);
    } else {
      setDepartments([]);
      setSelectedDeptFilter('');
    }
  }, [selectedUnivFilter]);

  useEffect(() => {
    fetchStudents();
  }, [selectedUnivFilter, selectedDeptFilter, selectedStageFilter]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // Fetch Universities
      const { data: univs } = await supabase
        .from('universities')
        .select('*')
        .order('name', { ascending: true });
      setUniversities(univs || []);

      // Fetch Stages
      const { data: stgs } = await supabase
        .from('stages')
        .select('*')
        .order('created_at', { ascending: true });
      setStages(stgs || []);

      await fetchStudents();
    } catch (err) {
      showToast('خطأ', 'فشل تحميل البيانات المبدئية', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async (univId) => {
    try {
      const { data } = await supabase
        .from('departments')
        .select('*')
        .eq('university_id', univId)
        .order('name', { ascending: true });
      setDepartments(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('students')
        .select('*, universities(name), departments(name), stages(name)')
        .order('created_at', { ascending: false });

      if (selectedUnivFilter) {
        query = query.eq('university_id', selectedUnivFilter);
      }
      if (selectedDeptFilter) {
        query = query.eq('department_id', selectedDeptFilter);
      }
      if (selectedStageFilter) {
        query = query.eq('stage_id', selectedStageFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      showToast('خطأ', 'فشل تحميل قائمة الطلاب', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // تحميل نموذج ملف استيراد الطلاب
  const downloadCSVTemplate = () => {
    const csvContent = "\uFEFF" + "الاسم الكامل,الرقم الجامعي,القسم,المرحلة,الدراسة\nمحمد علي أحمد,2023/CS/0101,علوم حاسوب,المرحلة الأولى,صباحي\nزينب عبد الرضا,2023/CS/0102,علوم حاسوب,المرحلة الأولى,مسائي";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "نموذج_استيراد_طلاب_رقيم.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV parsing logic
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
      if (lines.length === 0) return;

      const headerLine = lines[0].split(',');
      const cleanHeaders = headerLine.map(h => h.trim().replace(/(^["']|["']$)/g, ''));

      // مخرجات الأعمدة المسموح بها ومطابقتها للعربية
      const nameKey = cleanHeaders.findIndex(h => ['full_name', 'الاسم', 'الاسم الكامل'].includes(h));
      const numKey = cleanHeaders.findIndex(h => ['student_number', 'الرقم الجامعي', 'رقم الطالب'].includes(h));
      const deptKey = cleanHeaders.findIndex(h => ['department', 'القسم', 'الكلية'].includes(h));
      const stageKey = cleanHeaders.findIndex(h => ['stage', 'المرحلة'].includes(h));
      const studyTypeKey = cleanHeaders.findIndex(h => ['study_type', 'الدراسة', 'نوع الدراسة', 'صباحي/مسائي', 'الوقت'].includes(h));

      if (nameKey === -1 || numKey === -1 || deptKey === -1 || stageKey === -1) {
        throw new Error('الملف لا يحتوي على الأعمدة المطلوبة: (الاسم الكامل، الرقم الجامعي، القسم، المرحلة)');
      }

      const parsedRows = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // تقسيم السطر بناءً على الفواصل مع حماية الفراغات والاقتباسات
        const values = [];
        let currentToken = '';
        let inQuotes = false;
        
        for (let charIndex = 0; charIndex < line.length; charIndex++) {
          const char = line[charIndex];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentToken.trim().replace(/(^["']|["']$)/g, ''));
            currentToken = '';
          } else {
            currentToken += char;
          }
        }
        values.push(currentToken.trim().replace(/(^["']|["']$)/g, ''));

        // تحديد نوع الدراسة (صباحي كافتراضي)
        let studyType = 'صباحي';
        if (studyTypeKey !== -1 && values[studyTypeKey]) {
          const rawType = values[studyTypeKey].trim();
          if (rawType.includes('مساء') || rawType.includes('مسائي') || rawType.toLowerCase().includes('evening')) {
            studyType = 'مسائي';
          }
        }

        parsedRows.push({
          full_name: values[nameKey] || '',
          student_number: values[numKey] || '',
          department: values[deptKey] || '',
          stage: values[stageKey] || '',
          study_type: studyType
        });
      }

      if (parsedRows.length === 0) {
        throw new Error('الملف فارغ أو غير صالح');
      }

      setCsvPreview(parsedRows);
    } catch (err) {
      showToast('خطأ في قراءة الملف', err.message, 'danger');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Process the CSV import: find/create departments/stages, generate QR canvas, upload to Storage
  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importUnivId || csvPreview.length === 0) return;

    setIsImporting(true);
    setImportProgress({ current: 0, total: csvPreview.length });

    try {
      const selectedUniv = universities.find(u => u.id === importUnivId);
      const univName = selectedUniv?.name || 'جامعة رقيم';

      // 1. جلب المراحل الحالية لتفادي تكرار الاستعلامات
      const { data: dbStages } = await supabase.from('stages').select('*');
      
      // 2. جلب الأقسام الحالية لهذه الجامعة
      const { data: dbDepts } = await supabase
        .from('departments')
        .select('*')
        .eq('university_id', importUnivId);
      
      const departmentsMap = new Map(dbDepts?.map(d => [d.name.trim(), d.id]) || []);

      // أ. التحقق من الأقسام غير الموجودة وإضافتها جملة واحدة
      const uniqueDeptNames = [...new Set(csvPreview.map(s => s.department.trim()))];
      const missingDepts = uniqueDeptNames.filter(name => !departmentsMap.has(name));

      if (missingDepts.length > 0) {
        const { data: newDepts, error: dErr } = await supabase
          .from('departments')
          .insert(missingDepts.map(name => ({ name, university_id: importUnivId })))
          .select();

        if (dErr) throw dErr;
        newDepts?.forEach(d => {
          departmentsMap.set(d.name.trim(), d.id);
        });
      }

      // ب. تصفية الطلاب المكررين مسبقاً في قاعدة البيانات
      const studentNumbers = csvPreview.map(s => s.student_number.trim());
      const { data: existingStudents, error: existErr } = await supabase
        .from('students')
        .select('student_number')
        .in('student_number', studentNumbers);

      if (existErr) throw existErr;
      const existingNumbersSet = new Set(existingStudents?.map(s => s.student_number) || []);

      const newStudentsToProcess = csvPreview.filter(s => !existingNumbersSet.has(s.student_number.trim()));

      if (newStudentsToProcess.length === 0) {
        showToast('تنبيه ⚠️', 'جميع الطلاب في هذا الملف مسجلين مسبقاً بقاعدة البيانات.', 'warning');
        setIsImportModalOpen(false);
        setCsvPreview([]);
        setImportUnivId('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // ج. تحضير بيانات الطلاب وتحديد مسار رابط الـ QR وحسابه تلقائياً
      const studentsToInsert = [];

      newStudentsToProcess.forEach(studentRow => {
        const studentId = crypto.randomUUID();
        const qrToken = crypto.randomUUID();
        
        const deptId = departmentsMap.get(studentRow.department.trim());
        
        let stage = dbStages?.find(s => s.name.trim() === studentRow.stage.trim());
        if (!stage) {
          stage = dbStages?.find(s => s.name.includes('الأولى')) || dbStages[0];
        }
        const stageId = stage?.id;

        // حساب الرابط بشكل قطعي دون إرسال طلب سوبابيس (توفيراً للوقت والاتصال)
        const path = `${importUnivId}/${studentId}.png`;
        const { data: { publicUrl } } = supabase.storage.from('qr-cards').getPublicUrl(path);

        const newStudent = {
          id: studentId,
          university_id: importUnivId,
          department_id: deptId,
          stage_id: stageId,
          full_name: studentRow.full_name.trim(),
          student_number: studentRow.student_number.trim(),
          qr_token: qrToken,
          qr_image_url: publicUrl,
          study_type: studentRow.study_type
        };

        studentsToInsert.push(newStudent);
      });

      // د. إدخال جماعي (Bulk Insert) لكافة الطلاب بدفعة واحدة
      const { error: insertErr } = await supabase
        .from('students')
        .insert(studentsToInsert);

      if (insertErr) throw insertErr;

      // هـ. توليد ورفع صور الـ QR على خادم سوبابيس على دفعات متوازية (Parallel Chunks)
      const batchSize = 6; // معالجة 6 طلاب متوازيين بكل دفعة لسرعة الاستجابة ومنع تجميد المتصفح
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

      showToast('نجاح الاستيراد', `تم استيراد ${studentsToInsert.length} طالب جديد وتوليد بطاقات الـ QR الخاصة بهم بنجاح وسرعة فائقة.`, 'success');
      setIsImportModalOpen(false);
      setCsvPreview([]);
      setImportUnivId('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchStudents();
    } catch (err) {
      showToast('فشل الاستيراد', err.message || 'حدث خطأ أثناء عملية الاستيراد السريعة', 'danger');
    } finally {
      setIsImporting(false);
    }
  };

  // Trigger QR Card Resend via Telegram bot
  const triggerTelegramResend = async (student) => {
    if (!student.telegram_chat_id) {
      showToast(
        'البوت غير مفعل للطالب ⚠️', 
        'لم يقم الطالب بتسجيل حسابه على البوت بعد. يجب على الطالب إرسال رقمه الجامعي للبوت أولاً.', 
        'warning',
        6000
      );
      return;
    }

    try {
      showToast('جاري الطلب', 'يتم إرسال طلب البطاقة للبوت الآن...', 'info');

      // إدراج طلب إعادة إرسال في الجدول ليستمع له البوت فوراً
      const { error } = await supabase
        .from('telegram_resend_requests')
        .insert({ student_id: student.id });

      if (error) throw error;
      showToast('تم إرسال الطلب ✅', 'سيرسل البوت بطاقة الحضور للطالب على تيليجرام فوراً.', 'success');
    } catch (err) {
      showToast('خطأ', 'فشل إرسال طلب إعادة الإرسال', 'danger');
    }
  };

  const handleDeleteStudent = async (student) => {
    if (!window.confirm(`هل أنت متأكد من حذف الطالب "${student.full_name}"؟ سيتم حذف بطاقته من التخزين وسجل حضوره بالكامل!`)) return;
    try {
      // 1. حذف صورة البطاقة من Supabase Storage
      const path = `${student.university_id}/${student.id}.png`;
      await supabase.storage.from('qr-cards').remove([path]);

      // 2. حذف الطالب من قاعدة البيانات (الحذف متتالي للـ cascade)
      const { error } = await supabase.from('students').delete().eq('id', student.id);
      if (error) throw error;

      showToast('نجاح', 'تم حذف الطالب وبطاقته بنجاح', 'success');
      fetchStudents();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف الطالب', 'danger');
    }
  };

  const handleDeleteAllStudents = async () => {
    if (filteredStudents.length === 0) {
      showToast('تنبيه', 'لا يوجد طلاب لحذفهم حالياً في القائمة.', 'warning');
      return;
    }

    if (!window.confirm(`🚨 تحذير: هل أنت متأكد من حذف جميع الطلاب المعروضين حالياً (${filteredStudents.length} طالب)؟ سيتم مسح كروت الـ QR وسجلات حضورهم نهائياً!`)) return;
    if (!window.confirm('⚠️ تأكيد نهائي: هل أنت متأكد فعلاً؟ لا يمكن التراجع عن هذه العملية.')) return;

    setLoading(true);
    try {
      // 1. حذف كروت الـ QR من التخزين (Storage) للطلاب المعروضين فقط
      const paths = filteredStudents.map(s => `${s.university_id}/${s.id}.png`);
      const batchSize = 50;
      for (let i = 0; i < paths.length; i += batchSize) {
        const batch = paths.slice(i, i + batchSize);
        await supabase.storage.from('qr-cards').remove(batch);
      }

      // 2. حذف الطلاب من قاعدة البيانات
      const ids = filteredStudents.map(s => s.id);
      const { error } = await supabase
        .from('students')
        .delete()
        .in('id', ids);

      if (error) throw error;

      showToast('نجاح الحذف 🗑️', `تم حذف ${ids.length} طالب وإزالة بطاقات حضورهم بالكامل.`, 'success');
      fetchStudents();
    } catch (err) {
      showToast('خطأ في الحذف', err.message || 'فشل حذف الطلاب المعروضين', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // إلغاء ربط حساب التيليجرام وإعادة الكارت للوضع السحابي الافتراضي
  const handleUnlinkTelegram = async (student) => {
    if (!window.confirm(`هل أنت متأكد من إلغاء ربط حساب التيليجرام الخاص بالطالب "${student.full_name}"؟ سيتم مسح الكود المفعل من تيليجرام وإعادة توليد بطاقة حضور سحابية جديدة له لتفعيلها لاحقاً.`)) return;
    
    try {
      setLoading(true);
      // 1. إعادة توليد كارت الحضور ورفعه لـ Storage
      const univName = student.universities?.name || 'جامعة رقيم';
      const newQrUrl = await generateAndUploadQRCard(student, univName);

      // 2. تحديث الحساب في قاعدة البيانات: إزالة المعرفات السابقة وإعادة تعيين رابط الكارت
      const { error } = await supabase
        .from('students')
        .update({
          telegram_chat_id: null,
          telegram_file_id: null,
          qr_image_url: newQrUrl
        })
        .eq('id', student.id);

      if (error) throw error;

      showToast('تم إلغاء الربط 🔓', 'تم إلغاء ربط الحساب وتصفير بطاقة الحضور للمستوى الافتراضي بنجاح.', 'success');
      await fetchStudents();
    } catch (err) {
      showToast('خطأ في العملية', err.message || 'فشل إلغاء ربط حساب الطالب', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.student_number.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (selectedTelegramFilter === 'activated') {
      if (!student.telegram_chat_id) return false;
    } else if (selectedTelegramFilter === 'not_activated') {
      if (student.telegram_chat_id) return false;
    }
    
    if (selectedStudyTypeFilter) {
      if (student.study_type !== selectedStudyTypeFilter) return false;
    }
    
    return true;
  });

  return (
    <div className={styles.adminLayout}>
      <AdminSidebar activePage="students" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>إدارة الطلاب وبطاقات الحضور</h1>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {filteredStudents.length > 0 && (
              <Button 
                variant="danger" 
                onClick={handleDeleteAllStudents}
                icon={Trash2}
              >
                حذف الطلاب المعروضين ({filteredStudents.length})
              </Button>
            )}
            <Button 
              onClick={() => setIsImportModalOpen(true)} 
              icon={Upload}
            >
              استيراد ملف الطلاب (Excel/CSV)
            </Button>
          </div>
        </div>

        {/* قسم الإحصائيات الذكية لإدارة تيليجرام والتخزين */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
              <School size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>إجمالي الطلاب المسجلين</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.25rem' }}>{students.length} طالب</div>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
              <Send size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>تفعيل البوت (تيليجرام)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.25rem' }}>
                {students.filter(s => s.telegram_chat_id).length} ({students.length > 0 ? Math.round((students.filter(s => s.telegram_chat_id).length / students.length) * 100) : 0}%)
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
              <QrCode size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>التخزين السحابي الموفر</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.25rem', color: 'var(--success)' }}>
                {(students.filter(s => s.telegram_chat_id).length * 0.2).toFixed(1)} MB مـوفّـرة
              </div>
            </div>
          </div>
        </div>

        {/* أدوات التصفية والبحث */}
        <div className={styles.toolbar} style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div className={compStyles.inputGroup} style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
            <label className={compStyles.label}>بحث بالاسم أو الرقم الجامعي</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                className={compStyles.input}
                placeholder="ابحث هنا..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingRight: '2.5rem' }}
              />
              <Search size={18} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className={compStyles.inputGroup} style={{ width: '200px', marginBottom: 0 }}>
            <label className={compStyles.label}>الجامعة</label>
            <select
              className={compStyles.select}
              value={selectedUnivFilter}
              onChange={e => setSelectedUnivFilter(e.target.value)}
            >
              <option value="">كل الجامعات</option>
              {universities.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className={compStyles.inputGroup} style={{ width: '200px', marginBottom: 0 }}>
            <label className={compStyles.label}>القسم / الكلية</label>
            <select
              disabled={!selectedUnivFilter}
              className={compStyles.select}
              value={selectedDeptFilter}
              onChange={e => setSelectedDeptFilter(e.target.value)}
            >
              <option value="">كل الأقسام</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className={compStyles.inputGroup} style={{ width: '200px', marginBottom: 0 }}>
            <label className={compStyles.label}>المرحلة</label>
            <select
              className={compStyles.select}
              value={selectedStageFilter}
              onChange={e => setSelectedStageFilter(e.target.value)}
            >
              <option value="">كل المراحل</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className={compStyles.inputGroup} style={{ width: '180px', marginBottom: 0 }}>
            <label className={compStyles.label}>حالة تفعيل تيليجرام</label>
            <select
              className={compStyles.select}
              value={selectedTelegramFilter}
              onChange={e => setSelectedTelegramFilter(e.target.value)}
            >
              <option value="">الكل</option>
              <option value="activated">مسجل ومفعل ✅</option>
              <option value="not_activated">غير مفعل ❌</option>
            </select>
          </div>

          <div className={compStyles.inputGroup} style={{ width: '150px', marginBottom: 0 }}>
            <label className={compStyles.label}>نوع الدراسة</label>
            <select
              className={compStyles.select}
              value={selectedStudyTypeFilter}
              onChange={e => setSelectedStudyTypeFilter(e.target.value)}
            >
              <option value="">الكل</option>
              <option value="صباحي">صباحي ☀️</option>
              <option value="مسائي">مسائي 🌙</option>
            </select>
          </div>
        </div>

        {/* جدول عرض الطلاب */}
        <div style={{ marginTop: '1.5rem' }}>
          {loading ? (
            <Skeleton height="350px" />
          ) : (
            <Table>
              <thead>
                <Tr>
                  <Th>اسم الطالب</Th>
                  <Th>الرقم الجامعي</Th>
                  <Th>الجامعة</Th>
                  <Th>القسم</Th>
                  <Th>المرحلة</Th>
                  <Th style={{ width: '90px' }}>الدراسة</Th>
                  <Th>تفعيل البوت</Th>
                  <Th style={{ width: '120px' }}>البطاقة QR</Th>
                  <Th style={{ width: '80px' }}>حذف</Th>
                </Tr>
              </thead>
              <tbody>
                {filteredStudents.map(student => (
                  <Tr key={student.id}>
                    <Td style={{ fontWeight: 'bold' }}>{student.full_name}</Td>
                    <Td style={{ fontFamily: 'monospace' }}>{student.student_number}</Td>
                    <Td>{student.universities?.name || '-'}</Td>
                    <Td>{student.departments?.name || '-'}</Td>
                    <Td>{student.stages?.name || '-'}</Td>
                    <Td>
                      <Badge 
                        variant={student.study_type === 'مسائي' ? 'warning' : 'info'}
                        style={student.study_type === 'مسائي' ? { backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.2)' } : {}}
                      >
                        {student.study_type === 'مسائي' ? 'مسائي 🌙' : 'صباحي ☀️'}
                      </Badge>
                    </Td>
                    <Td>
                      {student.telegram_chat_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Badge variant="success">مسجل ومفعل ✅</Badge>
                          <button
                            onClick={() => handleUnlinkTelegram(student)}
                            className={`${compStyles.btn} ${compStyles.btnOutline}`}
                            style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)', cursor: 'pointer' }}
                            title="إلغاء ربط حساب تيليجرام وإعادة توليد كارت حضور جديد له"
                          >
                            إلغاء الربط
                          </button>
                        </div>
                      ) : (
                        <Badge variant="warning">غير مفعل ❌</Badge>
                      )}
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => setSelectedQrStudent(student)}
                          className={`${compStyles.btn} ${compStyles.btnOutline}`}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        >
                          <QrCode size={14} style={{ marginLeft: '0.25rem' }} />
                          عرض
                        </button>
                        <button
                          onClick={() => triggerTelegramResend(student)}
                          disabled={!student.telegram_chat_id}
                          className={`${compStyles.btn} ${compStyles.btnSecondary}`}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          title="إعادة إرسال الكارت عبر البوت للطالب"
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </Td>
                    <Td>
                      <button
                        onClick={() => handleDeleteStudent(student)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </Td>
                  </Tr>
                ))}
                {filteredStudents.length === 0 && (
                  <Tr>
                    <Td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                      لم يتم العثور على أي طلاب مطابقين لشروط البحث.
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          )}
        </div>
      </div>

      {/* مودال استيراد الطلاب */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => !isImporting && setIsImportModalOpen(false)}
        title="استيراد كشف أسماء الطلاب"
      >
        {isImporting ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--accent)' }}>
              جاري توليد ورفع بطاقات الحضور...
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
              <div 
                style={{ 
                  height: '100%', 
                  backgroundColor: 'var(--accent)', 
                  width: `${(importProgress.current / importProgress.total) * 100}%`,
                  transition: 'width 0.2s ease-out'
                }} 
              />
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              معالجة الطالب {importProgress.current} من أصل {importProgress.total}...
            </div>
          </div>
        ) : (
          <form onSubmit={handleImportSubmit}>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>الجامعة المنسوب لها الطلاب</label>
              <select
                required
                className={compStyles.select}
                value={importUnivId}
                onChange={e => setImportUnivId(e.target.value)}
              >
                <option value="">اختر الجامعة</option>
                {universities.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.dropzone} onClick={() => fileInputRef.current?.click()}>
              <Upload size={32} className={styles.dropzoneIcon} />
              <div className={styles.dropzoneText}>
                اضغط هنا لرفع ملف <span>Excel/CSV</span> الخاص بالطلاب
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                يجب أن يحتوي الملف على الأعمدة التالية: الاسم الكامل، الرقم الجامعي، القسم، المرحلة
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', marginBottom: '1.5rem', padding: '0 0.25rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>أو قم بالبدء مباشرة باستخدام نموذج جاهز:</span>
              <button
                type="button"
                onClick={downloadCSVTemplate}
                className={`${compStyles.btn} ${compStyles.btnOutline}`}
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}
              >
                <Download size={14} />
                تحميل النموذج الفارغ
              </button>
            </div>

            {csvPreview.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--success)' }}>
                  معاينة الملف: تم العثور على ({csvPreview.length}) طالب جاهز للاستيراد.
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem', fontSize: '0.8rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '0.25rem' }}>الاسم</th>
                        <th style={{ padding: '0.25rem' }}>الرقم الجامعي</th>
                        <th style={{ padding: '0.25rem' }}>القسم</th>
                        <th style={{ padding: '0.25rem' }}>المرحلة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 5).map((row, idx) => (
                        <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.25rem' }}>{row.full_name}</td>
                          <td style={{ padding: '0.25rem' }}>{row.student_number}</td>
                          <td style={{ padding: '0.25rem' }}>{row.department}</td>
                          <td style={{ padding: '0.25rem' }}>{row.stage}</td>
                        </tr>
                      ))}
                      {csvPreview.length > 5 && (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '0.5rem' }}>
                            وغيرهم من الطلاب...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <Button variant="secondary" onClick={() => setIsImportModalOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={!importUnivId || csvPreview.length === 0}>
                بدء الاستيراد وتوليد البطاقات
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* مودال عرض بطاقة الـ QR لطالب */}
      <Modal
        isOpen={!!selectedQrStudent}
        onClose={() => setSelectedQrStudent(null)}
        title={`بطاقة الحضور: ${selectedQrStudent?.full_name}`}
      >
        {selectedQrStudent && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
            {selectedQrStudent.qr_image_url ? (
              <>
                <img 
                  src={selectedQrStudent.qr_image_url} 
                  alt={`بطاقة حضور ${selectedQrStudent.full_name}`}
                  style={{ width: '280px', height: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)' }}
                />
                <a 
                  href={selectedQrStudent.qr_image_url} 
                  download={`Raqim_${selectedQrStudent.student_number}.png`}
                  className={`${compStyles.btn} ${compStyles.btnPrimary}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download size={16} />
                  تحميل كرت الحضور
                </a>
              </>
            ) : selectedQrStudent.telegram_file_id ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', border: '1px dashed var(--success)', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(16, 185, 129, 0.05)', maxWidth: '320px' }}>
                <CheckCircle size={44} style={{ color: 'var(--success)', marginBottom: '0.75rem' }} />
                <h4 style={{ fontWeight: 'bold', color: 'var(--success)', marginBottom: '0.5rem' }}>تم التفعيل والاستلام بنجاح</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  لقد استلم الطالب بطاقته وربط حسابه بالتيليجرام. تم إخلاء مساحة التخزين السحابي لتوفير مساحة الاستضافة، ويمكن للطالب طلب كود الحضور الخاص به في أي وقت من البوت مباشرة.
                </p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <AlertCircle size={40} style={{ color: 'var(--warning)', marginBottom: '0.5rem' }} />
                <p>لم يتم توليد بطاقة الحضور لهذا الطالب بعد، أو لم يتم رفعها بنجاح.</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setSelectedQrStudent(null)}>إغلاق</Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
