import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useSubscription } from './hooks/useSubscription';
import { ToastProvider } from './components/ui/Toast';
import { Skeleton } from './components/ui/Skeleton';
import { ShieldAlert } from 'lucide-react';

// استيراد الصفحات
import Login from './pages/professor/Login';

// المشرف العام (Super Admin)
import SuperAdminDashboard from './pages/super-admin/Dashboard';
import SuperAdminUniversities from './pages/super-admin/Universities';

// مدير الجامعة (University Admin)
import UniversityAdminDashboard from './pages/university-admin/Dashboard';
import UniversityAdminColleges from './pages/university-admin/Colleges';

// مدير الكلية (College Admin)
import CollegeAdminDashboard from './pages/college-admin/Dashboard';
import CollegeAdminDepartments from './pages/college-admin/Departments';
import CollegeAdminProfessors from './pages/college-admin/Professors';
import CollegeAdminStudents from './pages/college-admin/Students';
import CollegeAdminMigration from './pages/college-admin/Migration';
import CollegeAdminResults from './pages/college-admin/Results';
import CollegeAdminReports from './pages/college-admin/Reports';

// الأستاذ (Professor)
import ProfessorDashboard from './pages/professor/Dashboard';
import ProfessorScan from './pages/professor/Scan';
import ProfessorReports from './pages/professor/Reports';

// العام (Public Results Lookup)
import ResultsLookup from './pages/public/ResultsLookup';

import styles from './styles/professor.module.css';

// 1. شاشة حجب الحساب بسبب انتهاء صلاحية الاشتراك
export function SubscriptionBlockedScreen({ reason }) {
  const isUnivExpired = reason === 'university_expired';

  return (
    <div className={styles.blockContainer}>
      <div className={styles.blockCard}>
        <div className={styles.blockIcon}>
          <ShieldAlert size={56} style={{ color: 'var(--danger)' }} />
        </div>
        <h2 className={styles.blockTitle}>
          {isUnivExpired ? 'انتهت صلاحية اشتراك الجامعة ⚠️' : 'انتهت صلاحية اشتراكك الشخصي ⚠️'}
        </h2>
        <p className={styles.blockMessage}>
          {isUnivExpired ? (
            <>
              عذراً، لقد انتهت صلاحية الاشتراك السنوي الخاص بجامعتكم في منصة رقيم.
              <br />
              يرجى التواصل مع إدارة الجامعة أو الشركة لتجديد الاشتراك السنوي لجامعتكم.
            </>
          ) : (
            <>
              عذراً يا أستاذ، لقد انتهت صلاحية اشتراكك الشخصي المعتمد في منصة رقيم.
              <br />
              يرجى مراجعة عمادة الكلية أو إدارة التسجيل لتجديد وتفعيل حسابك لمتابعة العمل.
            </>
          )}
        </p>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1.5rem' }}>
          رقيم — نظام الحضور والنتائج الجامعي الذكي
        </div>
      </div>
    </div>
  );
}

// 2. حارس مسارات المشرف العام (Super Admin Guard)
function SuperAdminRoute({ children }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '2rem' }}>
        <Skeleton width="200px" height="2rem" style={{ marginBottom: '1.5rem' }} />
        <Skeleton width="80%" height="300px" />
      </div>
    );
  }

  if (!user || role !== 'super-admin') {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// 3. حارس مسارات مدير الجامعة (University Admin Guard)
function UniversityAdminRoute({ children }) {
  const { user, role, loading: authLoading } = useAuth();
  const { isExpired, loading: subLoading, reason } = useSubscription();

  if (authLoading || subLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '2rem' }}>
        <Skeleton width="200px" height="2rem" style={{ marginBottom: '1.5rem' }} />
        <Skeleton width="80%" height="300px" />
      </div>
    );
  }

  if (!user || role !== 'university-admin') {
    return <Navigate to="/login" replace />;
  }

  if (isExpired) {
    return <SubscriptionBlockedScreen reason={reason} />;
  }

  return children;
}

