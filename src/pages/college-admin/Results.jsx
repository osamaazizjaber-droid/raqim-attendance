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
import { computeOverallGrade, computeIsPassed, computeStudentStatus } from '../../lib/gradeUtils';
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
  const [selectedSemester, setSelectedSemester] = useState('الكورس الأول');
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
  const [editForm, setEditForm] = useState({ studentId: null, studentName: '', academicYear: '', semester: '', coursesList: [] });

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
  }, [adminDetails, selectedDept, selectedStage, selectedYear, selectedSemester]);

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
  const autoGenerateCertificates = async (studentIds, academicYear, semester, onProgress) => {
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
        .select('id, full_name, student_number, department_id, stage_id, study_type, departments(name), stages(name)')
        .in('id', studentIds);

      if (!studentDetails || studentDetails.length === 0) return;

      const { data: allStudentResults } = await supabase
        .from('results')
        .select('*, courses!inner(name, units, semester)')
        .in('student_id', studentIds)
        .eq('academic_year', academicYear)
        .eq('courses.semester', semester);

      if (!allStudentResults || allStudentResults.length === 0) return;

      let current = 0;
      for (const student of studentDetails) {
        const studentResults = allStudentResults.filter(r => r.student_id === student.id);
        if (studentResults.length === 0) {
          // إذا لم يتبقَ نتائج للطالب للكورس الحالي، يتم حذف شهادته من قاعدة البيانات والتخزين
          await supabase
            .from('certificates')
            .delete()
            .eq('student_id', student.id)
            .eq('academic_year', academicYear)
            .eq('semester', semester);

          try {
            const path = `${student.id}/${academicYear.replace('/', '_')}_${semester.replace(/\s+/g, '_')}.pdf`;
            await supabase.storage.from('certificates').remove([path]);
          } catch (e) {
            console.error('Failed to remove certificate from storage:', e);
          }

          current++;
          if (onProgress) onProgress(current, studentDetails.length);
          continue;
        }

        const status = computeStudentStatus(studentResults);
        const isPassed = status === 'ناجح';
        const overallGrade = status === 'ناجح' ? computeOverallGrade(studentResults) : status;

        const pdfBlob = await generateCertificatePDF({
          student,
          results: studentResults,
          overallGrade: status === 'ناجح' ? overallGrade : '-',
          isPassed: status,
          academicYear,
          university,
          college,
          department: student.departments,
          universityLogoUrl,
          collegeLogoUrl,
          roundName: semester
        });

        const semCode = semester === 'الكورس الثاني' ? 'sem2' : 'sem1';
        const path = `${student.id}/${academicYear.replace('/', '_')}_${semCode}.pdf`;
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
            semester: semester,
            overall_grade: overallGrade,
            is_passed: isPassed,
            pdf_url: publicUrl,
            generated_by: user?.id
          }, { onConflict: 'student_id,academic_year,semester' });

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
        .select('id, name, department_id, semester, departments!inner(college_id)')
        .eq('departments.college_id', adminDetails.college_id);

      const studentsMap = new Map(allStudents.map(s => [s.student_number.trim(), s.id]));
      const coursesMap = new Map(allCourses.map(c => [c.name.trim().toLowerCase(), c.id]));

      const resultsToInsert = [];

      // المفاتيح الثابتة لاستبعادها عند البحث عن المواد
      const fixedKeys = [
        'student_number', 'الرقم الجامعي', 'الرقم',
        'academic_year', 'السنة الدراسية', 'العام الدراسي', 'السنة',
        'full_name', 'الاسم الكامل', 'الاسم', 'اسم الطالب', 'الاسم الثلاثي',
        'semester', 'الكورس', 'الفصل', 'الفصل الدراسي'
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



      const affectedSemesters = Array.from(new Set(resultsToInsert.map(r => {
        const course = allCourses?.find(c => c.id === r.course_id);
        return course?.semester || 'الكورس الأول';
      })));

      setUploadStatusMsg('جاري توليد ورفع شهادات PDF للطلاب...');
      setUploadProgress({ current: 0, total: uniqueStudentIds.length });

      for (const sem of affectedSemesters) {
        await autoGenerateCertificates(uniqueStudentIds, uploadYear, sem, (current, total) => {
          setUploadProgress({ current, total });
        });
      }

      showToast('تم الرفع بنجاح ✅', `تم معالجة وإدخال ${resultsToInsert.length} نتيجة وتوليد الشهادات بنجاح.`, 'success');
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

  const handleModalScoreChange = (index, scoreVal) => {
    const updated = [...editForm.coursesList];
    const scoreNum = parseFloat(scoreVal);
    let label = updated[index].grade_label;
    if (!isNaN(scoreNum)) {
      const scale = gradeScales.find(s => scoreNum >= s.min_score && scoreNum <= s.max_score);
      if (scale) label = scale.label;
    }
    updated[index].score = scoreVal;
    updated[index].grade_label = label;
    setEditForm(prev => ({
      ...prev,
      coursesList: updated
    }));
  };

  const handleModalGradeChange = (index, label) => {
    if (!label) return;
    const updated = [...editForm.coursesList];
    const defaultScores = {
      'امتياز': 95,
      'جيد جداً': 85,
      'جيد': 75,
      'متوسط': 65,
      'مقبول': 55,
      'ضعيف': 45
    };
    updated[index].grade_label = label;
    updated[index].score = defaultScores[label] || updated[index].score;
    setEditForm(prev => ({
      ...prev,
      coursesList: updated
    }));
  };

  const handleEditResult = (studentRow) => {
    const coursesList = Array.from(studentRow.results.entries()).map(([courseName, res]) => ({
      resultId: res.id,
      courseId: res.course_id,
      courseName: courseName,
      score: res.score,
      grade_label: res.grade_label
    }));

    setEditForm({
      studentId: studentRow.student.id,
      studentName: studentRow.student.full_name,
      academicYear: studentRow.academic_year,
      semester: studentRow.results.values().next().value?.courses?.semester || selectedSemester,
      coursesList: coursesList
    });
    setIsEditModalOpen(true);
  };

  const saveEditedResult = async (e) => {
    e.preventDefault();
    try {
      const promises = editForm.coursesList.map(item => {
        const score = parseFloat(item.score);
        const scale = gradeScales.find(s => score >= s.min_score && score <= s.max_score);
        const label = scale ? scale.label : item.grade_label;

        return supabase
          .from('results')
          .update({ score: score, grade_label: label })
          .eq('id', item.resultId);
      });

      const resultsRes = await Promise.all(promises);
      const errors = resultsRes.filter(r => r.error);
      if (errors.length > 0) throw errors[0].error;

      showToast('تم التحديث', 'تم حفظ التعديلات بنجاح وجاري تحديث الشهادة تلقائياً.', 'success');
      setIsEditModalOpen(false);
      fetchResults();

      // التحديث التلقائي للشهادة الخاصة بالطالب
      autoGenerateCertificates(
        [editForm.studentId], 
        editForm.academicYear, 
        editForm.semester
      );
    } catch (err) {
      showToast('خطأ', 'فشل تحديث الدرجات', 'danger');
    }
  };

  const handleDeleteStudentResults = async (studentId, studentName, studentResultsList) => {
    if (!window.confirm(`هل أنت متأكد من حذف جميع درجات الطالب "${studentName}" لهذا الفصل الدراسي نهائياً؟`)) return;
    try {
      const resultIds = studentResultsList.map(r => r.id);
      const { error } = await supabase.from('results').delete().in('id', resultIds);
      if (error) throw error;
      showToast('نجاح الحذف', 'تم مسح درجات الطالب بنجاح وجاري تحديث الشهادة.', 'success');
      fetchResults();

      if (studentResultsList.length > 0) {
        const firstRes = studentResultsList[0];
        // Delete their certificate from DB
        await supabase
          .from('certificates')
          .delete()
          .eq('student_id', studentId)
          .eq('academic_year', firstRes.academic_year)
          .eq('semester', firstRes.courses?.semester || selectedSemester);

        // Delete from Storage
        const semCode = (firstRes.courses?.semester || selectedSemester) === 'الكورس الثاني' ? 'sem2' : 'sem1';
        const path = `${studentId}/${firstRes.academic_year.replace('/', '_')}_${semCode}.pdf`;
        try {
          await supabase.storage
            .from('certificates')
            .remove([path]);
        } catch (storageErr) {
          console.error('Failed to remove certificate from storage:', storageErr);
        }
      }
    } catch (err) {
      showToast('خطأ', 'فشل حذف درجات الطالب', 'danger');
    }
  };

  // Delete all filtered results
  const handleDeleteAllResults = async () => {
    if (filteredResults.length === 0) return;
    if (!window.confirm(`🚨 تحذير: هل أنت متأكد من حذف جميع النتائج المعروضة حالياً بالفلتر (${filteredResults.length} نتيجة)؟ سيتم إزالة الدرجات والتقديرات والشهادات نهائياً!`)) return;
    if (!window.confirm('⚠️ تأكيد نهائي: هذه العملية لا يمكن التراجع عنها.')) return;

    setLoading(true);
    try {
      const resultIds = filteredResults.map(r => r.id);
      
      // 1. نقسم الحذف إلى دفعات إذا كان العدد كبيراً لتجنب أخطاء حدود الاستعلام
      const chunkSize = 100;
      for (let i = 0; i < resultIds.length; i += chunkSize) {
        const chunk = resultIds.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('results')
          .delete()
          .in('id', chunk);
        if (error) throw error;
      }

      // 2. تحديد الطلاب والسنوات الدراسية لحذف الشهادات الخاصة بهم من قاعدة البيانات والتخزين
      const studentIds = Array.from(new Set(filteredResults.map(r => r.student_id)));
      const academicYears = Array.from(new Set(filteredResults.map(r => r.academic_year)));

      if (studentIds.length > 0 && academicYears.length > 0) {
        // حذف سجلات الشهادات من قاعدة البيانات
        await supabase
          .from('certificates')
          .delete()
          .in('student_id', studentIds)
          .in('academic_year', academicYears)
          .eq('semester', selectedSemester);

        // حذف ملفات PDF من التخزين (Supabase Storage)
        const storagePaths = [];
        filteredResults.forEach(r => {
          const path = `${r.student_id}/${r.academic_year.replace('/', '_')}_${selectedSemester.replace(/\s+/g, '_')}.pdf`;
          if (!storagePaths.includes(path)) {
            storagePaths.push(path);
          }
        });

        if (storagePaths.length > 0) {
          try {
            await supabase.storage
              .from('certificates')
              .remove(storagePaths);
          } catch (storageErr) {
            console.error('Failed to remove certificates from storage:', storageErr);
          }
        }
      }

      showToast('نجاح', 'تم حذف النتائج والشهادات المفلترة بنجاح', 'success');
      fetchResults();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف النتائج والشهادات', 'danger');
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
        .select('*, courses!inner(name, units, semester)')
        .in('student_id', studentIds)
        .eq('academic_year', selectedYear)
        .eq('courses.semester', selectedSemester);

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
        const status = computeStudentStatus(studentResults);
        const isPassed = status === 'ناجح';
        const overallGrade = status === 'ناجح' ? computeOverallGrade(studentResults) : status;

        // 2. ولّد PDF
        const pdfBlob = await generateCertificatePDF({
          student,
          results: studentResults,
          overallGrade: status === 'ناجح' ? overallGrade : '-',
          isPassed: status,
          academicYear: selectedYear,
          university,
          college,
          department: deptName,
          roundName: selectedSemester
        });

        // 3. ارفع PDF لـ Supabase Storage
        const semCode = selectedSemester === 'الكورس الثاني' ? 'sem2' : 'sem1';
        const path = `${student.id}/${selectedYear.replace('/', '_')}_${semCode}.pdf`;
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
            semester: selectedSemester,
            overall_grade: overallGrade,
            is_passed: isPassed,
            pdf_url: publicUrl,
            generated_by: user.id
          }, { onConflict: 'student_id,academic_year,semester' });

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

        const status = computeStudentStatus(studentResults);
        const isPassed = status === 'ناجح';
        const overallGrade = status === 'ناجح' ? computeOverallGrade(studentResults) : status;

        const pdfBlob = await generateCertificatePDF({
          student,
          results: studentResults,
          overallGrade: status === 'ناجح' ? overallGrade : '-',
          isPassed: status,
          academicYear: selectedYear,
          university,
          college,
          department: deptName,
          roundName: selectedSemester
        });

        // إضافة الملف للـ ZIP
        zip.file(`${student.full_name.replace(/\s+/g, '_')}_${student.student_number.replace(/\//g, '_')}_${selectedSemester.replace(/\s+/g, '_')}.pdf`, pdfBlob);
      }

      // توليد وتحميل ملف الـ ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `شهادات_${deptName?.name.replace(/\s+/g, '_')}_${selectedYear.replace('/', '_')}_${selectedSemester.replace(/\s+/g, '_')}.zip`;
      link.click();

      showToast('نجاح التحميل 📦', 'تم تحميل وحفظ ملف الـ ZIP بنجاح.', 'success');
    } catch (err) {
      showToast('خطأ في الضغط', 'فشل تحضير ملف الـ ZIP للتحميل.', 'danger');
    } finally {
      setIsGenerating(false);
    }
  };

  // دالة لتحميل نموذج ملف كشف الدرجات بصيغة CSV تدعم الترميز العربي بترميز UTF-8 BOM
  const downloadTemplate = async () => {
    if (!selectedDept || !selectedStage || !selectedYear) {
      showToast('تنبيه', 'يرجى اختيار القسم والمرحلة والسنة الدراسية أولاً من الفلاتر لتحميل النموذج الخاص بها.', 'warning');
      return;
    }

    try {
      // جلب المواد الخاصة بالقسم والمرحلة والكورس المحددين
      const { data: coursesData } = await supabase
        .from('courses')
        .select('name')
        .eq('department_id', selectedDept)
        .eq('stage_id', selectedStage)
        .eq('semester', selectedSemester);

      const courseNames = coursesData?.map(c => c.name) || [];
      if (courseNames.length === 0) {
        showToast('تنبيه', 'لا توجد مواد مسجلة لهذا القسم وهذه المرحلة في الكورس المحدد.', 'warning');
        return;
      }

      const csvHeaders = ['الرقم الجامعي', 'اسم الطالب', ...courseNames, 'العام الدراسي', 'الكورس'].join(',');
      const sampleRow = ['1001', 'علي أحمد حسين', ...courseNames.map(() => '85.5'), selectedYear, selectedSemester].join(',');
      
      const csvContent = `${csvHeaders}\n${sampleRow}\n`;
      
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'نموذج_درجات_رقيم.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      showToast('خطأ', 'فشل تحميل النموذج التجريبي', 'danger');
    }
  };

  // دالة تصدير كشف درجات المرحلة بترميز Excel وتضمين المواد المسجلة والطلاب والدرجات الحالية
  const handleExportTemplate = async () => {
    if (!selectedDept || !selectedStage || !selectedYear) {
      showToast('تنبيه', 'يرجى اختيار القسم والمرحلة والسنة الدراسية من الفلاتر لتصدير الكشف الخاص بها.', 'warning');
      return;
    }

    try {
      showToast('جاري التحضير', 'جاري جلب البيانات وتصدير ملف Excel...', 'info');

      // 1. جلب اسم القسم والمرحلة لعنونة الملف
      const deptName = departments.find(d => d.id === selectedDept)?.name || 'قسم_غير_معروف';
      const stageName = stages.find(s => s.id === selectedStage)?.name || 'مرحلة_غير_معروف';

      // 2. جلب المواد الخاصة بالقسم والمرحلة والكورس المحددين
      const { data: coursesData, error: coursesErr } = await supabase
        .from('courses')
        .select('id, name')
        .eq('department_id', selectedDept)
        .eq('stage_id', selectedStage)
        .eq('semester', selectedSemester);

      if (coursesErr) throw coursesErr;

      if (!coursesData || coursesData.length === 0) {
        showToast('تنبيه', 'لا توجد مواد مسجلة لهذا القسم وهذه المرحلة.', 'warning');
        return;
      }

      // 3. جلب جميع الطلاب في هذا القسم والمرحلة
      const { data: studentsData, error: studentsErr } = await supabase
        .from('students')
        .select('id, full_name, student_number')
        .eq('department_id', selectedDept)
        .eq('stage_id', selectedStage)
        .eq('college_id', adminDetails.college_id)
        .order('full_name', { ascending: true });

      if (studentsErr) throw studentsErr;

      if (!studentsData || studentsData.length === 0) {
        showToast('تنبيه', 'لا يوجد طلاب مسجلين في هذا القسم وهذه المرحلة.', 'warning');
        return;
      }

      // 4. جلب الدرجات الحالية لهؤلاء الطلاب في هذه السنة الدراسية
      const studentIds = studentsData.map(s => s.id);
      const { data: resultsData, error: resultsErr } = await supabase
        .from('results')
        .select('student_id, course_id, score')
        .in('student_id', studentIds)
        .eq('academic_year', selectedYear);

      if (resultsErr) throw resultsErr;

      // 5. بناء هيكلية البيانات لملف Excel
      const scoreMap = new Map();
      if (resultsData) {
        resultsData.forEach(r => {
          scoreMap.set(`${r.student_id}_${r.course_id}`, r.score);
        });
      }

      const rowsData = studentsData.map(student => {
        const row = {
          'الرقم الجامعي': student.student_number,
          'اسم الطالب': student.full_name,
        };

        // إضافة أعمدة المواد مع درجاتها الحالية (أو فارغ)
        coursesData.forEach(course => {
          const score = scoreMap.get(`${student.id}_${course.id}`);
          row[course.name] = score !== undefined ? score : '';
        });

        row['العام الدراسي'] = selectedYear;
        row['الكورس'] = selectedSemester;
        return row;
      });

      // 6. توليد وتنزيل ملف Excel باستخدام مكتبة XLSX
      const worksheet = XLSX.utils.json_to_sheet(rowsData);
      
      // تعيين اتجاه الصفحة من اليمين إلى اليسار (RTL) لملف Excel ليكون جميلاً للعربية
      worksheet['!dir'] = 'rtl';

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'الدرجات');
      
      const fileName = `كشف_درجات_${deptName.replace(/\s+/g, '_')}_${stageName.replace(/\s+/g, '_')}_${selectedYear.replace(/\//g, '_')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      showToast('تم التصدير بنجاح 📊', `تم تصدير كشف الدرجات لـ ${studentsData.length} طالب بنجاح.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('خطأ في التصدير', 'فشل تصدير كشف الدرجات للطلاب.', 'danger');
    }
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

  // Grouping results by student for Matrix rendering
  const uniqueCourses = Array.from(new Set(filteredResults.map(r => r.courses?.name))).filter(Boolean).sort();
  
  const groupedStudentsMap = new Map();
  filteredResults.forEach(r => {
    if (!r.students) return;
    const studentId = r.student_id;
    if (!groupedStudentsMap.has(studentId)) {
      groupedStudentsMap.set(studentId, {
        student: r.students,
        academic_year: r.academic_year,
        results: new Map() // courseName -> result record
      });
    }
    if (r.courses?.name) {
      groupedStudentsMap.get(studentId).results.set(r.courses.name, r);
    }
  });
  
  const studentRows = Array.from(groupedStudentsMap.values());

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
            <Button variant="secondary" onClick={handleExportTemplate}>
              <Download size={18} />
              <span>تصدير كشف درجات المرحلة (Excel)</span>
            </Button>
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

          <div className={compStyles.inputGroup} style={{ margin: 0, minWidth: '120px' }}>
            <select className={compStyles.input} value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)}>
              <option value="الكورس الأول">الكورس الأول</option>
              <option value="الكورس الثاني">الكورس الثاني</option>
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
                  <Th>السنة الدراسية</Th>
                  {uniqueCourses.map(courseName => (
                    <Th key={courseName}>{courseName}</Th>
                  ))}
                  <Th>العمليات</Th>
                </Tr>
              </thead>
              <tbody>
                {studentRows.map(row => {
                  const studentResultsList = Array.from(row.results.values());
                  return (
                    <Tr key={row.student.id}>
                      <Td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{row.student.full_name}</Td>
                      <Td style={{ fontFamily: 'monospace' }}>{row.student.student_number}</Td>
                      <Td>{row.academic_year}</Td>
                      {uniqueCourses.map(courseName => {
                        const res = row.results.get(courseName);
                        return (
                          <Td key={courseName}>
                            {res ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <span style={{ fontWeight: 'bold' }}>{res.score}</span>
                                <span style={{ 
                                  display: 'inline-block',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '8px',
                                  fontSize: '0.7rem',
                                  fontWeight: 'bold',
                                  color: '#ffffff',
                                  backgroundColor: getBadgeColor(res.grade_label),
                                  textAlign: 'center',
                                  width: 'fit-content'
                                }}>
                                  {res.grade_label}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </Td>
                        );
                      })}
                      <Td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <Button size="icon" variant="secondary" onClick={() => handleEditResult(row)}>
                            <Edit size={14} />
                          </Button>
                          <Button size="icon" variant="danger" onClick={() => handleDeleteStudentResults(row.student.id, row.student.full_name, studentResultsList)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
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

        {/* مودال تعديل النتائج للفصل الدراسي */}
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="تعديل درجات وتقديرات الطالب للفصل الحالي">
          <form onSubmit={saveEditedResult} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* اسم الطالب */}
            <div style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              padding: '1rem', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border)', 
              marginBottom: '0.5rem'
            }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>اسم الطالب: </span>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{editForm.studentName}</strong>
              </div>
            </div>

            {/* قائمة المواد وتعديل درجاتها */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto', paddingLeft: '0.5rem' }}>
              {editForm.coursesList.map((item, index) => (
                <div key={item.resultId} style={{ 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '0.85rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)'
                }}>
                  <h4 style={{ fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                    📚 {item.courseName}
                  </h4>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* تحديد التقدير */}
                    <div className={compStyles.inputGroup} style={{ flex: 1, minWidth: '150px', margin: 0 }}>
                      <label className={compStyles.label} style={{ fontSize: '0.75rem' }}>التقدير</label>
                      <select 
                        className={compStyles.input}
                        value={item.grade_label}
                        onChange={e => handleModalGradeChange(index, e.target.value)}
                        required
                      >
                        <option value="">اختر...</option>
                        <option value="امتياز">امتياز (90 - 100)</option>
                        <option value="جيد جداً">جيد جداً (80 - 89)</option>
                        <option value="جيد">جيد (70 - 79)</option>
                        <option value="متوسط">متوسط (60 - 69)</option>
                        <option value="مقبول">مقبول (50 - 59)</option>
                        <option value="ضعيف">ضعيف (0 - 49)</option>
                      </select>
                    </div>

                    {/* الدرجة الرقمية */}
                    <div className={compStyles.inputGroup} style={{ flex: 1, minWidth: '150px', margin: 0 }}>
                      <label className={compStyles.label} style={{ fontSize: '0.75rem' }}>الدرجة الرقمية (من 0 إلى 100)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        max="100"
                        required
                        className={compStyles.input}
                        value={item.score}
                        onChange={e => handleModalScoreChange(index, e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
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
