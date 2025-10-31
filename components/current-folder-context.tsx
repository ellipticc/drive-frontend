"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CurrentFolderContextType {
  currentFolderId: string | null;
  setCurrentFolderId: (folderId: string | null) => void;
}

const CurrentFolderContext = createContext<CurrentFolderContextType | null>(null);

export function useCurrentFolder() {
  const context = useContext(CurrentFolderContext);
  if (!context) {
    throw new Error('useCurrentFolder must be used within a CurrentFolderProvider');
  }
  return context;
}

interface CurrentFolderProviderProps {
  children: ReactNode;
}

export function CurrentFolderProvider({ children }: CurrentFolderProviderProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  return (
    <CurrentFolderContext.Provider value={{ currentFolderId, setCurrentFolderId }}>
      {children}
    </CurrentFolderContext.Provider>
  );
}