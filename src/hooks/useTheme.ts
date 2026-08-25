import { useCallback, useEffect, useState } from 'react';

export type LedgerTheme = 'night' | 'day';

const STORAGE_KEY = 'mtwallet-theme';
const THEME_COLOR: Record<LedgerTheme, string> = {
  night: '#151210',
  day: '#F6F0E4',
};

function readStoredTheme(): LedgerTheme {
  return localStorage.getItem(STORAGE_KEY) === 'day' ? 'day' : 'night';
}

export function applyTheme(theme: LedgerTheme) {
  document.documentElement.classList.toggle('day', theme === 'day');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[theme]);
}

export function initTheme() {
  applyTheme(readStoredTheme());
}

export function useTheme() {
  const [theme, setThemeState] = useState<LedgerTheme>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: LedgerTheme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  return { theme, setTheme } as const;
}
