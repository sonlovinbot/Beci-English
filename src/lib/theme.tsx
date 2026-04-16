import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ThemeColor = 'slate' | 'indigo' | 'emerald';

export interface ThemeColors {
  sidebar: string;
  sidebarBorder: string;
  mobileHeader: string;
  activeItem: string;
  activeText: string;
  hoverItem: string;
  accent: string;
  accentLight: string;
  label: string;
}

const THEMES: Record<ThemeColor, ThemeColors> = {
  slate: {
    sidebar: 'bg-slate-900',
    sidebarBorder: 'border-slate-800',
    mobileHeader: 'bg-slate-900',
    activeItem: 'bg-indigo-600/20',
    activeText: 'text-indigo-400',
    hoverItem: 'hover:bg-slate-800',
    accent: 'text-indigo-500',
    accentLight: 'bg-indigo-500',
    label: 'Dark',
  },
  indigo: {
    sidebar: 'bg-indigo-950',
    sidebarBorder: 'border-indigo-900',
    mobileHeader: 'bg-indigo-950',
    activeItem: 'bg-white/15',
    activeText: 'text-amber-300',
    hoverItem: 'hover:bg-indigo-900',
    accent: 'text-amber-400',
    accentLight: 'bg-amber-500',
    label: 'Ocean',
  },
  emerald: {
    sidebar: 'bg-emerald-950',
    sidebarBorder: 'border-emerald-900',
    mobileHeader: 'bg-emerald-950',
    activeItem: 'bg-white/15',
    activeText: 'text-lime-300',
    hoverItem: 'hover:bg-emerald-900',
    accent: 'text-lime-400',
    accentLight: 'bg-lime-500',
    label: 'Forest',
  },
};

// Preview swatches for the theme picker
export const THEME_SWATCHES: Record<ThemeColor, string> = {
  slate: 'bg-slate-900',
  indigo: 'bg-indigo-950',
  emerald: 'bg-emerald-950',
};

interface ThemeContextType {
  themeColor: ThemeColor;
  theme: ThemeColors;
  setThemeColor: (color: ThemeColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeColor, setThemeColorState] = useState<ThemeColor>(() => {
    const saved = localStorage.getItem('ecc_theme');
    return (saved as ThemeColor) || 'slate';
  });

  const setThemeColor = (color: ThemeColor) => {
    setThemeColorState(color);
    localStorage.setItem('ecc_theme', color);
  };

  return (
    <ThemeContext.Provider value={{ themeColor, theme: THEMES[themeColor], setThemeColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export { THEMES };
