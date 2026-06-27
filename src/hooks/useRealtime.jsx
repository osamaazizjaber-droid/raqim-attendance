import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * خطاف مخصص للاستماع الفوري لحضور الطلاب في جلسة معينة.
 * @param {string} sessionId معرف جلسة الحضور الحالية
 * @returns {Object} { presentStudents: Array, loading: boolean }
 */
export function useRealtime(sessionId) {
  const [presentStudents, setPresentStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    // 1. جلب الطلاب الحاضرين مسبقاً في الجلسة
    const fetchInitialAttendance = async () => {
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('id, scanned_at, students(*)')
          .eq('session_id', sessionId)
          .order('scanned_at', { ascending: false });

        if (error) throw error;

        if (data) {
          const formatted = data
            .filter(item => item.students !== null)
            .map(item => ({
              attendanceId: item.id,
              scanned_at: item.scanned_at,
              ...item.students,
            }));
          setPresentStudents(formatted);
        }
      } catch (err) {
        console.error('Error fetching initial attendance:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialAttendance();

    // 2. الاشتراك في الأحداث اللحظية لجدول الحضور (فقط الإضافة INSERT الخاصة بهذه الجلسة)
    const channel = supabase
      .channel(`session_attendance:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          try {
            // جلب تفاصيل الطالب لأن السجل الجديد يحتوي فقط على student_id
            const { data: studentData, error: studentError } = await supabase
              .from('students')
              .select('*')
              .eq('id', payload.new.student_id)
              .single();

            if (studentError) throw studentError;

            if (studentData) {
              setPresentStudents((prev) => {
                // منع التكرار في حالة تحديث الواجهة المتزامن
                if (prev.some((s) => s.id === studentData.id)) return prev;
                
                return [
                  {
                    attendanceId: payload.new.id,
                    scanned_at: payload.new.scanned_at,
                    ...studentData,
                  },
                  ...prev, // إضافة الطالب الجديد في الأعلى (الأحدث أولاً)
                ];
              });
            }
          } catch (err) {
            console.error('Error processing realtime attendance insert:', err);
          }
        }
      )
      .subscribe();

    // إلغاء الاشتراك عند انتهاء مفعول المكون
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return {
    presentStudents,
    loading,
    setPresentStudents, // للسماح بتحديث الحالة محلياً فوراً عند الحاجة
  };
}
