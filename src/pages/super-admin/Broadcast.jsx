import React, { useState, useEffect } from 'react';
import { Send, Clock, AlertTriangle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Table, Tr, Th, Td } from '../../components/ui/Table';
import { Skeleton } from '../../components/ui/Skeleton';
import { SuperAdminSidebar } from './Dashboard';
import styles from '../../styles/admin.module.css';
import compStyles from '../../styles/components.module.css';

export default function SuperAdminBroadcast() {
  const { showToast } = useToast();

  // States
  const [audience, setAudience] = useState('all');
  const [message, setMessage] = useState('');
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBroadcasts();

    // Subscribe to realtime updates of the telegram_broadcast_requests table
    const channel = supabase
      .channel('broadcasts_ui_sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'telegram_broadcast_requests',
        },
        () => {
          fetchBroadcasts(false); // fetch without showing global skeleton loader
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchBroadcasts = async (showSkeleton = true) => {
    try {
      if (showSkeleton) setLoading(true);
      const { data, error } = await supabase
        .from('telegram_broadcast_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBroadcasts(data || []);
    } catch (err) {
      showToast('خطأ', 'فشل تحميل سجل الإرسال الجماعي', 'danger');
    } finally {
      if (showSkeleton) setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();

    if (!message.trim()) {
      showToast('تنبيه', 'يرجى كتابة نص الرسالة أولاً', 'warning');
      return;
    }

    if (window.confirm('هل أنت متأكد من رغبتك في جدولة هذه الرسالة للإرسال الجماعي لتيليجرام؟')) {
      try {
        setSubmitting(true);
        const { error } = await supabase
          .from('telegram_broadcast_requests')
          .insert({
            audience,
            message: message.trim(),
            status: 'pending'
          });

        if (error) throw error;

        showToast('نجاح', 'تم إضافة الرسالة بنجاح، جاري معالجتها من قبل البوت...', 'success');
        setMessage('');
      } catch (err) {
        showToast('خطأ', err.message || 'فشل جدولة عملية الإرسال', 'danger');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.25rem', 
            padding: '0.25rem 0.6rem', 
            fontSize: '0.75rem', 
            fontWeight: '600', 
            color: '#fbbf24', 
            backgroundColor: 'rgba(251, 191, 36, 0.1)', 
            borderRadius: '4px' 
          }}>
            <Clock size={12} /> قيد الانتظار
          </span>
        );
      case 'processing':
        return (
          <span style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.25rem', 
            padding: '0.25rem 0.6rem', 
            fontSize: '0.75rem', 
            fontWeight: '600', 
            color: '#3b82f6', 
            backgroundColor: 'rgba(59, 130, 246, 0.1)', 
            borderRadius: '4px' 
          }}>
            <RefreshCw size={12} className={compStyles.spin} /> جاري الإرسال
          </span>
        );
      case 'completed':
        return (
          <span style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.25rem', 
            padding: '0.25rem 0.6rem', 
            fontSize: '0.75rem', 
            fontWeight: '600', 
            color: '#10b981', 
            backgroundColor: 'rgba(16, 185, 129, 0.1)', 
            borderRadius: '4px' 
          }}>
            <CheckCircle2 size={12} /> مكتمل
          </span>
        );
      case 'failed':
        return (
          <span style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.25rem', 
            padding: '0.25rem 0.6rem', 
            fontSize: '0.75rem', 
            fontWeight: '600', 
            color: '#ef4444', 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            borderRadius: '4px' 
          }}>
            <XCircle size={12} /> فشل
          </span>
        );
      default:
        return status;
    }
  };

  const getAudienceLabel = (aud) => {
    switch (aud) {
      case 'all':
        return '🌍 الجميع';
      case 'students':
        return '👤 الطلاب';
      case 'professors':
        return '👨‍🏫 الأساتذة';
      default:
        return aud;
    }
  };

  return (
    <div className={styles.adminLayout}>
      <SuperAdminSidebar activePage="broadcast" />
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>الإرسال الجماعي (تيليجرام)</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* نماذج الإرسال */}
          <div className={styles.glass} style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>إنشاء تنبيه جماعي جديد</h2>
            
            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className={compStyles.formGroup}>
                <label className={compStyles.label}>الفئة المستهدفة</label>
                <select 
                  className={compStyles.input}
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  style={{ width: '100%', maxWidth: '300px' }}
                >
                  <option value="all">🌍 الجميع (الطلاب والأساتذة)</option>
                  <option value="students">👤 الطلاب فقط</option>
                  <option value="professors">👨‍🏫 الأساتذة فقط</option>
                </select>
              </div>

              <div className={compStyles.formGroup}>
                <label className={compStyles.label}>نص الرسالة</label>
                <textarea 
                  className={compStyles.input}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="اكتب نص الرسالة هنا...\n\nيمكنك استخدام كود HTML مثل: <b>نص عريض</b>، <i>نص مائل</i>، <code>كود</code>، و <a href='https://link.com'>روابط خارجية</a>"
                  style={{ width: '100%', minHeight: '150px', resize: 'vertical', fontFamily: 'inherit', padding: '0.75rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <Button type="submit" disabled={submitting}>
                  <Send size={16} />
                  <span>{submitting ? 'جاري الإرسال...' : 'جدولة وإرسال الرسالة'}</span>
                </Button>
              </div>
            </form>
          </div>

          {/* سجل الإرسال */}
          <div className={styles.glass} style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>سجل الرسائل الجماعية السابقة</h2>
            
            {loading ? (
              <Skeleton height="200px" />
            ) : broadcasts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                لا يوجد أي رسائل جماعية مرسلة مسبقاً.
              </div>
            ) : (
              <div className={compStyles.tableContainer}>
                <Table>
                  <thead>
                    <Tr>
                      <Th style={{ width: '15%' }}>التاريخ والوقت</Th>
                      <Th style={{ width: '15%' }}>المستهدفون</Th>
                      <Th style={{ width: '40%' }}>محتوى الرسالة</Th>
                      <Th style={{ width: '15%' }}>الحالة</Th>
                      <Th style={{ width: '15%' }}>النتيجة / التفاصيل</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {broadcasts.map((b) => (
                      <Tr key={b.id}>
                        <Td style={{ fontSize: '0.85rem' }}>{new Date(b.created_at).toLocaleString('ar-IQ')}</Td>
                        <Td style={{ fontWeight: '600' }}>{getAudienceLabel(b.audience)}</Td>
                        <Td>
                          <div style={{ 
                            maxHeight: '100px', 
                            overflowY: 'auto', 
                            whiteSpace: 'pre-wrap', 
                            fontSize: '0.85rem', 
                            color: 'var(--text-muted)',
                            fontFamily: 'inherit'
                          }}>
                            {b.message}
                          </div>
                        </Td>
                        <Td>{getStatusBadge(b.status)}</Td>
                        <Td style={{ fontSize: '0.85rem', color: b.status === 'failed' ? 'var(--danger)' : 'var(--text-muted)' }}>
                          {b.error_message || '-'}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
