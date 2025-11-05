"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiClient } from "@/lib/api";

interface UserData {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  storage?: {
    used_bytes: number;
    quota_bytes: number;
    percent_used: number;
    used_readable: string;
    quota_readable: string;
  };
  crypto_keypairs?: any;
  [key: string]: any;
}

interface UserContextType {
  user: UserData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchUser = async () => {
    // Only fetch once unless explicitly refetching
    if (hasFetched && user !== null) {
      setLoading(false);
      return;
    }

    // Double-check token exists before making request
    const token = apiClient.getAuthToken();
    if (!token) {
      console.log('UserProvider: No token available, skipping profile fetch');
      setLoading(false);
      setHasFetched(true);
      return;
    }

    console.log('UserProvider: Fetching user profile with token...');
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getProfile();
      
      if (response.success && response.data?.user) {
        console.log('UserProvider: Successfully fetched user profile');
        setUser(response.data.user);
        setHasFetched(true);
      } else {
        console.log('UserProvider: Failed to fetch user profile:', response.error);
        throw new Error(response.error || 'Failed to fetch user');
      }
    } catch (err) {
      console.log('UserProvider: Error fetching user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user');
      setHasFetched(true);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user on mount
  useEffect(() => {
    fetchUser();
  }, []);

  const refetch = async () => {
    setHasFetched(false);
    await fetchUser();
  };

  return (
    <UserContext.Provider value={{ user, loading, error, refetch }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
}
