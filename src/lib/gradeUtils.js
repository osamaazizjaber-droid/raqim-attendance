const GRADE_SCORES = {
  'امتياز':   6,
  'جيد جداً': 5,
  'جيد':      4,
  'متوسط':    3,
  'مقبول':    2,
  'ضعيف':     1,
};

const GRADE_FROM_SCORE = [
  { min: 5.5, label: 'امتياز' },
  { min: 4.5, label: 'جيد جداً' },
  { min: 3.5, label: 'جيد' },
  { min: 2.5, label: 'متوسط' },
  { min: 1.5, label: 'مقبول' },
  { min: 0,   label: 'ضعيف' },
];

/**
 * حساب التقدير العام بناءً على متوسط تقديرات المواد.
 */
export const computeOverallGrade = (results) => {
  if (!results || results.length === 0) return 'ضعيف';
  const totalPoints = results.reduce((sum, r) => sum + (GRADE_SCORES[r.grade_label] || 1), 0);
  const avg = totalPoints / results.length;
  return GRADE_FROM_SCORE.find(g => avg >= g.min)?.label || 'ضعيف';
};

/**
 * الطالب ناجح إذا لم يحصل على تقدير "ضعيف" في أي مادة.
 */
export const computeIsPassed = (results) => {
  if (!results || results.length === 0) return false;
  return !results.some(r => r.grade_label === 'ضعيف');
};
