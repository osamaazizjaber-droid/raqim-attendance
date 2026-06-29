import { useAuth } from './useAuth';

/**
 * خطاف مخصص للتحقق من حالة اشتراك الجامعة أو الأستاذ.
 * يمنع وصول الأساتذة والمدراء عند انتهاء تاريخ صلاحية اشتراك الجامعة أو الحساب الشخصي.
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

  // 1. مدراء الجامعة ومدراء الكليات: يخضعون لاشتراك الجامعة فقط
  if (role === 'university-admin' || role === 'college-admin') {
    if (!adminDetails || !adminDetails.universities?.subscription_expires_at) {
      return { isExpired: true, loading: false, expiryDate: null, reason: 'university_expired' };
    }
    const univExpiry = new Date(adminDetails.universities.subscription_expires_at);
    univExpiry.setHours(0, 0, 0, 0);
    
    const isExpired = univExpiry < today;
    return {
      isExpired,
      loading: false,
      expiryDate: adminDetails.universities.subscription_expires_at,
      reason: isExpired ? 'university_expired' : null
    };
  }

  // 2. الأساتذة: يخضعون لاشتراكهم الشخصي + اشتراك الجامعة (Double Subscription Gate)
  if (role === 'professor') {
    if (!professor) {
      return { isExpired: true, loading: false, expiryDate: null, reason: 'no_profile' };
    }

    // التحقق من اشتراك الجامعة
    if (!professor.universities?.subscription_expires_at) {
      return { isExpired: true, loading: false, expiryDate: null, reason: 'university_expired' };
    }
    const univExpiry = new Date(professor.universities.subscription_expires_at);
    univExpiry.setHours(0, 0, 0, 0);
    const isUnivExpired = univExpiry < today;

    // التحقق من اشتراك الأستاذ الشخصي
    const profExpiry = new Date(professor.subscription_expires_at);
    profExpiry.setHours(0, 0, 0, 0);
    const isProfExpired = profExpiry < today;

    const isExpired = isUnivExpired || isProfExpired;

    return {
      isExpired,
      loading: false,
      expiryDate: professor.subscription_expires_at,
      reason: isUnivExpired ? 'university_expired' : (isProfExpired ? 'personal_expired' : null)
    };
  }

  // أي حساب آخر يعتبر محظوراً لحماية التطبيق
  return { isExpired: true, loading: false, expiryDate: null, reason: 'invalid_role' };
}
