import { useAuth } from './useAuth';

/**
 * خطاف مخصص للتحقق من حالة اشتراك الكلية أو الأستاذ.
 * يمنع وصول الأساتذة والمدراء عند انتهاء تاريخ صلاحية اشتراك الكلية أو الحساب الشخصي.
 */
export function useSubscription() {
  const { professor, adminDetails, role, loading: authLoading } = useAuth();

  if (authLoading) {
    return { isExpired: false, loading: true, expiryDate: null, reason: null };
  }

  // المشرف العام (Super Admin) لا يخضع لقيود الاشتراك
  if (role === 'super-admin') {
    return { isExpired: false, loading: false, expiryDate: null, reason: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. مدراء الكليات: يخضعون لاشتراك الكلية فقط
  if (role === 'college-admin') {
    if (!adminDetails || !adminDetails.colleges?.subscription_expires_at) {
      return { isExpired: true, loading: false, expiryDate: null, reason: 'college_expired' };
    }
    const collegeExpiry = new Date(adminDetails.colleges.subscription_expires_at);
    collegeExpiry.setHours(0, 0, 0, 0);
    
    const isExpired = collegeExpiry < today;
    return {
      isExpired,
      loading: false,
      expiryDate: adminDetails.colleges.subscription_expires_at,
      reason: isExpired ? 'college_expired' : null
    };
  }

  // 2. الأساتذة: يخضعون لاشتراكهم الشخصي + اشتراك الكلية (Double Subscription Gate)
  if (role === 'professor') {
    if (!professor) {
      return { isExpired: true, loading: false, expiryDate: null, reason: 'no_profile' };
    }

    // التحقق من اشتراك الكلية
    if (!professor.colleges?.subscription_expires_at) {
      return { isExpired: true, loading: false, expiryDate: null, reason: 'college_expired' };
    }
    const collegeExpiry = new Date(professor.colleges.subscription_expires_at);
    collegeExpiry.setHours(0, 0, 0, 0);
    const isCollegeExpired = collegeExpiry < today;

    // التحقق من اشتراك الأستاذ الشخصي
    const profExpiry = new Date(professor.subscription_expires_at);
    profExpiry.setHours(0, 0, 0, 0);
    const isProfExpired = profExpiry < today;

    const isExpired = isCollegeExpired || isProfExpired;

    return {
      isExpired,
      loading: false,
      expiryDate: professor.subscription_expires_at,
      reason: isCollegeExpired ? 'college_expired' : (isProfExpired ? 'personal_expired' : null)
    };
  }

  // أي حساب آخر يعتبر محظوراً لحماية التطبيق
  return { isExpired: true, loading: false, expiryDate: null, reason: 'invalid_role' };
}
