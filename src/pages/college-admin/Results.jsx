import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit, FileText, Upload, Download, RefreshCw, CheckCircle, AlertTriangle, FileArchive, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Table, Tr, Th, Td } from '../../components/ui/Table';
import { Skeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import { computeOverallGrade, computeIsPassed } from '../../lib/gradeUtils';
import { generateCertificatePDF } from '../../lib/certificateGenerator';
import { CollegeAdminSidebar } from './Dashboard';
import styles from '../../styles/admin.module.css';
import compStyles from '../../styles/components.module.css';
import { useAuth } from '../../hooks/useAuth';

export default function CollegeAdminResults() {
  const { showToast } = useToast();
  const { adminDetails, user } = useAuth();
  const fileInputRef = useRef(null);

  // Lists
  const [departments, setDepartments] = useState([]);
  const [stages, setStages] = useState([]);
  const [gradeScales, setGradeScales] = useState([]);
  
  // Filtering & Selection
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data States
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Preview / Progress States
  const [resultsPreview, setResultsPreview] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadStatusMsg, setUploadStatusMsg] = useState('جاري رفع وتدقيق السجلات في قاعدة البيانات...');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ current: 0, total: 0 });

  // Edit / Form states
  const [editForm, setEditForm] = useState({ id: null, score: '', grade_label: '', student_name: '', course_name: '' });

  // Academic years list helper
  const academicYears = ['2023/2024', '2024/2025', '2025/2026', '2026/2027'];

  useEffect(() => {
    if (adminDetails?.college_id) {
      fetchInitialData();
    }
  }, [adminDetails]);

  useEffect(() => {
    if (adminDetails?.college_id) {
      fetchResults();
    }
  }, [adminDetails, selectedDept, selectedStage, selectedYear]);

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

      // Fetch Grade Scales
      const { data: scales } = await supabase
        .from('grade_scales')
        .select('*');
      setGradeScales(scales || []);

      setSelectedYear(''); // Default: جميع السنوات الدراسية

    } catch (err) {
      showToast('خطأ', 'فشل تحميل بيانات التهيئة', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    try {
      setLoading(true);
      
      // نبني استعلام لجلب النتائج
      let query = supabase
        .from('results')
        .select('*, students!inner(id, full_name, student_number, department_id, stage_id), courses(name)')
        .eq('students.college_id', adminDetails.college_id);

      if (selectedDept) query = query.eq('students.department_id', selectedDept);
      if (selectedStage) query = query.eq('students.stage_id', selectedStage);
      if (selectedYear) query = query.eq('academic_year', selectedYear);

      const { data, error } = await query;
      if (error) throw error;
      setResults(data || []);
    } catch (err) {
      showToast('خطأ', 'فشل تحميل كشف النتائج', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Excel / CSV Parse for Results Upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        setResultsPreview(rows);
      } catch (err) {
        showToast('خطأ', 'فشل قراءة وتفسير ملف الدرجات المختار.', 'danger');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // توليد تلقائي للشهادات بعد الرفع أو التعديل
  const autoGenerateCertificates = async (studentIds, academicYear, onProgress) => {
    if (!studentIds || studentIds.length === 0) return;
    try {
      const { data: collegeData } = await supabase
        .from('colleges')
        .select('name, university, logo_url, university_logo_url')
        .eq('id', adminDetails.college_id)
        .single();
      const college = collegeData;
      const university = { name: collegeData?.university || 'رقيم حضور' };
      const collegeLogoUrl = collegeData?.logo_url || null;
      const universityLogoUrl = collegeData?.university_logo_url || null;

      const { data: studentDetails } = await supabase
        .from('students')
        .select('id, full_name, student_number, department_id, stage_id, departments(name)')
        .in('id', studentIds);

      if (!studentDetails || studentDetails.length === 0) return;

      const { data: allStudentResults } = await supabase
        .from('results')
        .select('*, courses(name, units)')
        .in('student_id', studentIds)
        .eq('academic_year', academicYear);

      if (!allStudentResults || allStudentResults.length === 0) return;

      let current = 0;
      for (const student of studentDetails) {
        const studentResults = allStudentResults.filter(r => r.student_id === student.id);
        if (studentResults.length === 0) {
          current++;
          if (onProgress) onProgress(current, studentDetails.length);
          continue;
        }

        const overallGrade = computeOverallGrade(studentResults);
        const isPassed = computeIsPassed(studentResults);

        const pdfBlob = await generateCertificatePDF({
          student,
          results: studentResults,
          overallGrade,
          isPassed,
          academicYear,
          university,
          college,
          department: student.departments,
          universityLogoUrl,
          collegeLogoUrl,
        });

        const path = `${student.id}/${academicYear.replace('/', '_')}.pdf`;
        const { error: uploadErr } = await supabase.storage
          .from('certificates')
          .upload(path, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (uploadErr) {
          console.error(`Error uploading certificate for student ${student.id}:`, uploadErr);
          throw uploadErr;
        }

        const { data: { publicUrl } } = supabase.storage.from('certificates').getPublicUrl(path);

        await supabase
          .from('certificates')
          .upsert({
            student_id: student.id,
            academic_year: academicYear,
            overall_grade: overallGrade,
            is_passed: isPassed,
            pdf_url: publicUrl,
            generated_by: user?.id
          }, { onConflict: 'student_id,academic_year' });

        current++;
        if (onProgress) onProgress(current, studentDetails.length);
      }
    } catch (err) {
      console.error('Error auto generating certificates:', err);
    }
  };

  const executeUpload = async () => {
    if (resultsPreview.length === 0) return;
    setIsUploading(true);
    setUploadStatusMsg('جاري رفع وتدقيق السجلات في قاعدة البيانات...');
    setUploadProgress({ current: 0, total: 0 });

    try {
      // 1. جلب كافة طلاب وأقسام الكلية للتحقق السريع
      const { data: allStudents } = await supabase
        .from('students')
        .select('id, student_number')
        .eq('college_id', adminDetails.college_id);

      const { data: allCourses } = await supabase
        .from('courses')
        .select('id, name, department_id, departments!inner(college_id)')
        .eq('departments.college_id', adminDetails.college_id);

      const studentsMap = new Map(allStudents.map(s => [s.student_number.trim(), s.id]));
      const coursesMap = new Map(allCourses.map(c => [c.name.trim().toLowerCase(), c.id]));

      const resultsToInsert = [];

      // المفاتيح الثابتة لاستبعادها عند البحث عن المواد
      const fixedKeys = [
        'student_number', 'الرقم الجامعي', 'الرقم',
        'academic_year', 'السنة الدراسية', 'العام الدراسي', 'السنة',
        'full_name', 'الاسم الكامل', 'الاسم', 'اسم الطالب', 'الاسم الثلاثي'
      ];

      resultsPreview.forEach((row, idx) => {
        const studNum = String(
          row.student_number || 
          row['الرقم الجامعي'] || 
          row['الرقم'] || 
          ''
        ).trim();

        const year = String(
          row.academic_year || 
          row['السنة الدراسية'] || 
          row['العام الدراسي'] || 
          row['السنة'] || 
          selectedYear ||
          '2024/2025'
        ).trim();

        const studentId = studentsMap.get(studNum);
        if (!studentId) return;

        // المرور على كافة الأعمدة المتبقية والتي تمثل المواد
        Object.keys(row).forEach(key => {
          if (fixedKeys.includes(key)) return;

          const courseNameClean = key.trim().toLowerCase();
          const courseId = coursesMap.get(courseNameClean);

          if (!courseId) return; // المادة غير مسجلة بالقسم

          const cellValue = String(row[key] || '').trim();
          if (!cellValue) return; // فارغ، نتخطى المادة للطالب الحالي

          let score = parseFloat(cellValue);
          let gradeLabel = '';

          if (isNaN(score)) {
            // القيمة عبارة عن تقدير (مثل: مقبول)
            gradeLabel = cellValue;
            const defaultScores = {
              'امتياز': 95,
              'جيد جداً': 85,
              'جيد': 75,
              'متوسط': 65,
              'مقبول': 55,
              'ضعيف': 45
            };
            score = defaultScores[gradeLabel] || 55;
          } else {
            // القيمة رقمية
            const scale = gradeScales.find(s => score >= s.min_score && score <= s.max_score);
            gradeLabel = scale ? scale.label : 'مقبول';
          }

          resultsToInsert.push({
            student_id: studentId,
            course_id: courseId,
            academic_year: year,
            score: score,
            grade_label: gradeLabel
          });
        });
      });

      if (resultsToInsert.length === 0) {
        throw new Error('لا توجد سجلات مطابقة للطلاب والمواد في الكلية.');
      }

      // إدخال جماعي مع التحديث في حال التكرار (Upsert)
      const { error: upsertErr } = await supabase
        .from('results')
        .upsert(resultsToInsert, { onConflict: 'student_id,course_id,academic_year' });

      if (upsertErr) throw upsertErr;

      // التوليد التلقائي للشهادات للطلاب المتأثرين بالرفع
      const uniqueStudentIds = Array.from(new Set(resultsToInsert.map(r => r.student_id)));
      const uploadYear = resultsToInsert[0]?.academic_year || '2024/2025';

      setUploadStatusMsg('جاري توليد ورفع شهادات PDF للطلاب...');
      setUploadProgress({ current: 0, total: uniqueStudentIds.length });

      await autoGenerateCertificates(uniqueStudentIds, uploadYear, (current, total) => {
        setUploadProgress({ current, total });
      });

      showToast('تم الرفع بنجاح ✅', `تم معالجة وإدخال ${resultsToInsert.length} نتيجة وتوليد ${uniqueStudentIds.length} شهادة PDF بنجاح.`, 'success');
      setIsUploadModalOpen(false);
      setResultsPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchResults();
    } catch (err) {
      showToast('خطأ في الرفع', err.message || 'حدث خطأ أثناء معالجة النتائج', 'danger');
    } finally {
      setIsUploading(false);
      setUploadStatusMsg('جاري رفع وتدقيق السجلات في قاعدة البيانات...');
    }
  };

  const handleGradeSelectChange = (e) => {
    const label = e.target.value;
    if (!label) return;
    
    const defaultScores = {
      'امتياز': 95,
      'جيد جداً': 85,
      'جيد': 75,
      'متوسط': 65,
      'مقبول': 55,
      'ضعيف': 45
    };
    setEditForm(prev => ({
      ...prev,
      grade_label: label,
      score: defaultScores[label] || prev.score
    }));
  };

  const handleScoreChange = (e) => {
    const scoreVal = e.target.value;
    const scoreNum = parseFloat(scoreVal);
    let label = editForm.grade_label;
    if (!isNaN(scoreNum)) {
      const scale = gradeScales.find(s => scoreNum >= s.min_score && scoreNum <= s.max_score);
      if (scale) label = scale.label;
    }
    setEditForm(prev => ({
      ...prev,
      score: scoreVal,
      grade_label: label
    }));
  };

  const handleEditResult = (res) => {
    setEditForm({
      id: res.id,
      score: res.score,
      grade_label: res.grade_label,
      student_name: res.students?.full_name,
      course_name: res.courses?.name
    });
    setIsEditModalOpen(true);
  };

  const saveEditedResult = async (e) => {
    e.preventDefault();
    try {
      const score = parseFloat(editForm.score);
      const scale = gradeScales.find(s => score >= s.min_score && score <= s.max_score);
      const label = scale ? scale.label : editForm.grade_label;

      const { error } = await supabase
        .from('results')
        .update({ score: score, grade_label: label })
        .eq('id', editForm.id);

      if (error) throw error;
      showToast('تم التحديث', 'تم حفظ التعديلات بنجاح وجاري تحديث الشهادة تلقائياً.', 'success');
      setIsEditModalOpen(false);
      fetchResults();

      // التحديث التلقائي للشهادة الخاصة بالطالب
      const currentResult = results.find(r => r.id === editForm.id);
      if (currentResult) {
        autoGenerateCertificates([currentResult.student_id], currentResult.academic_year);
      }
    } catch (err) {
      showToast('خطأ', 'فشل تحديث الدرجة', 'danger');
    }
  };

  const handleDeleteResult = async (resId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه النتيجة نهائياً؟')) return;
    try {
      const { error } = await supabase.from('results').delete().eq('id', resId);
      if (error) throw error;
      showToast('نجاح الحذف', 'تم مسح النتيجة بنجاح', 'success');
      fetchResults();
    } catch (err) {
      showToast('خطأ', 'فشل حذف النتيجة', 'danger');
    }
  };

  // Delete all filtered results
  const handleDeleteAllResults = async () => {
    if (filteredResults.length === 0) return;
    if (!window.confirm(`🚨 تحذير: هل أنت متأكد من حذف جميع النتائج المعروضة حالياً بالفلتر (${filteredResults.length} نتيجة)؟ سيتم إزالة الدرجات والتقديرات نهائياً!`)) return;
    if (!window.confirm('⚠️ تأكيد نهائي: هذه العملية لا يمكن التراجع عنها.')) return;

    setLoading(true);
    try {
      const resultIds = filteredResults.map(r => r.id);
      
      // نقسم الحذف إلى دفعات إذا كان العدد كبيراً لتجنب أخطاء حدود الاستعلام
      const chunkSize = 100;
      for (let i = 0; i < resultIds.length; i += chunkSize) {
        const chunk = resultIds.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('results')
          .delete()
          .in('id', chunk);
        if (error) throw error;
      }

      showToast('نجاح', 'تم حذف النتائج المفلترة بنجاح', 'success');
      fetchResults();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف النتائج', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Certificate Generator Flow (PDF & ZIP Bulk)
  const [numStudentsToGen, setNumStudentsToGen] = useState(0);
  const [studentsToGen, setStudentsToGen] = useState([]);
  const [allResultsToGen, setAllResultsToGen] = useState([]);

  const openCertificateGeneratorModal = async () => {
    if (!selectedDept || !selectedStage || !selectedYear) {
      showToast('تنبيه', 'يرجى اختيار القسم والمرحلة والسنة الأكاديمية أولاً.', 'warning');
      return;
    }
    
    try {
      // 1. جلب الطلاب
      const { data: stds, error: sErr } = await supabase
        .from('students')
        .select('*, stages(name), departments(name)')
        .eq('department_id', selectedDept)
        .eq('stage_id', selectedStage)
        .eq('college_id', adminDetails.college_id);

      if (sErr) throw sErr;

      // 2. جلب جميع درجات هؤلاء الطلاب
      const studentIds = stds.map(s => s.id);
      if (studentIds.length === 0) {
        setNumStudentsToGen(0);
        setStudentsToGen([]);
        setAllResultsToGen([]);
        setIsCertModalOpen(true);
        return;
      }

      const { data: resData, error: rErr } = await supabase
        .from('results')
        .select('*, courses(name, units)')
        .in('student_id', studentIds)
        .eq('academic_year', selectedYear);

      if (rErr) throw rErr;

      setStudentsToGen(stds);
      setAllResultsToGen(resData || []);
      setNumStudentsToGen(stds.length);
      setIsCertModalOpen(true);
    } catch (err) {
      showToast('خطأ', 'فشل تحضير الطلاب لتوليد الشهادات', 'danger');
    }
  };

  const handleGenerateCertificates = async () => {
    if (studentsToGen.length === 0) return;
    setIsGenerating(true);
    setGenProgress({ current: 0, total: studentsToGen.length });

    try {
      // جلب بيانات الكلية والجامعة
      const { data: collegeData } = await supabase
        .from('colleges')
        .select('name, university')
        .eq('id', adminDetails.college_id)
        .single();

      const college = collegeData;
      const university = { name: collegeData?.university || 'رقيم حضور' };

      const deptName = departments.find(d => d.id === selectedDept);

      for (let i = 0; i < studentsToGen.length; i++) {
        const student = studentsToGen[i];
        const studentResults = allResultsToGen.filter(r => r.student_id === student.id);

        if (studentResults.length === 0) {
          setGenProgress(prev => ({ ...prev, current: i + 1 }));
          continue;
        }

        // 1. احسب التقدير العام والنتيجة
        const overallGrade = computeOverallGrade(studentResults);
        const isPassed = computeIsPassed(studentResults);

        // 2. ولّد PDF
        const pdfBlob = await generateCertificatePDF({
          student,
          results: studentResults,
          overallGrade,
          isPassed,
          academicYear: selectedYear,
          university,
          college,
          department: deptName
        });

        // 3. ارفع PDF لـ Supabase Storage
        const path = `${student.id}/${selectedYear.replace('/', '_')}.pdf`;
        const { error: uploadErr } = await supabase.storage
          .from('certificates')
          .upload(path, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (uploadErr) throw uploadErr;

        // الحصول على الرابط العام
        const { data: { publicUrl } } = supabase.storage.from('certificates').getPublicUrl(path);

        // 4. احفظ في جدول certificates
        const { error: dbErr } = await supabase
          .from('certificates')
          .upsert({
            student_id: student.id,
            academic_year: selectedYear,
            overall_grade: overallGrade,
            is_passed: isPassed,
            pdf_url: publicUrl,
            generated_by: user.id
          }, { onConflict: 'student_id,academic_year' });

        if (dbErr) throw dbErr;

        setGenProgress({ current: i + 1, total: studentsToGen.length });
      }

      showToast('اكتمل التوليد 📜', `تم توليد ورفع شهادات النتائج لـ ${studentsToGen.length} طالب بنجاح.`, 'success');
    } catch (err) {
      showToast('خطأ في التوليد', err.message || 'فشل توليد الشهادات للطلاب', 'danger');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadZip = async () => {
    if (studentsToGen.length === 0) return;
    setIsGenerating(true);
    showToast('جاري الضغط', 'يتم تجهيز وضغط الشهادات الآن، يرجى الانتظار...', 'info');

    try {
      const zip = new JSZip();
      
      const { data: collegeData } = await supabase
        .from('colleges')
        .select('name, university')
        .eq('id', adminDetails.college_id)
        .single();

      const college = collegeData;
      const university = { name: collegeData?.university || 'رقيم حضور' };

      const deptName = departments.find(d => d.id === selectedDept);

      for (let i = 0; i < studentsToGen.length; i++) {
        const student = studentsToGen[i];
        const studentResults = allResultsToGen.filter(r => r.student_id === student.id);

        if (studentResults.length === 0) continue;

        const overallGrade = computeOverallGrade(studentResults);
        const isPassed = computeIsPassed(studentResults);

        const pdfBlob = await generateCertificatePDF({
          student,
          results: studentResults,
          overallGrade,
          isPassed,
          academicYear: selectedYear,
          university,
          college,
          department: deptName
        });

        // إضافة الملف للـ ZIP
        zip.file(`${student.full_name.replace(/\s+/g, '_')}_${student.student_number.replace(/\//g, '_')}.pdf`, pdfBlob);
      }

      // توليد وتحميل ملف الـ ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `شهادات_${deptName?.name.replace(/\s+/g, '_')}_${selectedYear.replace('/', '_')}.zip`;
      link.click();

      showToast('نجاح التحميل 📦', 'تم تحميل وحفظ ملف الـ ZIP بنجاح.', 'success');
    } catch (err) {
      showToast('خطأ في الضغط', 'فشل تحضير ملف الـ ZIP للتحميل.', 'danger');
    } finally {
      setIsGenerating(false);
    }
  };

  // دالة لتحميل نموذج ملف كشف الدرجات بصيغة CSV تدعم الترميز العربي بترميز UTF-8 BOM
  const downloadTemplate = () => {
    const csvContent = 'الرقم الجامعي,اسم الطالب,هياكل البيانات,الذكاء الاصطناعي,شبكات الحاسوب,السنة الدراسية\n' +
      '1001,علي أحمد حسين,85.5,امتياز,جيد,2024/2025\n' +
      '1002,فاطمة عباس محمد,,مقبول,متوسط,2024/2025\n' +
      '1003,أحمد رعد علي,92.0,,جيد جداً,2024/2025\n' +
      '1004,زينب جعفر حسن,73.5,جيد جداً,,2024/2025\n';
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'نموذج_درجات_رقيم.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter local search list
  const filteredResults = results.filter(r => {
    const term = searchQuery.toLowerCase();
    return (
      r.students?.full_name.toLowerCase().includes(term) ||
      r.students?.student_number.toLowerCase().includes(term) ||
      r.courses?.name.toLowerCase().includes(term)
    );
  });

  const getBadgeColor = (grade) => {
    const colors = {
      'امتياز': '#C9A84C', // Gold
      'جيد جداً': '#10B981', // Green
      'جيد': '#3B82F6', // Blue
      'متوسط': '#F59E0B', // Orange
      'مقبول': '#6B7280', // Gray
      'ضعيف': '#EF4444' // Red
    };
    return colors[grade] || 'var(--text-secondary)';
  };

  return (
    <div className={styles.adminLayout}>
      <CollegeAdminSidebar activePage="results" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>لوحة إدارة النتائج والشهادات</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button onClick={() => setIsUploadModalOpen(true)}>
              <Upload size={18} />
              <span>رفع درجات الاختبار (Excel)</span>
            </Button>
          </div>
        </div>

        {/* فلاتر الفلترة للنتائج */}
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
            <select className={compStyles.input} value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              <option value="">جميع السنوات الدراسية</option>
              {academicYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className={compStyles.inputGroup} style={{ margin: 0, flex: 1, minWidth: '200px' }}>
            <input 
              type="text" 
              className={compStyles.input} 
              placeholder="ابحث باسم الطالب أو المادة..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {filteredResults.length > 0 && (
            <Button variant="danger" size="sm" onClick={handleDeleteAllResults}>
              <Trash2 size={16} />
              <span>حذف كل المفلترين ({filteredResults.length})</span>
            </Button>
          )}
        </div>

        {loading ? (
          <Skeleton height="300px" />
        ) : filteredResults.length === 0 ? (
          <div className={styles.glass} style={{ padding: '4rem', textAlign: 'center', borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)' }}>
            لا يوجد نتائج مرفوعة تطابق خيارات البحث الحالية.
          </div>
        ) : (
          <div className={compStyles.tableContainer}>
            <Table>
              <thead>
                <Tr>
                  <Th>اسم الطالب</Th>
                  <Th>الرقم الجامعي</Th>
                  <Th>المادة</Th>
                  <Th>السنة الدراسية</Th>
                  <Th>الدرجة الرقمية</Th>
                  <Th>التقدير</Th>
                  <Th>العمليات</Th>
                </Tr>
              </thead>
              <tbody>
                {filteredResults.map(res => (
                  <Tr key={res.id}>
                    <Td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{res.students?.full_name}</Td>
                    <Td style={{ fontFamily: 'monospace' }}>{res.students?.student_number}</Td>
                    <Td style={{ fontWeight: '500' }}>{res.courses?.name}</Td>
                    <Td>{res.academic_year}</Td>
                    <Td style={{ fontWeight: 'bold' }}>{res.score}</Td>
                    <Td>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        color: '#ffffff',
                        backgroundColor: getBadgeColor(res.grade_label)
                      }}>
                        {res.grade_label}
                      </span>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <Button size="icon" variant="secondary" onClick={() => handleEditResult(res)}>
                          <Edit size={14} />
                        </Button>
                        <Button size="icon" variant="danger" onClick={() => handleDeleteResult(res.id)}>
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

        {/* مودال رفع الدرجات جماعياً */}
        <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="رفع كشف نتائج درجات الطلاب">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.glass} style={{ padding: '1rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                💡 <b>صيغة شبكة الدرجات (Matrix) المقبولة:</b>
                <br />
                يمكنك رفع ملف Excel (<b>.xlsx</b>) أو CSV بتنسيق شبكة، حيث يتم كتابة كل طالب في سطر مستقل والأعمدة تمثل أسماء المواد كالتالي:
                <br />
                <code style={{ direction: 'rtl', display: 'block', backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px', margin: '0.5rem 0', fontFamily: 'monospace' }}>
                  الرقم الجامعي، اسم الطالب (اختياري)، هياكل البيانات، الذكاء الاصطناعي، شبكات الحاسوب، السنة الدراسية
                </code>
                * اكتب الدرجة الرقمية (مثل: 85.5) أو التقدير مباشرة (مثل: مقبول) في خلية المادة. اترك الخلية فارغة لعدم رصد المادة للطالب.
              </p>
            </div>

            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>اختر ملف كشف الدرجات</label>
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".xlsx,.csv"
                className={compStyles.input}
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </div>

            {isUploading && (
              <div style={{ width: '100%', margin: '1rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <span>{uploadStatusMsg}</span>
                  {uploadProgress.total > 0 && (
                    <span>{uploadProgress.current} / {uploadProgress.total}</span>
                  )}
                </div>
                {uploadProgress.total > 0 && (
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%`, height: '100%', backgroundColor: 'var(--accent)', transition: 'width 0.2s' }}></div>
                  </div>
                )}
              </div>
            )}

            {resultsPreview.length > 0 && !isUploading && (
              <div>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>معاينة درجات الكشف ({resultsPreview.length} سجل):</h4>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        {Object.keys(resultsPreview[0] || {}).slice(0, 6).map((header, idx) => (
                          <th key={idx} style={{ padding: '6px' }}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultsPreview.slice(0, 10).map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          {Object.keys(r).slice(0, 6).map((key, idx) => (
                            <td key={idx} style={{ padding: '6px' }}>{String(r[key] || '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '1rem', width: '100%' }}>
              <Button variant="secondary" onClick={downloadTemplate} style={{ marginLeft: 'auto' }}>
                <Download size={16} />
                <span>تحميل النموذج التجريبي (CSV)</span>
              </Button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="secondary" onClick={() => { setIsUploadModalOpen(false); setResultsPreview([]); }} disabled={isUploading}>إلغاء</Button>
                <Button onClick={executeUpload} disabled={resultsPreview.length === 0 || isUploading}>
                  <span>بدء الرفع والاحتساب</span>
                </Button>
              </div>
            </div>
          </div>
        </Modal>

        {/* مودال تعديل النتيجة الفردية */}
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="تعديل درجة وتقدير الطالب">
          <form onSubmit={saveEditedResult} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* معلومات الطالب والمادة */}
            <div style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              padding: '1rem', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.5rem' 
            }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>اسم الطالب: </span>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{editForm.student_name}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>المادة الدراسية: </span>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{editForm.course_name}</strong>
              </div>
            </div>

            {/* تحديد التقدير مباشرة */}
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>التقدير العام</label>
              <select 
                className={compStyles.input}
                value={editForm.grade_label}
                onChange={handleGradeSelectChange}
                required
              >
                <option value="">اختر التقدير...</option>
                <option value="امتياز">امتياز (90 - 100)</option>
                <option value="جيد جداً">جيد جداً (80 - 89)</option>
                <option value="جيد">جيد (70 - 79)</option>
                <option value="متوسط">متوسط (60 - 69)</option>
                <option value="مقبول">مقبول (50 - 59)</option>
                <option value="ضعيف">ضعيف (0 - 49)</option>
              </select>
            </div>

            {/* الدرجة الرقمية (تتحدث تلقائياً) */}
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>الدرجة الرقمية (من 0 إلى 100)</label>
              <input 
                type="number" 
                step="0.1"
                min="0"
                max="100"
                required
                className={compStyles.input}
                value={editForm.score}
                onChange={handleScoreChange}
                placeholder="سيتم تعيين درجة تلقائية عند اختيار التقدير"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                * يمكنك إدخال درجة مخصصة أو الاعتماد على الدرجة التلقائية للتقدير المختار.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>إلغاء</Button>
              <Button type="submit">حفظ التغييرات</Button>
            </div>
          </form>
        </Modal>

        {/* مودال توليد الشهادات وتصدير ZIP */}
        <Modal isOpen={isCertModalOpen} onClose={() => setIsCertModalOpen(false)} title="توليد وتنزيل شهادات النتائج الرسمية للطلاب">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', padding: '1rem', borderRadius: '50%' }}>
                <FileText size={32} />
              </div>
              <div>
                <h4 style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>توليد شهادات PDF جماعياً</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  سيتم توليد كشف النتائج الرسمي (بنموذج الوزارة العراقي) لكل الطلاب بالمرحلة والقسم المحددين.
                </p>
              </div>
            </div>

            <div className={styles.glass} style={{ padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem' }}>عدد الطلاب المحددين للتوليد:</span>
              <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--accent)' }}>{numStudentsToGen} طالب</span>
            </div>

            {isGenerating && (
              <div style={{ width: '100%', margin: '0.5rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <span>جاري توليد وضغط شهادات الطلاب...</span>
                  <span>{genProgress.current} / {genProgress.total}</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(genProgress.current / genProgress.total) * 100}%`, height: '100%', backgroundColor: 'var(--accent)', transition: 'width 0.1s' }}></div>
                </div>
              </div>
            )}

            {numStudentsToGen === 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--danger)', fontSize: '0.85rem', alignItems: 'center' }}>
                <AlertTriangle size={18} />
                <span>لا يوجد طلاب درجاتهم مرفوعة في هذه المرحلة والسنة الدراسية.</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <Button variant="secondary" onClick={() => setIsCertModalOpen(false)} disabled={isGenerating}>إلغاء</Button>
              <Button variant="secondary" onClick={handleDownloadZip} disabled={numStudentsToGen === 0 || isGenerating} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <FileArchive size={16} />
                <span>تحميل الكل كـ ZIP</span>
              </Button>
              <Button onClick={handleGenerateCertificates} disabled={numStudentsToGen === 0 || isGenerating}>
                <span>{isGenerating ? 'جاري التوليد...' : 'توليد ورفع شهادات الجميع'}</span>
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
