import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Key, BookOpen, UserPlus, Calendar, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Table, Tr, Th, Td } from '../../components/ui/Table';
import { Skeleton } from '../../components/ui/Skeleton';
import { CollegeAdminSidebar } from './Dashboard';
import styles from '../../styles/admin.module.css';
import compStyles from '../../styles/components.module.css';
import { useAuth } from '../../hooks/useAuth';

export default function CollegeAdminProfessors() {
  const { showToast } = useToast();
  const { adminDetails } = useAuth();

  // States
  const [professors, setProfessors] = useState([]);
  const [selectedProf, setSelectedProf] = useState(null);
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    subscription_expires_at: ''
  });
  const [renewDate, setRenewDate] = useState('');
  const [courseForm, setCourseForm] = useState({
    dept_id: '',
    course_id: ''
  });
  
  // Dropdown lists
  const [departments, setDepartments] = useState([]);
  const [departmentCourses, setDepartmentCourses] = useState([]);

  useEffect(() => {
    if (adminDetails?.college_id) {
      fetchInitialData();
    }
  }, [adminDetails]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // Fetch Professors in this college
      const { data: profs, error: pErr } = await supabase
        .from('professors')
        .select('*')
        .eq('college_id', adminDetails.college_id)
        .order('created_at', { ascending: false });
      if (pErr) throw pErr;
      setProfessors(profs || []);

      // Fetch Departments in this college
      const { data: depts, error: dErr } = await supabase
        .from('departments')
        .select('*')
        .eq('college_id', adminDetails.college_id)
        .order('name', { ascending: true });
      if (dErr) throw dErr;
      setDepartments(depts || []);

      if (profs && profs.length > 0) {
        setSelectedProf(profs[0]);
        await fetchAssignedCourses(profs[0].id);
      }
    } catch (err) {
      showToast('خطأ', 'فشل تحميل البيانات', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedCourses = async (profId) => {
    try {
      const { data, error } = await supabase
        .from('professor_courses')
        .select('id, courses(id, name, departments(name), stages(name))')
        .eq('professor_id', profId);

      if (error) throw error;
      setAssignedCourses(data || []);
    } catch (err) {
      showToast('خطأ', 'فشل تحميل المواد المسندة للأستاذ', 'danger');
    }
  };

  const handleProfSelect = async (prof) => {
    setSelectedProf(prof);
    await fetchAssignedCourses(prof.id);
  };

  // Fetch courses when department changes in course assignment modal
  const handleDeptChange = async (deptId) => {
    setCourseForm(prev => ({ ...prev, dept_id: deptId, course_id: '' }));
    if (!deptId) {
      setDepartmentCourses([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('department_id', deptId)
        .order('name', { ascending: true });

      if (error) throw error;
      setDepartmentCourses(data || []);
    } catch (err) {
      showToast('خطأ', 'فشل تحميل المواد الدراسية', 'danger');
    }
  };

  // Create Professor request directly via RPC
  const handleCreateProfessor = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('create_new_user', {
        p_email: createForm.email,
        p_password: createForm.password,
        p_name: createForm.name,
        p_role: 'professor',
        p_college_id: adminDetails.college_id,
        p_subscription_expires_at: createForm.subscription_expires_at
      });

      if (error) throw error;

      showToast('نجاح', 'تم إنشاء حساب الأستاذ وتفعيله بنجاح', 'success');
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', email: '', password: '', subscription_expires_at: '' });
      fetchInitialData();
    } catch (err) {
      showToast('خطأ في الإنشاء', err.message || 'فشل إنشاء حساب الأستاذ', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Renew subscription
  const handleRenewSubscription = async (e) => {
    e.preventDefault();
    if (!selectedProf) return;
    try {
      const { error } = await supabase
        .from('professors')
        .update({ subscription_expires_at: renewDate })
        .eq('id', selectedProf.id);

      if (error) throw error;

      showToast('نجاح', 'تم تجديد الاشتراك بنجاح', 'success');
      setIsRenewModalOpen(false);
      
      setProfessors(prev => prev.map(p => p.id === selectedProf.id ? { ...p, subscription_expires_at: renewDate } : p));
      setSelectedProf(prev => ({ ...prev, subscription_expires_at: renewDate }));
    } catch (err) {
      showToast('خطأ', err.message || 'فشل تجديد الاشتراك', 'danger');
    }
  };

  // Assign course to professor
  const handleAssignCourse = async (e) => {
    e.preventDefault();
    if (!selectedProf || !courseForm.course_id) return;
    try {
      const { error } = await supabase
        .from('professor_courses')
        .insert({
          professor_id: selectedProf.id,
          course_id: courseForm.course_id
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('هذه المادة مسندة بالفعل لهذا الأستاذ.');
        }
        throw error;
      }

      showToast('نجاح', 'تم إسناد المادة للأستاذ بنجاح', 'success');
      setIsCourseModalOpen(false);
      setCourseForm({ dept_id: '', course_id: '' });
      setDepartmentCourses([]);
      fetchAssignedCourses(selectedProf.id);
    } catch (err) {
      showToast('خطأ في الإسناد', err.message || 'فشل إسناد المادة', 'danger');
    }
  };

  // Unassign course
  const handleUnassignCourse = async (assignmentId) => {
    if (!window.confirm('هل أنت متأكد من إلغاء إسناد هذه المادة عن الأستاذ؟')) return;
    try {
      const { error } = await supabase
        .from('professor_courses')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      showToast('نجاح', 'تم إلغاء إسناد المادة بنجاح', 'success');
      fetchAssignedCourses(selectedProf.id);
    } catch (err) {
      showToast('خطأ', 'فشل إلغاء إسناد المادة', 'danger');
    }
  };

  const isProfExpired = (expiryDate) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    return expiry < today;
  };

  return (
    <div className={styles.adminLayout}>
      <CollegeAdminSidebar activePage="professors" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>إدارة الأساتذة وتفويض المواد</h1>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={18} />
            <span>إضافة أستاذ جديد</span>
          </Button>
        </div>

        {loading ? (
          <div>
            <Skeleton height="200px" style={{ marginBottom: '2rem' }} />
            <Skeleton height="200px" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* قائمة الأساتذة */}
            <div className={styles.glass} style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>أعضاء الهيئة التدريسية</h2>
              {professors.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  لا يوجد أساتذة مسجلين بالكلية بعد.
                </div>
              ) : (
                <div className={compStyles.tableContainer}>
                  <Table>
                    <thead>
                      <Tr>
                        <Th>الاسم</Th>
                        <Th>البريد الإلكتروني</Th>
                        <Th>حالة الاشتراك</Th>
                        <Th>تاريخ انتهاء الاشتراك</Th>
                        <Th>العمليات</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {professors.map(prof => (
                        <Tr key={prof.id} className={selectedProf?.id === prof.id ? compStyles.rowSelected : ''} onClick={() => handleProfSelect(prof)} style={{ cursor: 'pointer' }}>
                          <Td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{prof.name}</Td>
                          <Td>{prof.email}</Td>
                          <Td>
                            {isProfExpired(prof.subscription_expires_at) ? (
                              <Badge variant="danger">منتهي ⚠️</Badge>
                            ) : (
                              <Badge variant="success">فعال ✅</Badge>
                            )}
                          </Td>
                          <Td>{prof.subscription_expires_at}</Td>
                          <Td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <Button size="sm" variant="secondary" onClick={() => { setSelectedProf(prof); setRenewDate(prof.subscription_expires_at); setIsRenewModalOpen(true); }}>
                                <Calendar size={14} />
                                <span>تجديد</span>
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

            {/* المواد المسندة للأستاذ المختار */}
            {selectedProf && (
              <div className={styles.glass} style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>المواد المسندة للأستاذ: {selectedProf.name}</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>يستطيع الأستاذ تسجيل الحضور وتوليد تقارير لهذه المواد فقط.</span>
                  </div>
                  <Button size="sm" onClick={() => setIsCourseModalOpen(true)}>
                    <BookOpen size={16} />
                    <span>إسناد مادة جديدة</span>
                  </Button>
                </div>

                {assignedCourses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    لا توجد مواد مسندة لهذا الأستاذ حالياً.
                  </div>
                ) : (
                  <div className={compStyles.tableContainer}>
                    <Table>
                      <thead>
                        <Tr>
                          <Th>اسم المادة</Th>
                          <Th>القسم</Th>
                          <Th>المرحلة</Th>
                          <Th>العمليات</Th>
                        </Tr>
                      </thead>
                      <tbody>
                        {assignedCourses.map(ac => (
                          <Tr key={ac.id}>
                            <Td style={{ fontWeight: '600' }}>{ac.courses?.name}</Td>
                            <Td>{ac.courses?.departments?.name}</Td>
                            <Td>{ac.courses?.stages?.name}</Td>
                            <Td>
                              <Button size="icon" variant="danger" onClick={() => handleUnassignCourse(ac.id)}>
                                <Trash2 size={16} />
                              </Button>
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* مودال إنشاء أستاذ */}
        <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="إضافة أستاذ جديد">
          <form onSubmit={handleCreateProfessor} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>الاسم الثلاثي للأستاذ</label>
              <input 
                type="text" 
                required
                className={compStyles.input}
                value={createForm.name}
                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="الاسم الثلاثي"
              />
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>البريد الإلكتروني (المستخدم للدخول)</label>
              <input 
                type="email" 
                required
                className={compStyles.input}
                value={createForm.email}
                onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="prof@college.edu"
              />
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>كلمة مرور الحساب</label>
              <input 
                type="password" 
                required
                className={compStyles.input}
                value={createForm.password}
                onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>تاريخ انتهاء اشتراك الأستاذ</label>
              <input 
                type="date" 
                required
                className={compStyles.input}
                value={createForm.subscription_expires_at}
                onChange={e => setCreateForm({ ...createForm, subscription_expires_at: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>إلغاء</Button>
              <Button type="submit">إنشاء وتفعيل الحساب</Button>
            </div>
          </form>
        </Modal>

        {/* مودال تجديد الاشتراك */}
        <Modal isOpen={isRenewModalOpen} onClose={() => setIsRenewModalOpen(false)} title="تجديد اشتراك الأستاذ">
          <form onSubmit={handleRenewSubscription} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>تاريخ انتهاء الاشتراك الجديد</label>
              <input 
                type="date" 
                required
                className={compStyles.input}
                value={renewDate}
                onChange={e => setRenewDate(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <Button type="button" variant="secondary" onClick={() => setIsRenewModalOpen(false)}>إلغاء</Button>
              <Button type="submit">تجديد الاشتراك</Button>
            </div>
          </form>
        </Modal>

        {/* مودال إسناد المادة */}
        <Modal isOpen={isCourseModalOpen} onClose={() => setIsCourseModalOpen(false)} title="إسناد مادة للأستاذ">
          <form onSubmit={handleAssignCourse} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>القسم العلمي</label>
              <select 
                className={compStyles.input}
                value={courseForm.dept_id}
                onChange={e => handleDeptChange(e.target.value)}
                required
              >
                <option value="">اختر القسم</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>المادة الدراسية</label>
              <select 
                className={compStyles.input}
                value={courseForm.course_id}
                onChange={e => setCourseForm({ ...courseForm, course_id: e.target.value })}
                required
                disabled={!courseForm.dept_id}
              >
                <option value="">اختر المادة</option>
                {departmentCourses.map(crs => (
                  <option key={crs.id} value={crs.id}>{crs.name} ({crs.units} وحدة)</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <Button type="button" variant="secondary" onClick={() => setIsCourseModalOpen(false)}>إلغاء</Button>
              <Button type="submit">إسناد المادة</Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
