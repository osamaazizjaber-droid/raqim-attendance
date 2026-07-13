import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Folder, School, PlusCircle, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Table, Tr, Th, Td } from '../../components/ui/Table';
import { Skeleton } from '../../components/ui/Skeleton';
import { CollegeAdminSidebar } from './Dashboard';
import styles from '../../styles/admin.module.css';
import compStyles from '../../styles/components.module.css';
import { useAuth } from '../../hooks/useAuth';
import { exportToExcel } from '../../lib/exportUtils';

export default function CollegeAdminDepartments() {
  const { showToast } = useToast();
  const { adminDetails } = useAuth();
  
  // States
  const [departments, setDepartments] = useState([]);
  const [stages, setStages] = useState([]);
  const [courses, setCourses] = useState([]);
  
  const [selectedDept, setSelectedDept] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  
  // Form inputs
  const [deptForm, setDeptForm] = useState({ id: null, name: '' });
  const [courseForm, setCourseForm] = useState({ id: null, name: '', stage_id: '', units: 1, semester: 'الكورس الأول' });

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
        setSelectedDept(depts[0]);
        await fetchDeptCourses(depts[0].id);
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

  return (
    <div className={styles.adminLayout}>
      <CollegeAdminSidebar activePage="departments" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>إدارة الأقسام الدراسية والمواد</h1>
          <Button onClick={() => { setDeptForm({ id: null, name: '' }); setIsDeptModalOpen(true); }}>
            <Plus size={18} />
            <span>إضافة قسم جديد</span>
          </Button>
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
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>الأقسام العلمية</h2>
              {departments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  لا توجد أقسام مضافة.
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
                        width: '100%'
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
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.25rem' }}
                          onClick={() => deleteDepartment(dept.id, dept.name)}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>المواد الدراسية لقسم {selectedDept.name}</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>إدارة المواد وتخصيصها للمراحل وتعيين عدد الوحدات.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button size="sm" variant="secondary" onClick={handleDownloadCourses} disabled={courses.length === 0}>
                      <Download size={16} />
                      <span>تحميل المواد</span>
                    </Button>
                    <Button size="sm" onClick={() => { setCourseForm({ id: null, name: '', stage_id: stages[0]?.id || '', units: 1, semester: 'الكورس الأول' }); setIsCourseModalOpen(true); }}>
                      <PlusCircle size={16} />
                      <span>إضافة مادة</span>
                    </Button>
                  </div>
                </div>

                {courses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    لا توجد مواد مضافة لهذا القسم. اضغط "إضافة مادة" للبدء.
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
                            <Td>{course.stages?.name || '-'}</Td>
                            <Td style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{course.units || 1}</Td>
                            <Td>{course.semester || 'الكورس الأول'}</Td>
                            <Td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <Button size="icon" variant="secondary" onClick={() => openEditCourse(course)}>
                                  <Edit size={14} />
                                </Button>
                                <Button size="icon" variant="danger" onClick={() => deleteCourse(course.id, course.name)}>
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

        {/* مودال المادة */}
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
      </div>
    </div>
  );
}
