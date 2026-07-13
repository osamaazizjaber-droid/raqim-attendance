import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { SuperAdminSidebar } from './super-admin/Dashboard';
import { CollegeAdminSidebar } from './college-admin/Dashboard';
import { ProfessorSidebar } from './professor/Dashboard';
import { Sun, Moon, Type, Palette } from 'lucide-react';
import styles from '../styles/admin.module.css';

export default function Settings() {
  const { user, role, loading: authLoading } = useAuth();
  const { 
    theme, setTheme,
    fontSize, setFontSize,
    fontFamily, setFontFamily,
    accentColor, setAccentColor
  } = useSettings();

  if (authLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '2rem' }}>
        <div style={{ color: 'var(--text-secondary)' }}>جاري تحميل الإعدادات...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleThemeChange = (selectedTheme) => {
    setTheme(selectedTheme);
  };

  const handleFontSizeChange = (size) => {
    setFontSize(size);
  };

  const handleFontFamilyChange = (family) => {
    setFontFamily(family);
  };

  const handleAccentChange = (color) => {
    setAccentColor(color);
  };

  const accentOptions = [
    { name: 'أزرق (الافتراضي)', value: '#3b82f6', bgClass: '#3b82f6' },
    { name: 'أخضر زمردي', value: '#10b981', bgClass: '#10b981' },
    { name: 'بنفسجي داكن', value: '#6366f1', bgClass: '#6366f1' },
    { name: 'برتقالي دافئ', value: '#f59e0b', bgClass: '#f59e0b' },
    { name: 'وردي ياقوتي', value: '#f43f5e', bgClass: '#f43f5e' }
  ];

  const fontOptions = [
    { name: 'خط تجوال (الافتراضي)', value: 'Tajawal' },
    { name: 'خط كايرو (Cairo)', value: 'Cairo' },
    { name: 'خط المراعي (Almarai)', value: 'Almarai' },
    { name: 'خط آي بي إم (IBM Plex)', value: 'IBM Plex Arabic' },
    { name: 'خط ألكسندريا (Alexandria)', value: 'Alexandria' },
    { name: 'خط ريديكس (Readex Pro)', value: 'Readex Pro' },
    { name: 'خط وزير (Vazirmatn)', value: 'Vazirmatn' },
    { name: 'خط تشانغا (Changa)', value: 'Changa' },
    { name: 'خط نوتو (Noto Sans)', value: 'Noto Sans Arabic' },
    { name: 'خط ثمانية (Thamaniah) 💡', value: 'Thmanyah', note: 'يتطلب تثبيت الخط على جهازك محلياً' },
    { name: 'خط النظام (System)', value: 'System' }
  ];

  return (
    <div className={styles.adminLayout}>
      {role === 'super-admin' && <SuperAdminSidebar activePage="settings" />}
      {role === 'college-admin' && <CollegeAdminSidebar activePage="settings" />}
      {role === 'professor' && <ProfessorSidebar activePage="settings" />}
      
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>إعدادات المنصة</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              خصص مظهر المنصة، حجم ونوع الخطوط، والألوان لتناسب ذوقك الشخصي.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '850px', marginTop: '1rem' }}>
          
          {/* مظهر الواجهة */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Palette size={20} style={{ color: 'var(--accent)' }} />
              <span>مظهر الواجهة (Theme)</span>
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div 
                onClick={() => handleThemeChange('dark')}
                style={{ 
                  border: theme === 'dark' ? '2px solid var(--accent)' : '1px solid var(--border)',
                  backgroundColor: '#0a0e1a', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '1.25rem', 
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s'
                }}
              >
                <Moon size={28} style={{ color: theme === 'dark' ? 'var(--accent)' : '#9ca3af' }} />
                <span style={{ fontWeight: '600', color: '#f3f4f6' }}>الوضع الداكن (Dark)</span>
              </div>

              <div 
                onClick={() => handleThemeChange('light')}
                style={{ 
                  border: theme === 'light' ? '2px solid var(--accent)' : '1px solid var(--border)',
                  backgroundColor: '#ffffff', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '1.25rem', 
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}
              >
                <Sun size={28} style={{ color: theme === 'light' ? 'var(--accent)' : '#4b5563' }} />
                <span style={{ fontWeight: '600', color: '#111827' }}>الوضع الفاتح (Light)</span>
              </div>
            </div>
          </div>

          {/* لون السمة */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Palette size={20} style={{ color: 'var(--accent)' }} />
              <span>لون السمة الرئيسي (Accent Color)</span>
            </h3>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {accentOptions.map(opt => (
                <div 
                  key={opt.value}
                  onClick={() => handleAccentChange(opt.value)}
                  style={{ 
                    border: accentColor === opt.value ? '2px solid var(--text-primary)' : '1px solid transparent',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)', 
                    padding: '0.75rem 1rem', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ 
                    width: '18px', 
                    height: '18px', 
                    borderRadius: '50%', 
                    backgroundColor: opt.bgClass,
                    display: 'inline-block'
                  }} />
                  <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{opt.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* حجم الخطوط */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Type size={20} style={{ color: 'var(--accent)' }} />
              <span>حجم الخطوط (Font Size)</span>
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
              {[
                { label: 'صغير (14px)', value: 'small' },
                { label: 'متوسط (16px)', value: 'medium' },
                { label: 'كبير (18px)', value: 'large' },
                { label: 'كبير جداً (20px)', value: 'xlarge' }
              ].map(sz => (
                <div 
                  key={sz.value}
                  onClick={() => handleFontSizeChange(sz.value)}
                  style={{ 
                    border: fontSize === sz.value ? '2px solid var(--accent)' : '1px solid var(--border)',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)', 
                    padding: '1rem', 
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    transition: 'all 0.2s',
                    fontSize: sz.value === 'small' ? '0.85rem' : sz.value === 'medium' ? '0.95rem' : sz.value === 'large' ? '1.05rem' : '1.15rem'
                  }}
                >
                  <span>{sz.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* نوع الخط */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Type size={20} style={{ color: 'var(--accent)' }} />
              <span>نوع الخط الرئيسي (Font Family)</span>
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
              {fontOptions.map(font => (
                <div 
                  key={font.value}
                  onClick={() => handleFontFamilyChange(font.value)}
                  style={{ 
                    border: fontFamily === font.value ? '2px solid var(--accent)' : '1px solid var(--border)',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)', 
                    padding: '1rem', 
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ 
                    fontWeight: '700', 
                    color: 'var(--text-primary)',
                    fontFamily: font.value === 'Thmanyah' 
                      ? `'Thmanyah', 'Thmanyah Regular', 'Tajawal', sans-serif`
                      : font.value === 'Cairo' 
                      ? `'Cairo', sans-serif`
                      : font.value === 'Almarai' 
                      ? `'Almarai', sans-serif`
                      : font.value === 'IBM Plex Arabic' 
                      ? `'IBM Plex Sans Arabic', sans-serif`
                      : font.value === 'Alexandria' 
                      ? `'Alexandria', sans-serif`
                      : font.value === 'Readex Pro' 
                      ? `'Readex Pro', sans-serif`
                      : font.value === 'Vazirmatn' 
                      ? `'Vazirmatn', sans-serif`
                      : font.value === 'Changa' 
                      ? `'Changa', sans-serif`
                      : font.value === 'Noto Sans Arabic' 
                      ? `'Noto Sans Arabic', sans-serif`
                      : font.value === 'System' 
                      ? 'system-ui, sans-serif'
                      : `'Tajawal', sans-serif`
                  }}>
                    {font.name}
                  </span>
                  {font.note && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--warning)', fontWeight: '600' }}>
                      {font.note}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
