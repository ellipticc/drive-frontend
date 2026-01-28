"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from "react";
import { usePathname } from "next/navigation";
import { apiClient, type UserData, type UserPreferences } from "@/lib/api";
import { keyManager } from "@/lib/key-manager";
import { masterKeyManager } from "@/lib/master-key";

interface UserContextType {
  user: UserData | null;
  loading: boolean;
  error: string | null;
  deviceLimitReached: boolean;
  deviceQuota: { planName: string; maxDevices: number } | null;
  preferences: any | null; // Using any for simplicity as it's defined in api.ts
  refetch: () => Promise<void>;
  updateStorage: (delta: number) => void;
  updateUser: (data: Partial<UserData>) => void;
  updatePreferences: (data: any) => Promise<any>;
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
  const [preferences, setPreferences] = useState<any | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const lastSubFetchTime = useRef<number>(0);
  const userRef = useRef<UserData | null>(user);
  const pathname = usePathname();

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Routes that should skip user profile fetching
  const skipFetchRoutes = ['/login', '/signup', '/otp', '/recover', '/backup', '/totp', '/totp/recovery'];
  const shouldSkipFetch = skipFetchRoutes.includes(pathname) || pathname.startsWith('/s/');

  const updateUser = useCallback((data: Partial<UserData>) => {
    setUser(prevUser => {
      if (!prevUser) return prevUser;
      const updatedUser = { ...prevUser, ...data };
      saveUserDataToCache(updatedUser);
      return updatedUser;
    });
  }, []);

  const fetchFreshUserData = useCallback(async (force = false) => {
    // Skip for public/auth routes
    if (shouldSkipFetch) {
      setLoading(false);
      try {
        const overlay = document.getElementById('initial-loading-overlay');
        if (overlay) overlay.remove();
      } catch (e) { }
      return;
    }

    // Double-check token exists before making request
    const token = apiClient.getAuthToken();
    if (!token) {
      console.log('UserProvider: No token available, skipping profile fetch');
      setLoading(false);
      setHasFetched(true);
      try {
        const overlay = document.getElementById('initial-loading-overlay');
        if (overlay) {
          overlay.style.opacity = '0';
          setTimeout(() => {
            try { overlay.remove(); } catch (e) { }
          }, 500);
        }
      } catch (e) { }
      return;
    }

    console.log('UserProvider: Fetching fresh user profile with token...');
    try {
      setLoading(true);
      setError(null);
      const [profileResponse, preferencesResponse] = await Promise.all([
        apiClient.getProfile(),
        apiClient.getPreferences()
      ]);

      const response = profileResponse;
      if (preferencesResponse.success) {
        setPreferences(preferencesResponse.data);
      }

      // Extract device quota and limit status
      const limitReached = response.data?.limitReached || false;
      const quota = response.data?.deviceQuota;

      setDeviceLimitReached(limitReached);
      if (quota) {
        setDeviceQuota(quota);
      }

      if (response.success && response.data?.user) {
        const userData = response.data.user;

        // Only fetch subscription if forced or not fetched in the last 30 seconds
        const now = Date.now();
        if (force || (now - lastSubFetchTime.current > 30000)) {
          console.log('UserProvider: Fetching fresh subscription status...');
          try {
            const subResponse = await apiClient.getSubscriptionStatus();
            if (subResponse.success && subResponse.data?.subscription) {
              const sub = subResponse.data.subscription;
              userData.subscription = {
                ...sub,
                cancelAtPeriodEnd: typeof sub.cancelAtPeriodEnd === 'boolean' ? (sub.cancelAtPeriodEnd ? 1 : 0) : sub.cancelAtPeriodEnd,
                currentPeriodStart: String(sub.currentPeriodStart),
                currentPeriodEnd: String(sub.currentPeriodEnd),
                plan: {
                  ...sub.plan,
                  interval: (sub.plan as { interval?: string }).interval || 'month'
                }
              };
              lastSubFetchTime.current = now;
            }
          } catch (subError) {
            console.warn('UserProvider: Failed to fetch subscription status:', subError);
          }
        } else {
          // If skip fetch, keep existing subscription data from current user state if available
          if (userRef.current?.subscription) {
            userData.subscription = userRef.current.subscription;
          } else {
            // Check cache if user state is empty
            const cached = getUserDataFromCache();
            if (cached?.subscription) {
              userData.subscription = cached.subscription;
            }
          }
        }

        // Initialize KeyManager with user's crypto data (critical for uploads and file access)
        try {
          await keyManager.initialize(userData);
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
        if (userData.preferences) {
          setPreferences(userData.preferences);
        }
        setHasFetched(true);

        // Sync session configuration if present
        if (userData.sessionDuration) {
          try {
            const config = {
              sessionExpiry: userData.sessionDuration,
              remindBeforeExpiry: 300 // default 5 mins
            };
            localStorage.setItem('session_config', JSON.stringify(config));
            console.log('UserProvider: Session configuration synced from server:', userData.sessionDuration);
          } catch (storageError) {
            console.warn('UserProvider: Failed to sync session config to localStorage:', storageError);
          }
        }

        // Cache the user data
        saveUserDataToCache(userData);
      } else {
        console.log('UserProvider: Failed to fetch user profile:', response.error);

        // If it's just a device limit, we continue but mark it
        if (!response.data?.limitReached) {
          throw new Error(response.error || 'Failed to fetch user');
        }
      }
    } catch (err) {
      console.log('UserProvider: Error fetching user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user');
      setHasFetched(true);
    } finally {
      setLoading(false);
      try {
        const overlay = document.getElementById('initial-loading-overlay');
        if (overlay) {
          overlay.style.opacity = '0';
          setTimeout(() => {
            try { overlay.remove(); } catch (e) { }
          }, 500);
        }
      } catch (e) { }
    }
  }, [shouldSkipFetch]);

  const fetchUser = useCallback(async (forceRefresh = false) => {
    if (shouldSkipFetch) {
      setLoading(false);
      return;
    }

    if (!forceRefresh && hasFetched) {
      setLoading(false);
      return;
    }

    if (!forceRefresh) {
      const cachedUser = getUserDataFromCache();
      if (cachedUser) {
        setUser(cachedUser);
        setHasFetched(true);
        // Keep `loading` true until `fetchFreshUserData` completes so we don't flash UI based on stale cache
        fetchFreshUserData(false);
        return;
      }
    }

    await fetchFreshUserData(forceRefresh);
  }, [shouldSkipFetch, hasFetched, fetchFreshUserData]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const refetch = async () => {
    setHasFetched(false);
    await fetchUser(true);
  };

  const updatePreferences = useCallback(async (data: any) => {
    try {
      const response = await apiClient.updatePreferences(data);
      if (response.success) {
        setPreferences((prev: UserPreferences) => ({ ...prev, ...data }));
        // Also update user profile preferences if they exist there
        setUser((prev: UserData | null) => prev ? { ...prev, preferences: { ...prev.preferences, ...data } } : null);
      }
      return response;
    } catch (err) {
      console.error("Failed to update preferences:", err);
      throw err;
    }
  }, []);

  const updateStorage = (delta: number) => {
    setUser((prevUser: UserData | null) => {
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
      refetch();
    };

    window.addEventListener('user-login', handleLogin);
    return () => window.removeEventListener('user-login', handleLogin);
  }, [refetch]);

  return (
    <UserContext.Provider value={{ user, loading, error, deviceLimitReached, deviceQuota, preferences, refetch, updateStorage, updateUser, updatePreferences }}>
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
