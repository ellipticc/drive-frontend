"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { apiClient } from "@/lib/api";
import { keyManager } from "@/lib/key-manager";
import { masterKeyManager } from "@/lib/master-key";

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
  crypto_keypairs?: {
    accountSalt?: string;
    [key: string]: unknown;
  };
  // Optional authentication method (e.g., 'wallet')
  authMethod?: string;
}

interface UserContextType {
  user: UserData | null;
  loading: boolean;
  error: string | null;
  deviceLimitReached: boolean;
  deviceQuota: { planName: string; maxDevices: number } | null;
  refetch: () => Promise<void>;
  updateStorage: (delta: number) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Local storage key for user data
const USER_DATA_KEY = 'user_profile_data';
const USER_DATA_TIMESTAMP_KEY = 'user_profile_timestamp';

// Cache user data for 24 hours
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Helper functions for localStorage
const saveUserDataToCache = (userData: UserData) => {
  try {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
    localStorage.setItem(USER_DATA_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.warn('Failed to save user data to cache:', error);
  }
};

const getUserDataFromCache = (): UserData | null => {
  try {
    const cachedData = localStorage.getItem(USER_DATA_KEY);
    const timestamp = localStorage.getItem(USER_DATA_TIMESTAMP_KEY);

    if (!cachedData || !timestamp) {
      return null;
    }

    const cacheAge = Date.now() - parseInt(timestamp);
    if (cacheAge > CACHE_DURATION) {
      // Cache is expired, remove it
      localStorage.removeItem(USER_DATA_KEY);
      localStorage.removeItem(USER_DATA_TIMESTAMP_KEY);
      return null;
    }

    return JSON.parse(cachedData);
  } catch (error) {
    console.warn('Failed to load user data from cache:', error);
    return null;
  }
};

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceLimitReached, setDeviceLimitReached] = useState(false);
  const [deviceQuota, setDeviceQuota] = useState<{ planName: string; maxDevices: number } | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const pathname = usePathname();

  // Routes that should skip user profile fetching
  const skipFetchRoutes = ['/login', '/signup', '/otp', '/recover', '/backup', '/totp', '/totp/recovery'];
  const shouldSkipFetch = skipFetchRoutes.includes(pathname) || pathname.startsWith('/s/');

  const fetchFreshUserData = useCallback(async () => {
    // Skip for public/auth routes
    if (shouldSkipFetch) {
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

    console.log('UserProvider: Fetching fresh user profile with token...');
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getProfile();

      // Check for device limit reached in response (even if success is false)
      if ((response as any).limitReached || (response.data as any)?.limitReached) {
        setDeviceLimitReached(true);
        const quota = (response as any).deviceQuota || (response.data as any)?.deviceQuota;
        if (quota) setDeviceQuota(quota);
      } else {
        setDeviceLimitReached(false);
      }

      if (response.success && response.data?.user) {
        console.log('UserProvider: Successfully fetched fresh user profile');
        const userData = response.data.user;

        // Initialize KeyManager with user's crypto data (critical for uploads and file access)
        try {
          await keyManager.initialize(userData);
          console.log('UserProvider: KeyManager initialized with user crypto data');
        } catch (error) {
          console.warn('UserProvider: Failed to initialize KeyManager:', error);
        }

        // Validate master key matches current account salt from server
        if (userData.crypto_keypairs?.accountSalt) {
          const serverAccountSalt = userData.crypto_keypairs.accountSalt;
          const isValidMasterKey = masterKeyManager.validateMasterKeyForSalt(serverAccountSalt);

          if (!isValidMasterKey) {
            console.warn('UserProvider: Cached master key does not match server account salt');
            if (typeof window !== 'undefined') {
              localStorage.removeItem('master_key');
              localStorage.removeItem('account_salt');
              sessionStorage.removeItem('master_key');
              sessionStorage.removeItem('account_salt');
            }
          }
        }

        setUser(userData);
        setHasFetched(true);
        // Cache the user data
        saveUserDataToCache(userData);
      } else {
        console.log('UserProvider: Failed to fetch user profile:', response.error);

        // If it's just a device limit, we continue but mark it
        if (!(response as any).limitReached) {
          throw new Error(response.error || 'Failed to fetch user');
        }
      }
    } catch (err) {
      console.log('UserProvider: Error fetching user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user');
      setHasFetched(true);
    } finally {
      setLoading(false);
    }
  }, [shouldSkipFetch]);

  const fetchUser = useCallback(async (forceRefresh = false) => {
    if (shouldSkipFetch) {
      setLoading(false);
      return;
    }

    if (!forceRefresh && hasFetched && user !== null) {
      setLoading(false);
      return;
    }

    if (!forceRefresh) {
      const cachedUser = getUserDataFromCache();
      if (cachedUser) {
        setUser(cachedUser);
        setLoading(false);
        setHasFetched(true);
        fetchFreshUserData();
        return;
      }
    }

    await fetchFreshUserData();
  }, [shouldSkipFetch, hasFetched, user, fetchFreshUserData]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const refetch = async () => {
    setHasFetched(false);
    await fetchUser(true);
  };

  const updateStorage = (delta: number) => {
    setUser(prevUser => {
      if (!prevUser || !prevUser.storage) return prevUser;

      const newUsedBytes = Math.max(0, prevUser.storage.used_bytes + delta);
      const newPercentUsed = (newUsedBytes / prevUser.storage.quota_bytes) * 100;

      const updatedUser = {
        ...prevUser,
        storage: {
          ...prevUser.storage,
          used_bytes: newUsedBytes,
          percent_used: newPercentUsed,
          used_readable: formatBytes(newUsedBytes),
        }
      };

      saveUserDataToCache(updatedUser);
      return updatedUser;
    });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  useEffect(() => {
    const handleLogin = () => {
      setHasFetched(false);
      fetchUser(true);
    };

    window.addEventListener('user-login', handleLogin);
    return () => window.removeEventListener('user-login', handleLogin);
  }, [fetchUser]);

  return (
    <UserContext.Provider value={{ user, loading, error, deviceLimitReached, deviceQuota, refetch, updateStorage }}>
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
