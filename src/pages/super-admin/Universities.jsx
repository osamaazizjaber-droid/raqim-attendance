import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, School, UserPlus, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Table, Tr, Th, Td } from '../../components/ui/Table';
import { Skeleton } from '../../components/ui/Skeleton';
import { SuperAdminSidebar } from './Dashboard';
import styles from '../../styles/admin.module.css';
import compStyles from '../../styles/components.module.css';

export default function SuperAdminUniversities() {
  const { showToast } = useToast();

  // States
  const [universities, setUniversities] = useState([]);
  const [selectedUniv, setSelectedUniv] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminsLoading, setAdminsLoading] = useState(false);

  // Modals state
  const [isUnivModalOpen, setIsUnivModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Form inputs
  const [univForm, setUnivForm] = useState({ id: null, name: '', city: '', subscription_expires_at: '' });
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    fetchUniversities();
  }, []);

  useEffect(() => {
    if (selectedUniv) {
      fetchUniversityAdmins(selectedUniv.id);
    } else {
      setAdmins([]);
    }
  }, [selectedUniv]);

  const fetchUniversities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('universities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUniversities(data || []);

      if (data && data.length > 0) {
        setSelectedUniv(data[0]);
      }
    } catch (err) {
      showToast('خطأ', 'حدث خطأ أثناء تحميل الجامعات', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchUniversityAdmins = async (univId) => {
    try {
      setAdminsLoading(true);
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('university_id', univId)
        .eq('role', 'university')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdmins(data || []);
    } catch (err) {
      showToast('خطأ', 'فشل تحميل مدراء الجامعة', 'danger');
    } finally {
      setAdminsLoading(false);
    }
  };

  // University CRUD
  const saveUniversity = async (e) => {
    e.preventDefault();
    try {
      if (univForm.id) {
        // Edit
        const { error } = await supabase
          .from('universities')
          .update({ 
            name: univForm.name, 
            city: univForm.city, 
            subscription_expires_at: univForm.subscription_expires_at 
          })
          .eq('id', univForm.id);
        if (error) throw error;
        showToast('نجاح', 'تم تحديث بيانات الجامعة بنجاح', 'success');
      } else {
        // Create
        const { error } = await supabase
          .from('universities')
          .insert({ 
            name: univForm.name, 
            city: univForm.city, 
            subscription_expires_at: univForm.subscription_expires_at || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]
          });
        if (error) throw error;
        showToast('نجاح', 'تم إضافة الجامعة بنجاح', 'success');
      }
      setIsUnivModalOpen(false);
      setUnivForm({ id: null, name: '', city: '', subscription_expires_at: '' });
      fetchUniversities();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حفظ الجامعة', 'danger');
    }
  };

  const deleteUniversity = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف جامعة "${name}"؟ سيتم حذف جميع كلياتها وأساتذتها وطلابها وسجلات حضورهم نهائياً!`)) return;
    try {
      const { error } = await supabase.from('universities').delete().eq('id', id);
      if (error) throw error;
      showToast('نجاح', 'تم حذف الجامعة بنجاح', 'success');
      fetchUniversities();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف الجامعة', 'danger');
    }
  };

  // Create University Admin Request
  const createUniversityAdmin = async (e) => {
    e.preventDefault();
    if (!selectedUniv) return;
    try {
      showToast('جاري الطلب', 'يتم إرسال طلب إنشاء الحساب لبوت التفعيل الحين...', 'info');
      const { error } = await supabase
        .from('user_creation_requests')
        .insert({
          email: adminForm.email,
          password: adminForm.password,
          name: adminForm.name,
          role: 'university',
          university_id: selectedUniv.id,
          college_id: null
        });

      if (error) throw error;
      showToast('تم إرسال الطلب ✅', 'سيقوم البوت بإنشاء حساب المدير بالخلفية وتفعيله فوراً.', 'success');
      setIsAdminModalOpen(false);
      setAdminForm({ name: '', email: '', password: '' });
      
      // انتظار بضع ثوانٍ ثم تحديث القائمة
      setTimeout(() => {
        if (selectedUniv) fetchUniversityAdmins(selectedUniv.id);
      }, 3500);

    } catch (err) {
      showToast('خطأ', err.message || 'فشل إرسال طلب إنشاء حساب المدير', 'danger');
    }
  };

  const deleteAdmin = async (adminId, adminName) => {
    if (!window.confirm(`هل أنت متأكد من حذف حساب المدير "${adminName}"؟`)) return;
    try {
      const { error } = await supabase.from('admins').delete().eq('id', adminId);
      if (error) throw error;
      showToast('نجاح', 'تم حذف الحساب بنجاح', 'success');
      fetchUniversityAdmins(selectedUniv.id);
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف الحساب', 'danger');
    }
  };

  const openEditUniv = (univ) => {
    setUnivForm({
      id: univ.id,
      name: univ.name,
      city: univ.city || '',
      subscription_expires_at: univ.subscription_expires_at || ''
    });
    setIsUnivModalOpen(true);
  };

  return (
    <div className={styles.adminLayout}>
      <SuperAdminSidebar activePage="universities" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>إدارة الجامعات والاشتراكات</h1>
          <Button onClick={() => { setUnivForm({ id: null, name: '', city: '', subscription_expires_at: '' }); setIsUnivModalOpen(true); }}>
            <Plus size={18} />
            <span>إضافة جامعة جديدة</span>
          </Button>
        </div>

        {loading ? (
          <div>
            <Skeleton height="200px" style={{ marginBottom: '2rem' }} />
            <Skeleton height="200px" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* قائمة الجامعات */}
            <div className={styles.glass} style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>الجامعات المسجلة</h2>
              {universities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  لا توجد جامعات مضافة بعد. اضغط "إضافة جامعة جديدة" للبدء.
                </div>
              ) : (
                <div className={compStyles.tableContainer}>
                  <Table>
                    <thead>
                      <Tr>
                        <Th>اسم الجامعة</Th>
                        <Th>المدينة</Th>
                        <Th>تاريخ انتهاء الاشتراك</Th>
                        <Th>العمليات</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {universities.map(univ => (
                        <Tr key={univ.id} className={selectedUniv?.id === univ.id ? compStyles.rowSelected : ''} onClick={() => setSelectedUniv(univ)} style={{ cursor: 'pointer' }}>
                          <Td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{univ.name}</Td>
                          <Td>{univ.city || '-'}</Td>
                          <Td style={{ color: new Date(univ.subscription_expires_at) < new Date() ? 'var(--danger)' : 'var(--success)' }}>
                            {univ.subscription_expires_at}
                            {new Date(univ.subscription_expires_at) < new Date() && ' (منتهي ⚠️)'}
                          </Td>
                          <Td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <Button size="icon" variant="secondary" onClick={() => openEditUniv(univ)}>
                                <Edit size={16} />
                              </Button>
                              <Button size="icon" variant="danger" onClick={() => deleteUniversity(univ.id, univ.name)}>
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

            {/* إدارة مدراء الجامعة المختارة */}
            {selectedUniv && (
              <div className={styles.glass} style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>مدراء جامعة {selectedUniv.name}</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>يمكن للمدير إدارة الكليات وإنشاء مدراء الكليات لهذه الجامعة.</span>
                  </div>
                  <Button onClick={() => setIsAdminModalOpen(true)}>
                    <UserPlus size={18} />
                    <span>إنشاء حساب مدير</span>
                  </Button>
                </div>

                {adminsLoading ? (
                  <Skeleton height="120px" />
                ) : admins.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    لا يوجد حساب مدير لهذه الجامعة حالياً. اضغط "إنشاء حساب مدير" لتفعيل حساب.
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

        {/* مودال الجامعة */}
        <Modal isOpen={isUnivModalOpen} onClose={() => setIsUnivModalOpen(false)} title={univForm.id ? 'تعديل جامعة' : 'إضافة جامعة جديدة'}>
          <form onSubmit={saveUniversity} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>اسم الجامعة</label>
              <input 
                type="text" 
                required
                className={compStyles.input}
                value={univForm.name}
                onChange={e => setUnivForm({ ...univForm, name: e.target.value })}
                placeholder="جامعة الموصل مثلاً"
              />
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>المدينة</label>
              <input 
                type="text" 
                className={compStyles.input}
                value={univForm.city}
                onChange={e => setUnivForm({ ...univForm, city: e.target.value })}
                placeholder="نينوى"
              />
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>تاريخ انتهاء الاشتراك السنوي</label>
              <input 
                type="date" 
                required
                className={compStyles.input}
                value={univForm.subscription_expires_at}
                onChange={e => setUnivForm({ ...univForm, subscription_expires_at: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <Button type="button" variant="secondary" onClick={() => setIsUnivModalOpen(false)}>إلغاء</Button>
              <Button type="submit">حفظ البيانات</Button>
            </div>
          </form>
        </Modal>

        {/* مودال إنشاء مدير الجامعة */}
        <Modal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} title="إنشاء حساب مدير جامعة">
          <form onSubmit={createUniversityAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>الاسم الثلاثي للمدير</label>
              <input 
                type="text" 
                required
                className={compStyles.input}
                value={adminForm.name}
                onChange={e => setAdminForm({ ...adminForm, name: e.target.value })}
                placeholder="الاسم الكامل"
              />
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>البريد الإلكتروني للمدير</label>
              <input 
                type="email" 
                required
                className={compStyles.input}
                value={adminForm.email}
                onChange={e => setAdminForm({ ...adminForm, email: e.target.value })}
                placeholder="name@university.edu"
              />
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>كلمة مرور الحساب</label>
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
              <Button type="submit">إرسال طلب التفعيل</Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
