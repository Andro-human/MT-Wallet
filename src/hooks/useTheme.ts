import { useCallback, useEffect, useState } from 'react';

/** What the user picked. 'system' follows the OS and keeps following it. */
export type ThemePreference = 'night' | 'day' | 'system';
/** What is actually painted. 'system' always resolves to one of these. */
export type LedgerTheme = 'night' | 'day';

const STORAGE_KEY = 'mtwallet-theme';
const THEME_COLOR: Record<LedgerTheme, string> = {
  night: '#151210',
  day: '#F6F0E4',
};

const prefersLight = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches;

export function resolveTheme(pref: ThemePreference): LedgerTheme {
  if (pref === 'system') return prefersLight() ? 'day' : 'night';
  return pref;
}

export function readStoredPreference(): ThemePreference {
  const raw = localStorage.getItem(STORAGE_KEY);
  // 'night' and 'day' are the values written before 'system' existed, so an
  // upgrading install keeps whatever it had rather than silently switching.
  return raw === 'day' || raw === 'night' || raw === 'system' ? raw : 'night';
}

export function applyTheme(theme: LedgerTheme) {
  document.documentElement.classList.toggle('day', theme === 'day');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[theme]);
}

export function initTheme() {
  applyTheme(resolveTheme(readStoredPreference()));
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [theme, setResolved] = useState<LedgerTheme>(() => resolveTheme(readStoredPreference()));

  useEffect(() => {
    const resolved = resolveTheme(preference);
    setResolved(resolved);
    applyTheme(resolved);

    if (preference !== 'system') return;
    // Follow the OS while 'system' is selected, so flipping the phone to dark
    // at sunset repaints without reopening the app.
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      const next = resolveTheme('system');
      setResolved(next);
      applyTheme(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, next);
    setPreferenceState(next);
  }, []);

  return { theme, preference, setPreference } as const;
}
