import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export function useSession() {
  const { professor } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // بدء جلسة جديدة
  const startSession = async (courseId, studyType = 'صباحي') => {
    if (!professor) throw new Error('لا يوجد أستاذ مسجل');
    setLoading(true);
    setError(null);

    try {
      const { data, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          professor_id: professor.id,
          course_id: courseId,
          study_type: studyType,
          is_open: true,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      return data;
    } catch (err) {
      console.error('Error starting session:', err);
      setError(err.message || 'فشل بدء جلسة الحضور');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // إنهاء جلسة حضور
  const endSession = async (sessionId) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: sessionError } = await supabase
        .from('sessions')
        .update({
          is_open: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (sessionError) throw sessionError;
      return data;
    } catch (err) {
      console.error('Error ending session:', err);
      setError(err.message || 'فشل إنهاء الجلسة');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // تسجيل حضور طالب عبر مسح الكود
  const recordAttendance = async (sessionId, qrToken) => {
    setError(null);
    try {
      // 1. التأكد أولاً من أن الجلسة ما زالت مفتوحة
      const { data: sessionData, error: sessionCheckError } = await supabase
        .from('sessions')
        .select('is_open, study_type')
        .eq('id', sessionId)
        .single();

      if (sessionCheckError) throw sessionCheckError;
      if (!sessionData || !sessionData.is_open) {
        throw new Error('انتهت جلسة الحضور');
      }

      // 2. البحث عن الطالب عبر التوكن الفريد
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('qr_token', qrToken)
        .maybeSingle();

      if (studentError) throw studentError;
      if (!studentData) {
        throw new Error('رمز البطاقة غير مسجل لأي طالب في النظام');
      }

      // التحقق من توافق نوع الدراسة (صباحي/مسائي) لمنع الخلط
      if (sessionData.study_type && studentData.study_type && sessionData.study_type !== studentData.study_type) {
        throw new Error(`عذراً، الطالب يدرس في القسم (${studentData.study_type}) بينما المحاضرة الحالية مخصصة للقسم (${sessionData.study_type}) ❌`);
      }

      // 3. التحقق من التكرار في الحضور
      const { data: existingAttendance, error: attendCheckError } = await supabase
        .from('attendance')
        .select('id')
        .eq('session_id', sessionId)
        .eq('student_id', studentData.id)
        .maybeSingle();

      if (attendCheckError) throw attendCheckError;
      if (existingAttendance) {
        return { 
          success: false, 
          isDuplicate: true, 
          message: 'تم تسجيل هذا الطالب مسبقاً ✋', 
          student: studentData 
        };
      }

      // 4. إدراج الحضور
      const { error: insertError } = await supabase
        .from('attendance')
        .insert({
          session_id: sessionId,
          student_id: studentData.id,
          scanned_at: new Date().toISOString()
        });

      if (insertError) {
        // حماية إضافية لو حدث سباق إدخال بقيد Unique في قاعدة البيانات
        if (insertError.code === '23505') {
          return { 
            success: false, 
            isDuplicate: true, 
            message: 'تم تسجيل هذا الطالب مسبقاً ✋', 
            student: studentData 
          };
        }
        throw insertError;
      }

      return { 
        success: true, 
        isDuplicate: false, 
        message: 'تم تسجيل الحضور بنجاح ✅', 
        student: studentData 
      };
    } catch (err) {
      console.error('Error recording attendance:', err);
      setError(err.message || 'فشل تسجيل الحضور');
      throw err;
    }
  };

  return {
    startSession,
    endSession,
    recordAttendance,
    loading,
    error,
  };
}
