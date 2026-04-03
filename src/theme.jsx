import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeCtx = createContext(null);

export const themeOptions = [
  { id: 'sunset', label: '선셋 코랄', chip: 'linear-gradient(135deg,#FF6B35,#FFB36F)' },
  { id: 'ocean', label: '오션 민트', chip: 'linear-gradient(135deg,#2563EB,#14B8A6)' },
];

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('gh-theme') || 'sunset');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('gh-theme', theme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    setTheme,
    options: themeOptions,
  }), [theme]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
