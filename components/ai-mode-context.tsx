"use client";

import React, { createContext, useContext } from "react";
import { usePathname } from "next/navigation";

interface AIModeContextType {
  isAIMode: boolean;
}

const AIModeContext = createContext<AIModeContextType | undefined>(undefined);

export function AIModeProvider({ children }: { children: React.ReactNode }) {
  // AI Mode is determined by route - automatically active in /assistant
  const pathname = usePathname();
  const isAIMode = pathname.startsWith("/assistant");

  return (
    <AIModeContext.Provider value={{ isAIMode }}>
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
