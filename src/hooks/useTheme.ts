import { useEffect, useState } from 'react';
export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('nexus-theme');
      return saved === 'dark' || saved === 'light'
        ? saved
        : window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('nexus-theme', theme);
    } catch {
      /* A preferência continua válida na sessão quando o armazenamento está indisponível. */
    }
  }, [theme]);
  return { theme, setTheme };
}
