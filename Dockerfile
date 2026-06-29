# Dockerfile
FROM node:18-alpine

# ضبط مجلد العمل
WORKDIR /app

# نسخ ملفات الحزم الرئيسية
COPY package*.json ./

# تثبيت مكتبات المشروع الرئيسي
RUN npm install

# نسخ ملفات حزم البوت وتثبيتها
COPY bot/package*.json ./bot/
RUN cd bot && npm install

# نسخ بقية ملفات المشروع
COPY . .

# منفذ Hugging Face الافتراضي هو 7860
EXPOSE 7860
ENV PORT=7860

# تشغيل البوت
CMD ["npm", "start"]
