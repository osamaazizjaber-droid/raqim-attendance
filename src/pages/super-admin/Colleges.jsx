import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Key, Building, Calendar, Users, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Table, Tr, Th, Td } from '../../components/ui/Table';
import { Skeleton } from '../../components/ui/Skeleton';
import { SuperAdminSidebar } from './Dashboard';
import styles from '../../styles/admin.module.css';
import compStyles from '../../styles/components.module.css';

export default function SuperAdminColleges() {
  const { showToast } = useToast();

  // States
  const [colleges, setColleges] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminsLoading, setAdminsLoading] = useState(false);

  // Modals
  const [isCollegeModalOpen, setIsCollegeModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Forms
  const [collegeForm, setCollegeForm] = useState({
    id: null,
    name: '',
    university: '',
    logo_url: '',
    university_logo_url: '',
    subscription_expires_at: ''
  });

  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    fetchColleges();
  }, []);

  const fetchColleges = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('colleges')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setColleges(data || []);

      if (data && data.length > 0) {
        setSelectedCollege(data[0]);
        await fetchCollegeAdmins(data[0].id);
      }
    } catch (err) {
      showToast('خطأ', 'فشل تحميل بيانات الكليات الجامعية', 'danger');
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

  const handleCollegeSelect = async (college) => {
    setSelectedCollege(college);
    await fetchCollegeAdmins(college.id);
  };

  // College CRUD
  const saveCollege = async (e) => {
    e.preventDefault();
    try {
      if (collegeForm.id) {
        // Edit
        const { error } = await supabase
          .from('colleges')
          .update({ 
            name: collegeForm.name, 
            university: collegeForm.university,
            logo_url: collegeForm.logo_url || null,
            university_logo_url: collegeForm.university_logo_url || null,
            subscription_expires_at: collegeForm.subscription_expires_at 
          })
          .eq('id', collegeForm.id);
        if (error) throw error;
        showToast('نجاح', 'تم تحديث بيانات الكلية بنجاح', 'success');
      } else {
        // Create
        const { error } = await supabase
          .from('colleges')
          .insert({ 
            name: collegeForm.name, 
            university: collegeForm.university,
            logo_url: collegeForm.logo_url || null,
            university_logo_url: collegeForm.university_logo_url || null,
            subscription_expires_at: collegeForm.subscription_expires_at || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]
          });
        if (error) throw error;
        showToast('نجاح', 'تم إضافة الكلية بنجاح', 'success');
      }
      setIsCollegeModalOpen(false);
      setCollegeForm({ id: null, name: '', university: '', logo_url: '', university_logo_url: '', subscription_expires_at: '' });
      fetchColleges();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حفظ الكلية', 'danger');
    }
  };

  const deleteCollege = async (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف كلية "${name}"؟ سيتم حذف جميع الأقسام والأساتذة والطلاب وسجلات حضورهم نهائياً!`)) return;
    try {
      const { error } = await supabase.from('colleges').delete().eq('id', id);
      if (error) throw error;
      showToast('نجاح', 'تم حذف الكلية بنجاح', 'success');
      fetchColleges();
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف الكلية', 'danger');
    }
  };

  // Create College Admin Directly (RPC)
  const createCollegeAdmin = async (e) => {
    e.preventDefault();
    if (!selectedCollege) return;
    setAdminsLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_new_user', {
        p_email: adminForm.email,
        p_password: adminForm.password,
        p_name: adminForm.name,
        p_role: 'college',
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
      setAdminsLoading(false);
    }
  };

  const deleteAdmin = async (adminId, adminName) => {
    if (!window.confirm(`هل أنت متأكد من حذف حساب مدير الكلية "${adminName}"؟`)) return;
    try {
      // 1. حذف حساب Auth عن طريق الاتصال بمشرف سوبابيس (من خلال cascade عند حذف السجل في جدول admins)
      const { error } = await supabase.from('admins').delete().eq('id', adminId);
      if (error) throw error;
      showToast('نجاح', 'تم حذف حساب المدير بنجاح', 'success');
      fetchCollegeAdmins(selectedCollege.id);
    } catch (err) {
      showToast('خطأ', err.message || 'فشل حذف الحساب', 'danger');
    }
  };

  const isCollegeExpired = (expiryDate) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    return expiry < today;
  };

  return (
    <div className={styles.adminLayout}>
      <SuperAdminSidebar activePage="colleges" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>إدارة الكليات والاشتراكات السنوية</h1>
          <Button onClick={() => setIsCollegeModalOpen(true)}>
            <Plus size={18} />
            <span>إضافة كلية متعاقدة</span>
          </Button>
        </div>

        {loading ? (
          <div>
            <Skeleton height="200px" style={{ marginBottom: '2rem' }} />
            <Skeleton height="200px" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* جدول الكليات */}
            <div className={styles.glass} style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>الكليات الجامعية المسجلة</h2>
              {colleges.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  لا يوجد كليات مسجلة حالياً بالمنصة.
                </div>
              ) : (
                <div className={compStyles.tableContainer}>
                  <Table>
                    <thead>
                      <Tr>
                        <Th>اسم الكلية</Th>
                        <Th>الجامعة</Th>
                        <Th>تاريخ انتهاء الاشتراك</Th>
                        <Th>حالة الاشتراك</Th>
                        <Th>العمليات</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {colleges.map(col => (
                        <Tr 
                          key={col.id} 
                          className={selectedCollege?.id === col.id ? compStyles.rowSelected : ''}
                          onClick={() => handleCollegeSelect(col)}
                          style={{ cursor: 'pointer' }}
                        >
                          <Td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{col.name}</Td>
                          <Td>{col.university || '-'}</Td>
                          <Td>{col.subscription_expires_at}</Td>
                          <Td>
                            {isCollegeExpired(col.subscription_expires_at) ? (
                              <Badge variant="danger">منتهي ⚠️</Badge>
                            ) : (
                              <Badge variant="success">فعال ✅</Badge>
                            )}
                          </Td>
                          <Td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                onClick={() => {
                                  setCollegeForm({
                                    id: col.id,
                                    name: col.name,
                                    university: col.university || '',
                                    logo_url: col.logo_url || '',
                                    university_logo_url: col.university_logo_url || '',
                                    subscription_expires_at: col.subscription_expires_at
                                  });
                                  setIsCollegeModalOpen(true);
                                }}
                              >
                                تعديل
                              </Button>
                              <Button 
                                size="sm" 
                                variant="danger" 
                                onClick={() => deleteCollege(col.id, col.name)}
                              >
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

            {/* إدارة حسابات مدراء الكلية المحددة */}
            {selectedCollege && (
              <div className={styles.glass} style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>مدراء الكلية: {selectedCollege.name}</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>الحسابات التي تدير الأقسام والطلاب والأساتذة للكلية.</span>
                  </div>
                  <Button size="sm" onClick={() => setIsAdminModalOpen(true)}>
                    <Users size={16} />
                    <span>إنشاء حساب مدير</span>
                  </Button>
                </div>

                {adminsLoading ? (
                  <Skeleton height="100px" />
                ) : admins.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    لا يوجد حسابات مدراء لهذه الكلية. اضغط على الزر أعلاه لإضافة مدير.
                  </div>
                ) : (
                  <div className={compStyles.tableContainer}>
                    <Table>
                      <thead>
                        <Tr>
                          <Th>الاسم الكامل</Th>
                          <Th>البريد الإلكتروني</Th>
                          <Th>تاريخ الإنشاء</Th>
                          <Th>العمليات</Th>
                        </Tr>
                      </thead>
                      <tbody>
                        {admins.map(adm => (
                          <Tr key={adm.id}>
                            <Td style={{ fontWeight: '600' }}>{adm.name}</Td>
                            <Td>{adm.email}</Td>
                            <Td>{new Date(adm.created_at).toLocaleDateString('ar-EG')}</Td>
                            <Td>
                              <Button size="icon" variant="danger" onClick={() => deleteAdmin(adm.id, adm.name)}>
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
        <Modal 
          isOpen={isCollegeModalOpen} 
          onClose={() => {
            setIsCollegeModalOpen(false);
            setCollegeForm({ id: null, name: '', university: '', logo_url: '', university_logo_url: '', subscription_expires_at: '' });
          }} 
          title={collegeForm.id ? "تعديل بيانات الكلية الجامعية" : "إضافة كلية جامعية جديدة"}
        >
          <form onSubmit={saveCollege} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>اسم الكلية الجامعية</label>
              <input 
                type="text" 
                required
                className={compStyles.input}
                value={collegeForm.name}
                onChange={e => setCollegeForm({ ...collegeForm, name: e.target.value })}
                placeholder="مثال: كلية علوم الحاسوب وتكنولوجيا المعلومات"
              />
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>الجامعة التابعة لها</label>
              <input 
                type="text" 
                className={compStyles.input}
                value={collegeForm.university}
                onChange={e => setCollegeForm({ ...collegeForm, university: e.target.value })}
                placeholder="مثال: جامعة تكريت"
              />
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>🎓 رابط شعار الجامعة (University Logo URL)</label>
              <input 
                type="url" 
                className={compStyles.input}
                value={collegeForm.university_logo_url}
                onChange={e => setCollegeForm({ ...collegeForm, university_logo_url: e.target.value })}
                placeholder="https://example.com/university-logo.png"
              />
              {collegeForm.university_logo_url && (
                <img src={collegeForm.university_logo_url} alt="university logo preview" style={{ height: '60px', marginTop: '8px', borderRadius: '8px', objectFit: 'contain', border: '1px solid var(--border)' }} onError={e => e.target.style.display='none'} />
              )}
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>🏛 رابط شعار الكلية (College Logo URL)</label>
              <input 
                type="url" 
                className={compStyles.input}
                value={collegeForm.logo_url}
                onChange={e => setCollegeForm({ ...collegeForm, logo_url: e.target.value })}
                placeholder="https://example.com/college-logo.png"
              />
              {collegeForm.logo_url && (
                <img src={collegeForm.logo_url} alt="college logo preview" style={{ height: '60px', marginTop: '8px', borderRadius: '8px', objectFit: 'contain', border: '1px solid var(--border)' }} onError={e => e.target.style.display='none'} />
              )}
            </div>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label}>تاريخ انتهاء الاشتراك السنوي</label>
              <input 
                type="date" 
                required
                className={compStyles.input}
                value={collegeForm.subscription_expires_at}
                onChange={e => setCollegeForm({ ...collegeForm, subscription_expires_at: e.target.value })}
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
                placeholder="name@college.edu"
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
              <Button type="submit">إنشاء وتفعيل الحساب</Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
