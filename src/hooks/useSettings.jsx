import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('raqim-theme') || 'dark');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('raqim-font-size') || 'medium');
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('raqim-font-family') || 'Tajawal');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('raqim-accent-color') || '#3b82f6');

  // Map font-size to pixel base on root html element
  const applyFontSize = (size) => {
    const root = document.documentElement;
    switch (size) {
      case 'small':
        root.style.fontSize = '14px';
        break;
      case 'medium':
        root.style.fontSize = '16px';
        break;
      case 'large':
        root.style.fontSize = '18px';
        break;
      case 'xlarge':
        root.style.fontSize = '20px';
        break;
      default:
        root.style.fontSize = '16px';
    }
  };

  // Map accent color to CSS variables
  const applyAccentColor = (color) => {
    const root = document.documentElement;
    root.style.setProperty('--accent', color);
    
    // Generate hover color and light accent overlay
    let hoverColor = '#2563eb';
    let lightColor = 'rgba(59, 130, 246, 0.15)';
    
    if (color === '#10b981') { // emerald
      hoverColor = '#059669';
      lightColor = 'rgba(16, 185, 129, 0.15)';
    } else if (color === '#6366f1') { // indigo
      hoverColor = '#4f46e5';
      lightColor = 'rgba(99, 102, 241, 0.15)';
    } else if (color === '#f59e0b') { // amber
      hoverColor = '#d97706';
      lightColor = 'rgba(245, 158, 11, 0.15)';
    } else if (color === '#f43f5e') { // rose
      hoverColor = '#e11d48';
      lightColor = 'rgba(244, 63, 94, 0.15)';
    }
    
    root.style.setProperty('--accent-hover', hoverColor);
    root.style.setProperty('--accent-light', lightColor);
    root.style.setProperty('--border-focus', color);
  };

  // Map font-family
  const applyFontFamily = (family) => {
    const root = document.documentElement;
    let stack = `'Tajawal', system-ui, -apple-system, sans-serif`;
    
    if (family === 'Cairo') {
      stack = `'Cairo', system-ui, -apple-system, sans-serif`;
    } else if (family === 'Almarai') {
      stack = `'Almarai', system-ui, -apple-system, sans-serif`;
    } else if (family === 'IBM Plex Arabic') {
      stack = `'IBM Plex Sans Arabic', system-ui, -apple-system, sans-serif`;
    } else if (family === 'Alexandria') {
      stack = `'Alexandria', system-ui, -apple-system, sans-serif`;
    } else if (family === 'Readex Pro') {
      stack = `'Readex Pro', system-ui, -apple-system, sans-serif`;
    } else if (family === 'Vazirmatn') {
      stack = `'Vazirmatn', system-ui, -apple-system, sans-serif`;
    } else if (family === 'Changa') {
      stack = `'Changa', system-ui, -apple-system, sans-serif`;
    } else if (family === 'Noto Sans Arabic') {
      stack = `'Noto Sans Arabic', system-ui, -apple-system, sans-serif`;
    } else if (family === 'Thmanyah') {
      stack = `'Thmanyah', 'Thmanyah Regular', 'Thmanyah-Regular', 'Tajawal', system-ui, sans-serif`;
    } else if (family === 'System') {
      stack = `system-ui, -apple-system, sans-serif`;
    }
    
    root.style.setProperty('--font-sans', stack);
  };

  // Apply theme class attribute
  const applyTheme = (t) => {
    const root = document.documentElement;
    if (t === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
  };

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('raqim-theme', theme);
  }, [theme]);

  useEffect(() => {
    applyFontSize(fontSize);
    localStorage.setItem('raqim-font-size', fontSize);
  }, [fontSize]);

  useEffect(() => {
    applyFontFamily(fontFamily);
    localStorage.setItem('raqim-font-family', fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    applyAccentColor(accentColor);
    localStorage.setItem('raqim-accent-color', accentColor);
  }, [accentColor]);

  return (
    <SettingsContext.Provider value={{
      theme, setTheme,
      fontSize, setFontSize,
      fontFamily, setFontFamily,
      accentColor, setAccentColor
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
