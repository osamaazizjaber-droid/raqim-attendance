import { useAuth } from './useAuth';

/**
 * خطاف مخصص لتحديد صلاحية المستخدم ومسار توجيهه الصحيح.
 */
export function useAdminRole() {
  const { role, user } = useAuth();

  const getRedirectPath = () => {
    if (!user) return '/login';
    
    switch (role) {
      case 'super-admin':
        return '/admin'; // سنبقي مسارات المشرفين تحت /admin في الروتينغ العام أو نوجههم
      case 'university-admin':
        return '/university-admin/dashboard';
      case 'college-admin':
        return '/college-admin/dashboard';
      case 'professor':
        return '/professor';
      default:
        return '/login';
    }
  };

  return {
    role,
    getRedirectPath,
  };
}
