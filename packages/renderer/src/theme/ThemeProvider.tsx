import { createContext, useContext } from 'react';
import type { ThemeConfig } from '@hugescreen/shared';
import { DEFAULT_THEME } from '@hugescreen/shared';

const ThemeContext = createContext<ThemeConfig>(DEFAULT_THEME);

export function ThemeProvider({
  theme,
  children,
}: {
  theme: ThemeConfig;
  children: React.ReactNode;
}) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeConfig {
  return useContext(ThemeContext);
}
