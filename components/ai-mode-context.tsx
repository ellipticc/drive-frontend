"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface AIModeContextType {
  isAIMode: boolean;
  setIsAIMode: (value: boolean) => void;
  isHydrated: boolean;
}

const AIModeContext = createContext<AIModeContextType | undefined>(undefined);

export function AIModeProvider({ children }: { children: React.ReactNode }) {
  const [isAIMode, setIsAIModeState] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai-native-mode");
      if (saved !== null) {
        setIsAIModeState(saved === "true");
      }
    } catch (e) {
      console.error("Failed to read AI native mode from localStorage", e);
    }
    setIsHydrated(true);
  }, []);

  const setIsAIMode = (value: boolean) => {
    setIsAIModeState(value);
    try {
      localStorage.setItem("ai-native-mode", String(value));
    } catch (e) {
      console.error("Failed to save AI native mode to localStorage", e);
    }
  };

  return (
    <AIModeContext.Provider value={{ isAIMode, setIsAIMode, isHydrated }}>
      {children}
    </AIModeContext.Provider>
  );
}

export function useAIMode() {
  const context = useContext(AIModeContext);
  if (!context) {
    throw new Error("useAIMode must be used within AIModeProvider");
  }
  return context;
}
