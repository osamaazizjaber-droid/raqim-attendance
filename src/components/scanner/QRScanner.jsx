import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff } from 'lucide-react';
import styles from '../../styles/components.module.css';

/**
 * مكون مسح رموز QR باستخدام كاميرا الجهاز.
 * مغلف لمكتبة html5-qrcode.
 */
export function QRScanner({ onScanSuccess, onScanError }) {
  const [scanner, setScanner] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const containerId = 'html5-qrcode-scanner-element';

  useEffect(() => {
    // تهيئة ممسحة الـ QR
    const html5Qrcode = new Html5Qrcode(containerId);
    setScanner(html5Qrcode);

    // إلغاء تفعيل الكاميرا والمسح عند مغادرة الصفحة
    return () => {
      if (html5Qrcode.isScanning) {
        html5Qrcode.stop()
          .catch((err) => console.error('Error stopping scanner on unmount:', err));
      }
    };
  }, []);

  const startCamera = async () => {
    if (!scanner) return;
    setCameraError(null);
    try {
      await scanner.start(
        { facingMode: 'environment' }, // استخدام الكاميرا الخلفية الافتراضية
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.7; // صندوق المسح 70% من حجم الكاميرا
            return { width: size, height: size };
          },
        },
        (decodedText) => {
          // عند قراءة كود QR بنجاح
          onScanSuccess(decodedText);
        },
        (errorMessage) => {
          // أخطاء القراءة المستمرة للإطارات الفردية (نتجاهلها لتفادي إزعاج الأستاذ)
          if (onScanError) onScanError(errorMessage);
        }
      );
      setIsCameraActive(true);
    } catch (err) {
      console.error('Failed to start camera:', err);
      setCameraError('فشل الوصول إلى الكاميرا. يرجى التحقق من منح صلاحية استخدام الكاميرا للموقع وإعادة المحاولة.');
    }
  };

  const stopCamera = async () => {
    if (!scanner || !scanner.isScanning) return;
    try {
      await scanner.stop();
      setIsCameraActive(false);
    } catch (err) {
      console.error('Failed to stop camera:', err);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
      {/* حاوية الكاميرا لمكتبة html5-qrcode */}
      <div 
        id={containerId} 
        style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}
      />
      
      {/* شاشة غطاء في حال الكاميرا مغلقة أو هناك خطأ */}
      {!isCameraActive && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(10, 14, 26, 0.95)',
          gap: '1.25rem',
          padding: '2rem',
          textAlign: 'center',
          zIndex: 5
        }}>
          <Camera size={48} className={styles.emptyStateIcon} />
          {cameraError ? (
            <p style={{ color: 'var(--danger)', fontSize: '0.9rem', maxWidth: '300px' }}>{cameraError}</p>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>الكاميرا متوقفة عن العمل حالياً</p>
          )}
          <button 
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`} 
            onClick={startCamera}
            style={{ animation: 'pulseBorder 2s infinite' }}
          >
            تشغيل الكاميرا وبدء المسح
          </button>
        </div>
      )}

      {/* زر إيقاف الكاميرا العائم في حال كانت نشطة */}
      {isCameraActive && (
        <button 
          type="button"
          style={{ position: 'absolute', bottom: '1rem', right: '1rem', zIndex: 10 }}
          className={`${styles.btn} ${styles.btnDanger}`} 
          onClick={stopCamera}
        >
          <CameraOff size={16} />
          إيقاف الكاميرا
        </button>
      )}
    </div>
  );
}
