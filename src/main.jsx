import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// 1. تسجيل الـ Service Worker لدعم الـ PWA والتثبيت على أجهزة الموبايل والكمبيوتر
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('Service Worker registered successfully with scope:', reg.scope);
      })
      .catch((err) => {
        console.error('Service Worker registration failed:', err);
      });
  });
}

// 2. حماية المنصة ومنع استخدام أدوات المطورين أو النقر الأيمن
document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  // منع زر F12
  if (e.key === 'F12') {
    e.preventDefault();
    return false;
  }
  
  // منع Ctrl + Shift + I (Inspect)
  // منع Ctrl + Shift + J (Console)
  // منع Ctrl + Shift + C (Element selector)
  // منع Ctrl + U (View Source)
  if (e.ctrlKey && (
    (e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
    e.key.toUpperCase() === 'U'
  )) {
    e.preventDefault();
    return false;
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
