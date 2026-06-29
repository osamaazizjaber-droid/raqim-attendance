import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Building, UserPlus, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Table, Tr, Th, Td } from '../../components/ui/Table';
import { Skeleton } from '../../components/ui/Skeleton';
import { UniversityAdminSidebar } from './Dashboard';
import styles from '../../styles/admin.module.css';
import compStyles from '../../styles/components.module.css';
import { useAuth } from '../../hooks/useAuth';

export default function UniversityAdminColleges() {
  const { showToast } = useToast();
  const { adminDetails } = useAuth();

  // States
  const [colleges, setColleges] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminsLoading, setAdminsLoading] = useState(false);

  // Modals state
  const [isCollegeModalOpen, setIsCollegeModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Form inputs
  const [collegeForm, setCollegeForm] = useState({ id: null, name: '' });
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    if (adminDetails?.university_id) {
      fetchColleges();
    }
  }, [adminDetails]);

  useEffect(() => {
    if (selectedCollege) {
      fetchCollegeAdmins(selectedCollege.id);
    } else {
      setAdmins([]);
    }
  }, [selectedCollege]);

  const fetchColleges = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('colleges')
        .select('*')
        .eq('university_id', adminDetails.university_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setColleges(data || []);

      if (data && data.length > 0) {
        setSelectedCollege(data[0]);
      }
    } catch (err) {
      showToast('خطأ', 'حدث خطأ أثناء تحميل الكليات', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchCollegeAdmins = async (collegeId) => {
    try {
      setAdminsLoading(true);
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('college_id', collegeId)
        .eq('role', 'college')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdmins(data || []);
    } catch (err) {
      showToast('خطأ', 'فشل تحميل مدراء الكلية', 'danger');
    } finally {
      setAdminsLoading(false);
    }
  };

  // College CRUD
  const saveCollege = async (e) => {
    e.preventDefault();
    try {
      if (collegeForm.id) {
        // Edit
        const { error } = await supabase
          .from('colleges')
          .update({ name: collegeForm.name })
          .eq('id', collegeForm.id);
        if (error) throw error;
        showToast('نجاح', 'تم تحديث اسم الكلية بنجاح', 'success');
      } else {
        // Create
        const { error } = await supabase
          .from('colleges')
          .insert({ 
            name: collegeForm.name, 
            university_id: adminDetails.university_id
          });
        if (error) throw error;
        showToast('نجاح', 'تم إضافة الكلية بنجاح', 'success');
      }
      setIsCollegeModalOpen(false);
      setCollegeForm({ id: null, name: '' });
      fetchColleges();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حفظ الكلية', 'danger');
    }
  };

  const deleteCollege = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف كلية "${name}"؟ سيتم حذف جميع الأقسام والمواد والأساتذة والطلاب وسجلات الحضور التابعة لها نهائياً!`)) return;
    try {
      const { error } = await supabase.from('colleges').delete().eq('id', id);
      if (error) throw error;
      showToast('نجاح', 'تم حذف الكلية بنجاح', 'success');
      fetchColleges();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف الكلية', 'danger');
    }
  };

  // Create College Admin Request
  const createCollegeAdmin = async (e) => {
    e.preventDefault();
    if (!selectedCollege) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_new_user', {
        p_email: adminForm.email,
        p_password: adminForm.password,
        p_name: adminForm.name,
        p_role: 'college',
        p_university_id: adminDetails.university_id,
        p_college_id: selectedCollege.id,
        p_subscription_expires_at: null
      });

      if (error) throw error;
      showToast('نجاح', 'تم إنشاء حساب مدير الكلية وتفعيله بنجاح', 'success');
      setIsAdminModalOpen(false);
      setAdminForm({ name: '', email: '', password: '' });
      fetchCollegeAdmins(selectedCollege.id);
    } catch (err) {
      showToast('خطأ في الإنشاء', err.message || 'فشل إنشاء حساب مدير الكلية', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const deleteAdmin = async (adminId, adminName) => {
    if (!window.confirm(`هل أنت متأكد من حذف حساب مدير الكلية "${adminName}"؟`)) return;
    try {
      const { error } = await supabase.from('admins').delete().eq('id', adminId);
      if (error) throw error;
      showToast('نجاح', 'تم حذف الحساب بنجاح', 'success');
      fetchCollegeAdmins(selectedCollege.id);
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف الحساب', 'danger');
    }
  };

  const openEditCollege = (college) => {
    setCollegeForm({
      id: college.id,
      name: college.name
    });
    setIsCollegeModalOpen(true);
  };

  return (
    <div className={styles.adminLayout}>
      <UniversityAdminSidebar activePage="colleges" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>إدارة الكليات ومدراء الكليات</h1>
          <Button onClick={() => { setCollegeForm({ id: null, name: '' }); setIsCollegeModalOpen(true); }}>
            <Plus size={18} />
            <span>إضافة كلية جديدة</span>
          </Button>
        </div>

        {loading ? (
          <div>
            <Skeleton height="200px" style={{ marginBottom: '2rem' }} />
            <Skeleton height="200px" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* قائمة الكليات */}
            <div className={styles.glass} style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>الكليات التابعة للجامعة</h2>
              {colleges.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  لا توجد كليات مضافة بعد. اضغط "إضافة كلية جديدة" للبدء.
                </div>
              ) : (
                <div className={compStyles.tableContainer}>
                  <Table>
                    <thead>
                      <Tr>
                        <Th>اسم الكلية</Th>
                        <Th>تاريخ الإنشاء</Th>
                        <Th>العمليات</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {colleges.map(college => (
                        <Tr key={college.id} className={selectedCollege?.id === college.id ? compStyles.rowSelected : ''} onClick={() => setSelectedCollege(college)} style={{ cursor: 'pointer' }}>
                          <Td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{college.name}</Td>
                          <Td>{new Date(college.created_at).toLocaleDateString('ar-EG')}</Td>
                          <Td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <Button size="icon" variant="secondary" onClick={() => openEditCollege(college)}>
                                <Edit size={16} />
                              </Button>
                              <Button size="icon" variant="danger" onClick={() => deleteCollege(college.id, college.name)}>
                                <Trash2 size={16} />
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

            {/* إدارة مدراء الكلية المختارة */}
            {selectedCollege && (
              <div className={styles.glass} style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>مدراء كلية {selectedCollege.name}</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>مدير الكلية له كامل الصلاحية في إدارة الأقسام والطلاب والأساتذة داخل هذه الكلية فقط.</span>
                  </div>
                  <Button onClick={() => setIsAdminModalOpen(true)}>
                    <UserPlus size={18} />
                    <span>إنشاء حساب مدير كلية</span>
                  </Button>
                </div>

                {adminsLoading ? (
                  <Skeleton height="120px" />
                ) : admins.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    لا يوجد حساب مدير لهذه الكلية حالياً. اضغط "إنشاء حساب مدير كلية" لتفعيل حساب.
                  </div>
                ) : (
                  <div className={compStyles.tableContainer}>
                    <Table>
                      <thead>
                        <Tr>
                          <Th>الاسم</Th>
                          <Th>البريد الإلكتروني</Th>
                          <Th>تاريخ الإنشاء</Th>
                          <Th>العمليات</Th>
                        </Tr>
                      </thead>
                      <tbody>
                        {admins.map(admin => (
                          <Tr key={admin.id}>
                            <Td style={{ fontWeight: '600' }}>{admin.name}</Td>
                            <Td>{admin.email}</Td>
                            <Td>{new Date(admin.created_at).toLocaleDateString('ar-EG')}</Td>
                            <Td>
                              <Button size="icon" variant="danger" onClick={() => deleteAdmin(admin.id, admin.name)}>
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

        {/* مودال الكلية */}
        <Modal isOpen={isCollegeModalOpen} onClose={() => setIsCollegeModalOpen(false)} title={collegeForm.id ? 'تعديل الكلية' : 'إضافة كلية جديدة'}>
          <form onSubmit={saveCollege} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>اسم الكلية</label>
              <input 
                type="text" 
                required
                className={compStyles.input}
                value={collegeForm.name}
                onChange={e => setCollegeForm({ ...collegeForm, name: e.target.value })}
                placeholder="كلية الهندسة مثلاً"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <Button type="button" variant="secondary" onClick={() => setIsCollegeModalOpen(false)}>إلغاء</Button>
              <Button type="submit">حفظ البيانات</Button>
            </div>
          </form>
        </Modal>

        {/* مودال إنشاء مدير الكلية */}
        <Modal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} title="إنشاء حساب مدير كلية">
          <form onSubmit={createCollegeAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>الاسم الثلاثي لمدير الكلية</label>
              <input 
                type="text" 
                required
                className={compStyles.input}
                value={adminForm.name}
                onChange={e => setAdminForm({ ...adminForm, name: e.target.value })}
                placeholder="الاسم الكامل للمسؤول"
              />
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>البريد الإلكتروني</label>
              <input 
                type="email" 
                required
                className={compStyles.input}
                value={adminForm.email}
                onChange={e => setAdminForm({ ...adminForm, email: e.target.value })}
                placeholder="name@college.edu"
              />
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>كلمة المرور</label>
              <input 
                type="password" 
                required
                className={compStyles.input}
                value={adminForm.password}
                onChange={e => setAdminForm({ ...adminForm, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <Button type="button" variant="secondary" onClick={() => setIsAdminModalOpen(false)}>إلغاء</Button>
              <Button type="submit">إنشاء وتفعيل الحساب</Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
