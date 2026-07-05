import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Key, BookOpen, UserPlus, Calendar, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Table, Tr, Th, Td } from '../../components/ui/Table';
import { Skeleton } from '../../components/ui/Skeleton';
import { AdminSidebar } from './Dashboard';
import styles from '../../styles/admin.module.css';
import compStyles from '../../styles/components.module.css';

export default function AdminProfessors() {
  const { showToast } = useToast();

  // States
  const [professors, setProfessors] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [selectedProf, setSelectedProf] = useState(null);
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
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
    university_id: '',
    subscription_expires_at: ''
  });
  const [renewDate, setRenewDate] = useState('');
  const [courseForm, setCourseForm] = useState({
    univ_id: '',
    dept_id: '',
    course_id: ''
  });
  
  // Secondary dropdown selections for course assignment
  const [formDepts, setFormDepts] = useState([]);
  const [formCourses, setFormCourses] = useState([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // Fetch Professors
      const { data: profs, error: pErr } = await supabase
        .from('professors')
        .select('*, universities(name)')
        .order('created_at', { ascending: false });
      if (pErr) throw pErr;
      setProfessors(profs || []);

      // Fetch Universities
      const { data: univs, error: uErr } = await supabase
        .from('universities')
        .select('*')
        .order('name', { ascending: true });
      if (uErr) throw uErr;
      setUniversities(univs || []);

    } catch (err) {
      showToast('خطأ', 'فشل تحميل بيانات الأساتذة والجامعات', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Fetch courses assigned to a specific professor
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

  // Create Professor (using secure PostgreSQL RPC)
  const handleCreateProfessor = async (e) => {
    e.preventDefault();
    setLoading(true);
    let requestRecord = null;
    
    try {
      // 1. إدراج طلب إنشاء الأستاذ في طابور العمليات بقاعدة البيانات
      const { data: request, error: insertError } = await supabase
        .from('professor_creation_requests')
        .insert({
          email: createForm.email,
          password: createForm.password,
          name: createForm.name,
          university_id: createForm.university_id,
          subscription_expires_at: createForm.subscription_expires_at
        })
        .select()
        .single();

      if (insertError) throw insertError;
      requestRecord = request;

      // 2. الاستماع اللحظي لحالة الطلب حتى يكتمل أو يفشل
      let channel;
      
      const waitForCompletion = () => new Promise((resolve, reject) => {
        // مؤقت أمان لمدة 15 ثانية للتنبيه في حال توقف البوت
        const timeout = setTimeout(() => {
          if (channel) supabase.removeChannel(channel);
          reject(new Error('انتهت مهلة الانتظار. يرجى التأكد من تشغيل خادم البوت (bot) في الخلفية.'));
        }, 15000);

        channel = supabase
          .channel(`request_${request.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'professor_creation_requests',
              filter: `id=eq.${request.id}`
            },
            (payload) => {
              const updated = payload.new;
              if (updated.status === 'completed') {
                clearTimeout(timeout);
                supabase.removeChannel(channel);
                resolve();
              } else if (updated.status === 'failed') {
                clearTimeout(timeout);
                supabase.removeChannel(channel);
                reject(new Error(updated.error_message || 'فشل إنشاء الحساب لأسباب مجهولة'));
              }
            }
          )
          .subscribe();
      });

      await waitForCompletion();

      // 3. تنظيف الطلب بعد اكتماله بنجاح
      await supabase.from('professor_creation_requests').delete().eq('id', request.id);

      showToast('نجاح', 'تم إنشاء حساب الأستاذ وربطه بقاعدة البيانات بنجاح', 'success');
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', email: '', password: '', university_id: '', subscription_expires_at: '' });
      fetchInitialData();
    } catch (err) {
      showToast('خطأ في الإنشاء', err.message || 'فشل إنشاء حساب الأستاذ', 'danger');
      // تنظيف في حال حدوث خطأ
      if (requestRecord) {
        await supabase.from('professor_creation_requests').delete().eq('id', requestRecord.id).catch(() => {});
      }
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
      
      // Update local state
      setProfessors(prev => prev.map(p => p.id === selectedProf.id ? { ...p, subscription_expires_at: renewDate } : p));
      setSelectedProf(prev => ({ ...prev, subscription_expires_at: renewDate }));
    } catch (err) {
      showToast('خطأ', err.message || 'فشل تحديث تاريخ الاشتراك', 'danger');
    }
  };

  // Delete Professor
  const handleDeleteProfessor = async (prof) => {
    if (!window.confirm(`هل أنت متأكد من حذف حساب الأستاذ "${prof.name}"؟ سيتم حذف حسابه من جدول المصادقة (Auth) وكافة جلسات الحضور التابعة له نهائياً!`)) return;
    try {
      const { error } = await supabase.rpc('delete_professor_user', {
        p_professor_id: prof.id
      });

      if (error) throw error;

      showToast('نجاح', 'تم حذف حساب الأستاذ وجميع بياناته بنجاح', 'success');
      if (selectedProf?.id === prof.id) {
        setSelectedProf(null);
        setAssignedCourses([]);
      }
      fetchInitialData();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف الأستاذ', 'danger');
    }
  };

  // Manage Course Assignment Dropdowns
  const handleAssignmentUnivChange = async (univId) => {
    setCourseForm(prev => ({ ...prev, univ_id: univId, dept_id: '', course_id: '' }));
    setFormCourses([]);
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('university_id', univId)
        .order('name', { ascending: true });
      if (error) throw error;
      setFormDepts(data || []);
    } catch (err) {
      showToast('خطأ', 'فشل جلب الأقسام', 'danger');
    }
  };

  const handleAssignmentDeptChange = async (deptId) => {
    setCourseForm(prev => ({ ...prev, dept_id: deptId, course_id: '' }));
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*, stages(name)')
        .eq('department_id', deptId)
        .order('name', { ascending: true });
      if (error) throw error;
      setFormCourses(data || []);
    } catch (err) {
      showToast('خطأ', 'فشل جلب المواد الدراسية', 'danger');
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
          throw new Error('هذه المادة مسندة للأستاذ مسبقاً!');
        }
        throw error;
      }

      showToast('نجاح', 'تم إسناد المادة للأستاذ بنجاح', 'success');
      setIsCourseModalOpen(false);
      setCourseForm({ univ_id: '', dept_id: '', course_id: '' });
      fetchAssignedCourses(selectedProf.id);
    } catch (err) {
      showToast('خطأ', err.message || 'فشل إسناد المادة', 'danger');
    }
  };

  // Unassign course
  const handleUnassignCourse = async (assignmentId, courseName) => {
    if (!window.confirm(`هل أنت متأكد من إلغاء إسناد مادة "${courseName}" من هذا الأستاذ؟`)) return;
    try {
      const { error } = await supabase
        .from('professor_courses')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
      showToast('نجاح', 'تم إلغاء إسناد المادة بنجاح', 'success');
      fetchAssignedCourses(selectedProf.id);
    } catch (err) {
      showToast('خطأ', err.message || 'فشل إلغاء إسناد المادة', 'danger');
    }
  };

  // إلغاء ربط تيليجرام للأستاذ
  const handleUnlinkTelegram = async () => {
    if (!selectedProf) return;
    if (!window.confirm(`هل أنت متأكد من إلغاء ربط حساب التيليجرام للأستاذ "${selectedProf.name}"؟`)) return;
    try {
      const { error } = await supabase
        .from('professors')
        .update({ telegram_chat_id: null })
        .eq('id', selectedProf.id);

      if (error) throw error;

      // تحديث الحالة المحلية
      setProfessors(prev => prev.map(p => p.id === selectedProf.id ? { ...p, telegram_chat_id: null } : p));
      setSelectedProf(prev => ({ ...prev, telegram_chat_id: null }));
      showToast('نجاح', 'تم إلغاء ربط حساب التيليجرام للأستاذ بنجاح', 'success');
    } catch (err) {
      showToast('خطأ', 'فشل إلغاء ربط التيليجرام للأستاذ', 'danger');
    }
  };

  // Helper to format subscription state
  const getSubscriptionBadge = (dateStr) => {
    const expiry = new Date(dateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    expiry.setHours(0,0,0,0);

    if (expiry < today) {
      return <Badge variant="danger">منتهي الصلاحية ❌</Badge>;
    }
    return <Badge variant="success">نشط ✅</Badge>;
  };

  return (
    <div className={styles.adminLayout}>
      <AdminSidebar activePage="professors" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>إدارة الأساتذة والاشتراكات</h1>
          <Button 
            onClick={() => setIsCreateModalOpen(true)} 
            icon={UserPlus}
          >
            إضافة أستاذ جديد
          </Button>
        </div>

        {loading ? (
          <Skeleton height="350px" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem' }}>
            
            {/* الجدول الرئيسي للأساتذة */}
            <div>
              <Table>
                <thead>
                  <Tr>
                    <Th>الاسم</Th>
                    <Th>البريد الإلكتروني</Th>
                    <Th>الجامعة</Th>
                    <Th>تاريخ انتهاء الاشتراك</Th>
                    <Th>حالة الاشتراك</Th>
                    <Th style={{ width: '80px' }}>حذف</Th>
                  </Tr>
                </thead>
                <tbody>
                  {professors.map(prof => (
                    <Tr 
                      key={prof.id} 
                      onClick={() => handleProfSelect(prof)}
                      style={{ cursor: 'pointer', backgroundColor: selectedProf?.id === prof.id ? 'rgba(59, 130, 246, 0.05)' : '' }}
                    >
                      <Td style={{ fontWeight: 'bold' }}>{prof.name}</Td>
                      <Td>{prof.email}</Td>
                      <Td>{prof.universities?.name || '-'}</Td>
                      <Td>{prof.subscription_expires_at}</Td>
                      <Td>{getSubscriptionBadge(prof.subscription_expires_at)}</Td>
                      <Td onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleDeleteProfessor(prof)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </Td>
                    </Tr>
                  ))}
                  {professors.length === 0 && (
                    <Tr>
                      <Td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                        لا يوجد أساتذة مسجلين في النظام حالياً.
                      </Td>
                    </Tr>
                  )}
                </tbody>
              </Table>
            </div>

            {/* تفاصيل الأستاذ المختار وإسناد المواد */}
            <div>
              {selectedProf ? (
                <div className={styles.card} style={{ margin: 0 }}>
                  <h3 className={styles.cardTitle}>
                    <ShieldCheck size={20} />
                    <span>ملف الأستاذ: {selectedProf.name}</span>
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <div><strong>البريد الإلكتروني:</strong> {selectedProf.email}</div>
                    <div><strong>الجامعة الحالية:</strong> {selectedProf.universities?.name || '-'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                      <span><strong>تاريخ انتهاء الاشتراك:</strong> {selectedProf.subscription_expires_at}</span>
                      <button
                        onClick={() => {
                          setRenewDate(selectedProf.subscription_expires_at);
                          setIsRenewModalOpen(true);
                        }}
                        className={`${compStyles.btn} ${compStyles.btnOutline}`}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                      >
                        تعديل / تجديد
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                      <span>
                        <strong>حساب تيليجرام:</strong>{' '}
                        {selectedProf.telegram_chat_id ? (
                          <Badge variant="success">مرتبط ✅</Badge>
                        ) : (
                          <Badge variant="danger">غير مرتبط ❌</Badge>
                        )}
                      </span>
                      {selectedProf.telegram_chat_id && (
                        <button
                          onClick={handleUnlinkTelegram}
                          className={`${compStyles.btn} ${compStyles.btnOutline}`}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                        >
                          إلغاء الربط
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BookOpen size={16} />
                        <span>المواد المسندة إليه ({assignedCourses.length})</span>
                      </h4>
                      <button
                        onClick={() => setIsCourseModalOpen(true)}
                        className={`${compStyles.btn} ${compStyles.btnOutline}`}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                      >
                        إسناد مادة
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {assignedCourses.map(ac => (
                        <div 
                          key={ac.id} 
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.5rem 0.75rem',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.85rem'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{ac.courses?.name}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                              {ac.courses?.departments?.name} | {ac.courses?.stages?.name}
                            </div>
                          </div>
                          <button
                            onClick={() => handleUnassignCourse(ac.id, ac.courses?.name)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      {assignedCourses.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          لم يتم إسناد أي مواد دراسية لهذا الأستاذ بعد.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={compStyles.emptyState}>
                  <BookOpen size={48} className={styles.emptyStateIcon} />
                  <h4 className={styles.emptyStateTitle}>اختر أستاذًا</h4>
                  <p className={styles.emptyStateText}>الرجاء اختيار أستاذ من الجدول لمشاهدة تفاصيل ملفه وإسناد المواد الأكاديمية له وتجديد اشتراكه.</p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* مودال إنشاء أستاذ */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="إنشاء حساب أستاذ جديد"
      >
        <form onSubmit={handleCreateProfessor}>
          <div className={compStyles.inputGroup}>
            <label className={compStyles.label}>الاسم الكامل للأستاذ</label>
            <input 
              type="text" 
              required
              className={compStyles.input}
              value={createForm.name}
              onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="مثال: أ.د. أحمد عبد الرحمن"
            />
          </div>

          <div className={compStyles.inputGroup}>
            <label className={compStyles.label}>البريد الإلكتروني</label>
            <input 
              type="email" 
              required
              className={compStyles.input}
              value={createForm.email}
              onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="ahmed@university.edu"
            />
          </div>

          <div className={compStyles.inputGroup}>
            <label className={compStyles.label}>كلمة المرور المؤقتة</label>
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
            <label className={compStyles.label}>الجامعة التابع لها</label>
            <select
              required
              className={compStyles.select}
              value={createForm.university_id}
              onChange={e => setCreateForm({ ...createForm, university_id: e.target.value })}
            >
              <option value="">اختر الجامعة</option>
              {universities.map(univ => (
                <option key={univ.id} value={univ.id}>{univ.name}</option>
              ))}
            </select>
          </div>

          <div className={compStyles.inputGroup}>
            <label className={compStyles.label}>تاريخ انتهاء الاشتراك</label>
            <input 
              type="date" 
              required
              className={compStyles.input}
              value={createForm.subscription_expires_at}
              onChange={e => setCreateForm({ ...createForm, subscription_expires_at: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>إلغاء</Button>
            <Button type="submit">تأكيد وإنشاء</Button>
          </div>
        </form>
      </Modal>

      {/* مودال تجديد الاشتراك */}
      <Modal
        isOpen={isRenewModalOpen}
        onClose={() => setIsRenewModalOpen(false)}
        title={`تعديل اشتراك: ${selectedProf?.name}`}
      >
        <form onSubmit={handleRenewSubscription}>
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
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Button variant="secondary" onClick={() => setIsRenewModalOpen(false)}>إلغاء</Button>
            <Button type="submit">حفظ وتجديد</Button>
          </div>
        </form>
      </Modal>

      {/* مودال إسناد مادة للأستاذ */}
      <Modal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        title={`إسناد مادة أكاديمية للأستاذ ${selectedProf?.name}`}
      >
        <form onSubmit={handleAssignCourse}>
          <div className={compStyles.inputGroup}>
            <label className={compStyles.label}>الجامعة</label>
            <select
              required
              className={compStyles.select}
              value={courseForm.univ_id}
              onChange={e => handleAssignmentUnivChange(e.target.value)}
            >
              <option value="">اختر الجامعة</option>
              {universities.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className={compStyles.inputGroup}>
            <label className={compStyles.label}>القسم / الكلية</label>
            <select
              required
              disabled={!courseForm.univ_id}
              className={compStyles.select}
              value={courseForm.dept_id}
              onChange={e => handleAssignmentDeptChange(e.target.value)}
            >
              <option value="">اختر القسم</option>
              {formDepts.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className={compStyles.inputGroup}>
            <label className={compStyles.label}>المادة الدراسية</label>
            <select
              required
              disabled={!courseForm.dept_id}
              className={compStyles.select}
              value={courseForm.course_id}
              onChange={e => setCourseForm(prev => ({ ...prev, course_id: e.target.value }))}
            >
              <option value="">اختر المادة</option>
              {formCourses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.stages?.name || 'مرحلة غير محددة'}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Button variant="secondary" onClick={() => setIsCourseModalOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={!courseForm.course_id}>إسناد المادة</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
