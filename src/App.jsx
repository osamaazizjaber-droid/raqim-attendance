import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useSubscription } from './hooks/useSubscription';
import { ToastProvider } from './components/ui/Toast';
import { Skeleton } from './components/ui/Skeleton';
import { ShieldAlert } from 'lucide-react';

// استيراد الصفحات
import Login from './pages/professor/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUniversities from './pages/admin/Universities';
import AdminProfessors from './pages/admin/Professors';
import AdminStudents from './pages/admin/Students';
import AdminReports from './pages/admin/Reports';
import ProfessorDashboard from './pages/professor/Dashboard';
import ProfessorScan from './pages/professor/Scan';
import ProfessorReports from './pages/professor/Reports';

import styles from './styles/professor.module.css';

// 1. شاشة حجب الحساب بسبب الاشتراك
export function SubscriptionBlockedScreen() {
  return (
    <div className={styles.blockContainer}>
      <div className={styles.blockCard}>
        <div className={styles.blockIcon}>
          <ShieldAlert size={56} />
        </div>
        <h2 className={styles.blockTitle}>انتهت صلاحية اشتراكك ⚠️</h2>
        <p className={styles.blockMessage}>
          عذراً يا أستاذ، لقد انتهت صلاحية اشتراكك الحالي في منصة رقيم.
          <br />
          يرجى التواصل مع الإدارة لتجديد الاشتراك وتفعيل حسابك لمتابعة تسجيل حضور الطلاب.
        </p>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
          رقيم — نظام إدارة الحضور الجامعي
        </div>
      </div>
    </div>
  );
}

// 2. حارس مسارات المشرف العام (Admin Route Guard)
function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '2rem' }}>
        <Skeleton width="200px" height="2rem" style={{ marginBottom: '1.5rem' }} />
        <Skeleton width="80%" height="300px" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// 3. حارس مسارات الأستاذ مع التحقق من الاشتراك (Professor Route Guard)
function ProfessorRoute({ children }) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { isExpired, loading: subLoading } = useSubscription();

  if (authLoading || subLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '2rem' }}>
        <Skeleton width="200px" height="2rem" style={{ marginBottom: '1.5rem' }} />
        <Skeleton width="80%" height="300px" />
      </div>
    );
  }

  // إذا لم يكن مسجل دخول، أو كان مشرف عام (يوجه للأدمين)
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  // إذا انتهى اشتراكه، نعرض شاشة الحجب فوراً ونمنعه من الوصول لأي ميزة
  if (isExpired) {
    return <SubscriptionBlockedScreen />;
  }

  return children;
}

// 4. حارس شاشة الدخول لمنع تسجيل الدخول المزدوج
function LoginRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return null;

  if (user) {
    return isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/professor" replace />;
  }

  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* مسار الدخول */}
            <Route path="/login" element={
              <LoginRoute>
                <Login />
              </LoginRoute>
            } />

            {/* مسارات المشرف العام */}
            <Route path="/admin" element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } />
            <Route path="/admin/universities" element={
              <AdminRoute>
                <AdminUniversities />
              </AdminRoute>
            } />
            <Route path="/admin/professors" element={
              <AdminRoute>
                <AdminProfessors />
              </AdminRoute>
            } />
            <Route path="/admin/students" element={
              <AdminRoute>
                <AdminStudents />
              </AdminRoute>
            } />
            <Route path="/admin/reports" element={
              <AdminRoute>
                <AdminReports />
              </AdminRoute>
            } />

            {/* مسارات الأستاذ */}
            <Route path="/professor" element={
              <ProfessorRoute>
                <ProfessorDashboard />
              </ProfessorRoute>
            } />
            <Route path="/professor/scan/:sessionId" element={
              <ProfessorRoute>
                <ProfessorScan />
              </ProfessorRoute>
            } />
            <Route path="/professor/reports" element={
              <ProfessorRoute>
                <ProfessorReports />
              </ProfessorRoute>
            } />

            {/* التوجيه التلقائي */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
