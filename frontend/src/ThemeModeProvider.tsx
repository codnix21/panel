import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeProvider } from '@gravity-ui/uikit';

type Theme = 'light' | 'dark';

const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null);

export function useThemeMode() {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error('useThemeMode outside provider');
  return v;
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const s = localStorage.getItem('panel-theme') as Theme | null;
    return s === 'light' || s === 'dark' ? s : 'dark';
  });
  useEffect(() => {
    localStorage.setItem('panel-theme', theme);
  }, [theme]);
  return (
    <ThemeCtx.Provider value={{ theme, setTheme }}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ThemeCtx.Provider>
  );
}
