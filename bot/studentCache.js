import { supabase } from './supabase.js';

let studentsList = [];
let cacheByChatId = new Map();
let cacheByStudentNumber = new Map();
let isInitialized = false;
let initPromise = null;

/**
 * تهيئة ذاكرة التخزين المؤقت عبر تحميل كافة بيانات الطلاب من قاعدة البيانات.
 */
export const initStudentCache = async () => {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('🔄 جاري تحميل بيانات الطلاب إلى ذاكرة التخزين المؤقت (In-Memory Cache)...');
      const { data, error } = await supabase
        .from('students')
        .select('*, colleges(name, university), departments(name), stages(name)');

      if (error) throw error;

      studentsList = data || [];
      cacheByChatId.clear();
      cacheByStudentNumber.clear();

      for (const student of studentsList) {
        if (student.telegram_chat_id) {
          cacheByChatId.set(String(student.telegram_chat_id), student);
        }
        if (student.student_number) {
          cacheByStudentNumber.set(student.student_number.trim().toUpperCase(), student);
        }
      }

      isInitialized = true;
      console.log(`✅ تم تحميل وكشط ${studentsList.length} طالب في الذاكرة بنجاح.`);
    } catch (err) {
      console.error('❌ فشل تهيئة ذاكرة التخزين المؤقت للطلاب:', err);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
};

/**
 * الحصول على الطالب بواسطة معرف تليجرام.
 */
export const getStudentByChatId = async (chatId) => {
  await initStudentCache();
  return cacheByChatId.get(String(chatId)) || null;
};

/**
 * الحصول على الطالب بواسطة الرقم الجامعي (مطابقة تامة غير حساسة لحالة الأحرف).
 */
export const getStudentByNumber = async (studentNumber) => {
  await initStudentCache();
  if (!studentNumber) return null;
  const key = studentNumber.trim().toUpperCase();
  return cacheByStudentNumber.get(key) || null;
};

/**
 * البحث عن الطلاب بالاسم (مطابقة جزئية ذكية غير حساسة لحالة الأحرف).
 */
export const searchStudentsByName = async (name) => {
  await initStudentCache();
  if (!name) return [];
  const normalizedSearch = name.trim().toLowerCase();
  return studentsList.filter(s => 
    s.full_name && s.full_name.toLowerCase().includes(normalizedSearch)
  );
};

/**
 * إضافة أو تحديث طالب في ذاكرة التخزين المؤقت.
 */
export const updateStudentInCache = (student) => {
  if (!isInitialized) return;

  const index = studentsList.findIndex(s => s.id === student.id);
  if (index !== -1) {
    const oldStudent = studentsList[index];
    if (oldStudent.telegram_chat_id) {
      cacheByChatId.delete(String(oldStudent.telegram_chat_id));
    }
    if (oldStudent.student_number) {
      cacheByStudentNumber.delete(oldStudent.student_number.trim().toUpperCase());
    }
    studentsList[index] = student;
  } else {
    studentsList.push(student);
  }

  if (student.telegram_chat_id) {
    cacheByChatId.set(String(student.telegram_chat_id), student);
  }
  if (student.student_number) {
    cacheByStudentNumber.set(student.student_number.trim().toUpperCase(), student);
  }
};

/**
 * حذف طالب من ذاكرة التخزين المؤقت.
 */
export const removeStudentFromCache = (studentId) => {
  if (!isInitialized) return;
  const index = studentsList.findIndex(s => s.id === studentId);
  if (index !== -1) {
    const student = studentsList[index];
    if (student.telegram_chat_id) {
      cacheByChatId.delete(String(student.telegram_chat_id));
    }
    if (student.student_number) {
      cacheByStudentNumber.delete(student.student_number.trim().toUpperCase());
    }
    studentsList.splice(index, 1);
  }
};