// 4. حارس مسارات مدير الكلية (College Admin Guard)
function CollegeAdminRoute({ children }) {
  const { user, role, loading: authLoading } = useAuth();
  const { isExpired, loading: subLoading, reason } = useSubscription();

  if (authLoading || subLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '2rem' }}>
        <Skeleton width="200px" height="2rem" style={{ marginBottom: '1.5rem' }} />
        <Skeleton width="80%" height="300px" />
      </div>
    );
  }

  if (!user || role !== 'college-admin') {
    return <Navigate to="/login" replace />;
  }

  if (isExpired) {
    return <SubscriptionBlockedScreen reason={reason} />;
  }

  return children;
}

// 5. حارس مسارات الأستاذ (Professor Guard)
function ProfessorRoute({ children }) {
  const { user, role, loading: authLoading } = useAuth();
  const { isExpired, loading: subLoading, reason } = useSubscription();

  if (authLoading || subLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '2rem' }}>
        <Skeleton width="200px" height="2rem" style={{ marginBottom: '1.5rem' }} />
        <Skeleton width="80%" height="300px" />
      </div>
    );
  }

  if (!user || role !== 'professor') {
    return <Navigate to="/login" replace />;
  }

  if (isExpired) {
    return <SubscriptionBlockedScreen reason={reason} />;
  }

  return children;
}

// 6. حارس شاشة الدخول الموحدة
function LoginRoute({ children }) {
  const { user, role, loading } = useAuth();

  if (loading) return null;

  if (user && role) {
    switch (role) {
      case 'super-admin':
        return <Navigate to="/super-admin/dashboard" replace />;
      case 'university-admin':
        return <Navigate to="/university-admin/dashboard" replace />;
      case 'college-admin':
        return <Navigate to="/college-admin/dashboard" replace />;
      case 'professor':
        return <Navigate to="/professor" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }

  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* مسار الدخول الموحد */}
            <Route path="/login" element={
              <LoginRoute>
                <Login />
              </LoginRoute>
            } />

            {/* مسار الاستعلام العام بدون تسجيل دخول */}
            <Route path="/results" element={<ResultsLookup />} />

            {/* مسارات المشرف العام (Super Admin) */}
            <Route path="/super-admin/dashboard" element={
              <SuperAdminRoute>
                <SuperAdminDashboard />
              </SuperAdminRoute>
            } />
            <Route path="/super-admin/universities" element={
              <SuperAdminRoute>
                <SuperAdminUniversities />
              </SuperAdminRoute>
            } />

            {/* مسارات مدير الجامعة (University Admin) */}
            <Route path="/university-admin/dashboard" element={
              <UniversityAdminRoute>
                <UniversityAdminDashboard />
              </UniversityAdminRoute>
            } />
            <Route path="/university-admin/colleges" element={
              <UniversityAdminRoute>
                <UniversityAdminColleges />
              </UniversityAdminRoute>
            } />

            {/* مسارات مدير الكلية (College Admin) */}
            <Route path="/college-admin/dashboard" element={
              <CollegeAdminRoute>
                <CollegeAdminDashboard />
              </CollegeAdminRoute>
            } />
            <Route path="/college-admin/departments" element={
              <CollegeAdminRoute>
                <CollegeAdminDepartments />
              </CollegeAdminRoute>
            } />
            <Route path="/college-admin/professors" element={
              <CollegeAdminRoute>
                <CollegeAdminProfessors />
              </CollegeAdminRoute>
            } />
            <Route path="/college-admin/students" element={
              <CollegeAdminRoute>
                <CollegeAdminStudents />
              </CollegeAdminRoute>
            } />
            <Route path="/college-admin/migration" element={
              <CollegeAdminRoute>
                <CollegeAdminMigration />
              </CollegeAdminRoute>
            } />
            <Route path="/college-admin/results" element={
              <CollegeAdminRoute>
                <CollegeAdminResults />
              </CollegeAdminRoute>
            } />
            <Route path="/college-admin/reports" element={
              <CollegeAdminRoute>
                <CollegeAdminReports />
              </CollegeAdminRoute>
            } />

            {/* مسارات الأستاذ (Professor) */}
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
