import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, School, Folder, PlusCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Table, Tr, Th, Td } from '../../components/ui/Table';
import { Skeleton } from '../../components/ui/Skeleton';
import { AdminSidebar } from './Dashboard';
import styles from '../../styles/admin.module.css';
import compStyles from '../../styles/components.module.css';

export default function AdminUniversities() {
  const { showToast } = useToast();
  
  // States
  const [universities, setUniversities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stages, setStages] = useState([]);
  const [courses, setCourses] = useState([]);
  
  const [selectedUniv, setSelectedUniv] = useState(null);
  const [selectedDept, setSelectedDept] = useState(null);
  
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isUnivModalOpen, setIsUnivModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  
  // Form inputs
  const [univForm, setUnivForm] = useState({ id: null, name: '', city: '' });
  const [deptForm, setDeptForm] = useState({ name: '' });
  const [courseForm, setCourseForm] = useState({ name: '', stage_id: '', units: 1, semester: 'الكورس الأول' });

  // Initial load
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // Fetch Universities
      const { data: univs, error: uErr } = await supabase
        .from('universities')
        .select('*')
        .order('created_at', { ascending: false });
      if (uErr) throw uErr;
      setUniversities(univs || []);
      
      // Fetch Stages ordered by created_at
      const { data: stgs, error: sErr } = await supabase
        .from('stages')
        .select('*')
        .order('created_at', { ascending: true });
      if (sErr) throw sErr;
      setStages(stgs || []);
      
      if (univs && univs.length > 0) {
        setSelectedUniv(univs[0]);
        await fetchUnivDepartments(univs[0].id);
      }
    } catch (err) {
      showToast('خطأ', 'حدث خطأ أثناء تحميل البيانات المبدئية', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Departments for a selected University
  const fetchUnivDepartments = async (univId) => {
    try {
      const { data: depts, error } = await supabase
        .from('departments')
        .select('*')
        .eq('university_id', univId)
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
      showToast('خطأ', 'فشل تحميل الكليات/الأقسام', 'danger');
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

  // Select handlers
  const handleUnivSelect = async (univ) => {
    setSelectedUniv(univ);
    await fetchUnivDepartments(univ.id);
  };

  const handleDeptSelect = async (dept) => {
    setSelectedDept(dept);
    await fetchDeptCourses(dept.id);
  };

  // --- CRUD ACTIONS ---

  // University CRUD
  const saveUniversity = async (e) => {
    e.preventDefault();
    try {
      if (univForm.id) {
        // Edit
        const { error } = await supabase
          .from('universities')
          .update({ name: univForm.name, city: univForm.city })
          .eq('id', univForm.id);
        if (error) throw error;
        showToast('نجاح', 'تم تحديث الجامعة بنجاح', 'success');
      } else {
        // Create
        const { error } = await supabase
          .from('universities')
          .insert({ name: univForm.name, city: univForm.city });
        if (error) throw error;
        showToast('نجاح', 'تم إضافة الجامعة بنجاح', 'success');
      }
      setIsUnivModalOpen(false);
      setUnivForm({ id: null, name: '', city: '' });
      fetchInitialData();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حفظ الجامعة', 'danger');
    }
  };

  const deleteUniversity = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف جامعة "${name}"؟ سيتم حذف جميع كلياتها وطلابها وموادها تلقائياً!`)) return;
    try {
      const { error } = await supabase.from('universities').delete().eq('id', id);
      if (error) throw error;
      showToast('نجاح', 'تم حذف الجامعة بنجاح', 'success');
      fetchInitialData();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف الجامعة', 'danger');
    }
  };

  // Department CRUD
  const createDepartment = async (e) => {
    e.preventDefault();
    if (!selectedUniv) return;
    try {
      const { error } = await supabase
        .from('departments')
        .insert({ name: deptForm.name, university_id: selectedUniv.id });
      if (error) throw error;
      showToast('نجاح', 'تم إضافة القسم/الكلية بنجاح', 'success');
      setIsDeptModalOpen(false);
      setDeptForm({ name: '' });
      fetchUnivDepartments(selectedUniv.id);
    } catch (err) {
      showToast('خطأ', err.message || 'فشل إضافة القسم', 'danger');
    }
  };

  const deleteDepartment = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف قسم "${name}"؟ سيتم حذف جميع المواد الدراسية التابعة له!`)) return;
    try {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;
      showToast('نجاح', 'تم حذف القسم بنجاح', 'success');
      fetchUnivDepartments(selectedUniv.id);
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف القسم', 'danger');
    }
  };

  // Course CRUD
  const createCourse = async (e) => {
    e.preventDefault();
    if (!selectedDept) return;
    try {
      const { error } = await supabase
        .from('courses')
        .insert({ 
          name: courseForm.name, 
          department_id: selectedDept.id,
          stage_id: courseForm.stage_id,
          units: parseFloat(courseForm.units) || 1,
          semester: courseForm.semester || 'الكورس الأول'
        });
      if (error) throw error;
      showToast('نجاح', 'تم إضافة المادة الدراسية بنجاح', 'success');
      setIsCourseModalOpen(false);
      setCourseForm({ name: '', stage_id: '', units: 1, semester: 'الكورس الأول' });
      fetchDeptCourses(selectedDept.id);
    } catch (err) {
      showToast('خطأ', err.message || 'فشل إضافة المادة', 'danger');
    }
  };

  const deleteCourse = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف المادة "${name}"؟`)) return;
    try {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) throw error;
      showToast('نجاح', 'تم حذف المادة بنجاح', 'success');
      fetchDeptCourses(selectedDept.id);
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف المادة', 'danger');
    }
  };

  return (
    <div className={styles.adminLayout}>
      <AdminSidebar activePage="universities" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>الجامعات والهياكل الأكاديمية</h1>
          <Button 
            onClick={() => {
              setUnivForm({ id: null, name: '', city: '' });
              setIsUnivModalOpen(true);
            }} 
            icon={Plus}
          >
            إضافة جامعة جديدة
          </Button>
        </div>

        {loading ? (
          <Skeleton height="300px" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' }}>
            
            {/* العمود الأيمن: قائمة الجامعات */}
            <div>
              <h2 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>
                <School size={20} />
                <span>الجامعات</span>
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {universities.map(univ => (
                  <div 
                    key={univ.id} 
                    onClick={() => handleUnivSelect(univ)}
                    className={`${styles.navLink} ${selectedUniv?.id === univ.id ? styles.navLinkActive : ''}`}
                    style={{ justifyContent: 'space-between', border: '1px solid var(--border)' }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{univ.name}</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{univ.city || 'المدينة غير محددة'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }} onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => {
                          setUnivForm({ id: univ.id, name: univ.name, city: univ.city });
                          setIsUnivModalOpen(true);
                        }}
                        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => deleteUniversity(univ.id, univ.name)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {universities.length === 0 && (
                  <div className={compStyles.emptyState} style={{ padding: '2rem 1rem' }}>
                    <span>لا توجد جامعات مضافة.</span>
                  </div>
                )}
              </div>
            </div>

            {/* العمود الأيسر: الأقسام والمواد */}
            {selectedUniv ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* 1. الكليات والأقسام */}
                <div className={styles.card} style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 className={styles.cardTitle} style={{ margin: 0 }}>
                      <Folder size={18} />
                      <span>الأقسام والكليات في "{selectedUniv.name}"</span>
                    </h3>
                    <Button 
                      variant="outline"
                      onClick={() => setIsDeptModalOpen(true)}
                      icon={PlusCircle}
                    >
                      إضافة قسم
                    </Button>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                    {departments.map(dept => (
                      <button
                        key={dept.id}
                        onClick={() => handleDeptSelect(dept)}
                        className={`${compStyles.btn} ${selectedDept?.id === dept.id ? compStyles.btnPrimary : compStyles.btnSecondary}`}
                        style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                      >
                        <span>{dept.name}</span>
                        <Trash2 
                          size={14} 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDepartment(dept.id, dept.name);
                          }}
                          style={{ cursor: 'pointer', color: selectedDept?.id === dept.id ? '#fff' : 'var(--danger)' }} 
                        />
                      </button>
                    ))}
                    {departments.length === 0 && (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>لا توجد كليات أو أقسام مضافة لهذه الجامعة بعد.</span>
                    )}
                  </div>

                  {/* 2. المواد الدراسية داخل القسم المختار */}
                  {selectedDept && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                        <h4 style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>المواد الدراسية لقسم ({selectedDept.name})</h4>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setCourseForm({ name: '', stage_id: stages[0]?.id || '', units: 1, semester: 'الكورس الأول' });
                            setIsCourseModalOpen(true);
                          }}
                          icon={PlusCircle}
                        >
                          إضافة مادة
                        </Button>
                      </div>

                      <Table>
                        <thead>
                          <Tr>
                            <Th>اسم المادة</Th>
                            <Th>المرحلة</Th>
                            <Th>الوحدات</Th>
                            <Th>الكورس</Th>
                            <Th style={{ width: '80px' }}>حذف</Th>
                          </Tr>
                        </thead>
                        <tbody>
                          {courses.map(course => (
                            <Tr key={course.id}>
                              <Td>{course.name}</Td>
                              <Td>{course.stages?.name || 'غير محدد'}</Td>
                              <Td>{course.units || 1}</Td>
                              <Td>{course.semester || 'الكورس الأول'}</Td>
                              <Td>
                                <button
                                  onClick={() => deleteCourse(course.id, course.name)}
                                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </Td>
                            </Tr>
                          ))}
                          {courses.length === 0 && (
                            <Tr>
                              <Td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                                لا توجد مواد دراسية في هذا القسم بعد. أضف مادة للبدء.
                              </Td>
                            </Tr>
                          )}
                        </tbody>
                      </Table>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className={compStyles.emptyState}>
                <School size={48} className={styles.emptyStateIcon} />
                <h4 className={styles.emptyStateTitle}>اختر جامعة</h4>
                <p className={styles.emptyStateText}>الرجاء اختيار جامعة من القائمة الجانبية أو إدخال جامعة جديدة لعرض تفاصيلها وهياكلها الأكاديمية.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* مودال حفظ الجامعة */}
      <Modal
        isOpen={isUnivModalOpen}
        onClose={() => setIsUnivModalOpen(false)}
        title={univForm.id ? 'تعديل بيانات الجامعة' : 'إضافة جامعة جديدة'}
      >
        <form onSubmit={saveUniversity}>
          <div className={compStyles.inputGroup}>
            <label className={compStyles.label}>اسم الجامعة</label>
            <input 
              type="text" 
              required
              className={compStyles.input}
              value={univForm.name}
              onChange={e => setUnivForm({ ...univForm, name: e.target.value })}
              placeholder="مثال: جامعة بغداد"
            />
          </div>
          <div className={compStyles.inputGroup}>
            <label className={compStyles.label}>المدينة</label>
            <input 
              type="text" 
              required
              className={compStyles.input}
              value={univForm.city}
              onChange={e => setUnivForm({ ...univForm, city: e.target.value })}
              placeholder="مثال: بغداد"
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Button variant="secondary" onClick={() => setIsUnivModalOpen(false)}>إلغاء</Button>
            <Button type="submit">حفظ</Button>
          </div>
        </form>
      </Modal>

      {/* مودال إضافة قسم */}
      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title={`إضافة قسم جديد في ${selectedUniv?.name}`}
      >
        <form onSubmit={createDepartment}>
          <div className={compStyles.inputGroup}>
            <label className={compStyles.label}>اسم القسم/الكلية</label>
            <input 
              type="text" 
              required
              className={compStyles.input}
              value={deptForm.name}
              onChange={e => setDeptForm({ name: e.target.value })}
              placeholder="مثال: هندسة الحاسوب، قسم الكيمياء..."
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Button variant="secondary" onClick={() => setIsDeptModalOpen(false)}>إلغاء</Button>
            <Button type="submit">إضافة</Button>
          </div>
        </form>
      </Modal>

      {/* مودال إضافة مادة */}
      <Modal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        title={`إضافة مادة دراسية لقسم ${selectedDept?.name}`}
      >
        <form onSubmit={createCourse} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={compStyles.inputGroup}>
            <label className={compStyles.label}>اسم المادة الدراسية</label>
            <input 
              type="text" 
              required
              className={compStyles.input}
              value={courseForm.name}
              onChange={e => setCourseForm({ ...courseForm, name: e.target.value })}
              placeholder="مثال: هياكل البيانات، الذكاء الاصطناعي..."
            />
          </div>
          
          <div className={compStyles.inputGroup}>
            <label className={compStyles.label}>المرحلة الدراسية</label>
            <select
              required
              className={compStyles.select}
              value={courseForm.stage_id}
              onChange={e => setCourseForm({ ...courseForm, stage_id: e.target.value })}
            >
              <option value="">اختر المرحلة</option>
              {stages.map(stg => (
                <option key={stg.id} value={stg.id}>{stg.name}</option>
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
              required
              className={compStyles.select}
              value={courseForm.semester}
              onChange={e => setCourseForm({ ...courseForm, semester: e.target.value })}
            >
              <option value="الكورس الأول">الكورس الأول</option>
              <option value="الكورس الثاني">الكورس الثاني</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <Button variant="secondary" type="button" onClick={() => setIsCourseModalOpen(false)}>إلغاء</Button>
            <Button type="submit">إضافة المادة</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
