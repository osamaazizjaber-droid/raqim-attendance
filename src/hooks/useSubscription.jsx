import { useAuth } from './useAuth';

/**
 * خطاف مخصص للتحقق من حالة اشتراك الأستاذ.
 * يتيح للمشرفين الدخول دائماً، ويتحقق من تاريخ صلاحية اشتراك الأستاذ.
 */
export function useSubscription() {
  const { professor, isAdmin, loading: authLoading } = useAuth();

  if (authLoading) {
    return { isExpired: false, loading: true, expiryDate: null };
  }

  // إذا كان مديراً عاماً، لا توجد قيود اشتراك
  if (isAdmin) {
    return { isExpired: false, loading: false, expiryDate: null };
  }

  // إذا لم يكن أستاذ ولا أدمن، يعتبر منتهي الصلاحية لحماية الواجهات
  if (!professor) {
    return { isExpired: true, loading: false, expiryDate: null };
  }

  // مقارنة التواريخ
  const expiry = new Date(professor.subscription_expires_at);
  const today = new Date();
  
  // تصفير الوقت للمقارنة باليوم فقط
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  const isExpired = expiry < today;

  return {
    isExpired,
    loading: false,
    expiryDate: professor.subscription_expires_at,
  };
}
