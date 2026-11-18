"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface CreditsContextValue {
  credits: number;
  charge: (amount: number) => void;
  add: (amount: number) => void;
}

const CreditsContext = createContext<CreditsContextValue | null>(null);

/** Holds the balance the server read, and applies charges as generations are accepted. */
export function CreditsProvider({ initial, children }: { initial: number; children: ReactNode }) {
  const [credits, setCredits] = useState(initial);
  const charge = useCallback((amount: number) => {
    setCredits((current) => Math.max(0, current - amount));
  }, []);
  const add = useCallback((amount: number) => {
    setCredits((current) => current + amount);
  }, []);
  return <CreditsContext.Provider value={{ credits, charge, add }}>{children}</CreditsContext.Provider>;
}

export function useCredits(): CreditsContextValue {
  const value = useContext(CreditsContext);
  if (!value) throw new Error("useCredits must be used inside CreditsProvider");
  return value;
}
