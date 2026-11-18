"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePreference = "system" | "light" | "dark";
type Resolved = "light" | "dark";

const STORAGE_KEY = "theme";

/** Inlined in <head> so the stored preference resolves before paint. Dark is the default. */
export const THEME_INIT_SCRIPT = `(function(){var t='dark';try{var s=localStorage.getItem('${STORAGE_KEY}');if(s==='light'||s==='dark')t=s;else if(s==='system')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}catch(e){}document.documentElement.dataset.theme=t;})();`;

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: Resolved;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolve(preference: ThemePreference): Resolved {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");
  const [resolved, setResolved] = useState<Resolved>("dark");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") setPreferenceState(stored);
    } catch {
      // Storage unavailable: stay on the default.
    }
  }, []);

  useEffect(() => {
    const apply = () => {
      const next = resolve(preference);
      document.documentElement.dataset.theme = next;
      setResolved(next);
    };
    apply();
    if (preference !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: light)");
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-persistent is fine.
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
