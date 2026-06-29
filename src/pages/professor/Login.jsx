import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Lock, Mail } from 'lucide-react';
import styles from '../../styles/professor.module.css';
import compStyles from '../../styles/components.module.css';

import logo from '../../assets/logo.png';

export default function Login() {
  const { login, error, user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(null);

  // إعادة التوجيه التلقائي للمستخدم بناءً على دوره فور توفر البيانات
  useEffect(() => {
    if (!authLoading && user && role) {
      switch (role) {
        case 'super-admin':
          navigate('/super-admin/dashboard', { replace: true });
          break;
        case 'college-admin':
          navigate('/college-admin/dashboard', { replace: true });
          break;
        case 'professor':
          navigate('/professor', { replace: true });
          break;
        default:
          break;
      }
    }
  }, [user, role, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLocalError(null);

    try {
      await login(email, password);
      // سيتم التوجيه تلقائياً عبر الـ useEffect بمجرد تحديث دور المستخدم في السياق.
    } catch (err) {
      setLocalError(err.message || 'حدث خطأ غير متوقع');
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
          <img 
            src={logo} 
            alt="Raqim Logo" 
            style={{ 
              width: '100px', 
              height: '100px', 
              borderRadius: '50%', 
              marginBottom: '1rem', 
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.25)', 
              border: '2px solid rgba(245, 158, 11, 0.3)' 
            }} 
          />
          <div className={styles.loginLogo} style={{ margin: 0 }}>رَقِيم — RAQIM</div>
        </div>
        <div className={styles.loginSubtitle}>منصة إدارة وتسجيل الحضور الجامعي الذكي</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {(error || localError) && (
            <div 
              style={{ 
                backgroundColor: 'var(--danger-light)', 
                color: 'var(--danger)', 
                border: '1px solid rgba(239, 68, 68, 0.2)', 
                borderRadius: 'var(--radius-md)', 
                padding: '0.75rem', 
                fontSize: '0.85rem', 
                marginBottom: '1rem',
                textAlign: 'center' 
              }}
            >
              {localError || error}
            </div>
          )}

          <div className={compStyles.inputGroup}>
            <label className={compStyles.label}>البريد الإلكتروني</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="email" 
                required
                className={compStyles.input}
                placeholder="name@university.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ paddingRight: '2.5rem' }}
              />
              <Mail size={18} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className={compStyles.inputGroup}>
            <label className={compStyles.label}>كلمة المرور</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="password" 
                required
                className={compStyles.input}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingRight: '2.5rem' }}
              />
              <Lock size={18} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', marginTop: '1rem', padding: '0.75rem' }}
          >
            {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
          </Button>
        </form>
      </div>
    </div>
  );
}
