import React, { useState, useEffect } from 'react';
import { Search, GraduationCap, Lock, HelpCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import logo from '../../assets/logo.png';
import compStyles from '../../styles/components.module.css';

// مساعد تحويل الأرقام إلى أرقام عربية لعرضها في الكابتشا
function toArabicNumerals(num) {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(d => arabicDigits[parseInt(d)] || d).join('');
}

export default function ResultsLookup() {
  // Input fields
  const [studentNumber, setStudentNumber] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');

  // CAPTCHA State
  const [captcha, setCaptcha] = useState({ num1: 0, num2: 0, answer: 0, question: '' });

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [results, setResults] = useState([]);
  const [lookupSuccess, setLookupSuccess] = useState(false);

  useEffect(() => {
    generateNewCaptcha();
  }, []);

  const generateNewCaptcha = () => {
    const num1 = Math.floor(Math.random() * 9) + 1; // 1 to 9
    const num2 = Math.floor(Math.random() * 9) + 1; // 1 to 9
    const answer = num1 + num2;
    const question = `كم يساوي ${toArabicNumerals(num1)} + ${toArabicNumerals(num2)} ؟`;
    setCaptcha({ num1, num2, answer, question });
    setCaptchaInput('');
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // 1. التحقق من الكابتشا أولاً
    const parsedUserAnswer = parseInt(captchaInput.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    if (isNaN(parsedUserAnswer) || parsedUserAnswer !== captcha.answer) {
      setError('إجابة التحقق غير صحيحة، يرجى المحاولة مرة أخرى.');
      generateNewCaptcha();
      setLoading(false);
      return;
    }

    try {
      // 2. البحث عن الطالب بواسطة الرقم الجامعي
      const { data: student, error: studErr } = await supabase
        .from('students')
        .select('*, departments(name), stages(name)')
        .eq('student_number', studentNumber.trim())
        .maybeSingle();

      if (studErr) throw studErr;

      if (!student) {
        setError('الرقم الجامعي المدخل غير موجود، يرجى التأكد منه.');
        generateNewCaptcha();
        setLoading(false);
        return;
      }

      // 3. جلب نتائج امتحانات الطالب
      const { data: resList, error: resErr } = await supabase
        .from('results')
        .select('*, courses(name)')
        .eq('student_id', student.id)
        .order('created_at', { ascending: true });

      if (resErr) throw resErr;

      setStudentData(student);
      setResults(resList || []);
      setLookupSuccess(true);
    } catch (err) {
      setError('حدث خطأ غير متوقع أثناء معالجة البحث.');
      generateNewCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStudentNumber('');
    setCaptchaInput('');
    setStudentData(null);
    setResults([]);
    setLookupSuccess(false);
    generateNewCaptcha();
    setError(null);
  };

  const getBadgeStyle = (grade) => {
    const colors = {
      'امتياز': { color: '#ffffff', backgroundColor: '#C9A84C' },
      'جيد جداً': { color: '#ffffff', backgroundColor: '#10B981' },
      'جيد': { color: '#ffffff', backgroundColor: '#3B82F6' },
      'متوسط': { color: '#ffffff', backgroundColor: '#F59E0B' },
      'مقبول': { color: '#ffffff', backgroundColor: '#6B7280' },
      'ضعيف': { color: '#ffffff', backgroundColor: '#EF4444' }
    };
    return colors[grade] || { color: '#ffffff', backgroundColor: 'var(--text-muted)' };
  };

  return (
    <div style={{
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh', 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: 'var(--bg-primary)',
      padding: '1.5rem',
      direction: 'rtl'
    }}>
      <div className="glass animate-fade-in" style={{
        width: '100%',
        maxWidth: '520px',
        padding: '2.5rem 2rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>
        {/* الترويسة والشعار */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <img 
            src={logo} 
            alt="Raqim Logo" 
            style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: '50%', 
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.25)', 
              border: '2px solid rgba(245, 158, 11, 0.3)',
              marginBottom: '1rem'
            }} 
          />
          <h1 style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>مَـنْـصَّـة رَقِـيـمْ</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>بوابة الاستعلام العام عن نتائج الامتحانات</p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--danger-light)',
            color: 'var(--danger)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {!lookupSuccess ? (
          /* واجهة البحث العام */
          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label} style={{ fontSize: '0.9rem' }}>الرقم الجامعي المعتمد</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  required
                  className={compStyles.input}
                  placeholder="مثال: 2023/CS/0142"
                  value={studentNumber}
                  onChange={e => setStudentNumber(e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                />
                <GraduationCap size={18} style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            {/* الكابتشا الحسابية */}
            <div className={compStyles.inputGroup}>
              <label className={compStyles.label} style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>كابتشا التحقق الأمني</span>
                <button type="button" onClick={generateNewCaptcha} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.75rem' }}>
                  <RefreshCw size={12} />
                  <span>تحديث</span>
                </button>
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.625rem 1rem',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  color: 'var(--text-primary)',
                  letterSpacing: '1px',
                  whiteSpace: 'nowrap',
                  userSelect: 'none'
                }}>
                  {captcha.question}
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input 
                    type="text" 
                    required
                    className={compStyles.input}
                    placeholder="الإجابة..."
                    value={captchaInput}
                    onChange={e => setCaptchaInput(e.target.value)}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <Lock size={18} style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={loading} style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}>
              {loading ? 'جاري التحقق والبحث...' : 'عرض النتائج والتقديرات'}
            </Button>
          </form>
        ) : (
          /* شاشة عرض النتائج المستعلم عنها */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn var(--transition-normal)' }}>
            
            {/* تفاصيل الطالب المكتشف */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '0.75rem'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{studentData?.full_name}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{studentData?.departments?.name} | {studentData?.stages?.name}</span>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 'bold' }}>{studentData?.student_number}</span>
            </div>

            {results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                لم ترفع أي درجات أو نتائج امتحانات لهذا العام الدراسي بعد.
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-secondary)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '10px', borderBottom: '1px solid var(--border)' }}>المادة</th>
                      <th style={{ padding: '10px', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>التقدير الكلي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
                        <td style={{ padding: '10px', fontWeight: '500', color: 'var(--text-primary)' }}>{r.courses?.name}</td>
                        <td style={{ padding: '10px', textAlign: 'left' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            ...getBadgeStyle(r.grade_label)
                          }}>
                            {r.grade_label === 'امتياز' ? '🏆 ' + r.grade_label : r.grade_label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button variant="secondary" onClick={resetForm} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <ArrowLeft size={16} />
              <span>الرجوع والبحث من جديد</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
