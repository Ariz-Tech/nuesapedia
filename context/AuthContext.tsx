"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { clearUserSavedCache } from "@/lib/saved-client";
import {
  clearLocalReadingProgress,
  clearAllOfflineDocuments,
} from "@/lib/offline-vault";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  department: string;
  level: string;
  role?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => null,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const inFlightRef = useRef<Promise<AuthUser | null> | null>(null);

  const fetchMe = useCallback(async (): Promise<AuthUser | null> => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const promise = (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.success && data?.user ? (data.user as AuthUser) : null;
      } catch {
        return null;
      } finally {
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = promise;
    return promise;
  }, []);

  const refresh = useCallback(async () => {
    const fetched = await fetchMe();
    setUser(fetched);
    setLoading(false);
    return fetched;
  }, [fetchMe]);

  const logout = useCallback(async () => {
    const activeUserId = user?.id;
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network error during logout
    }

    // Purge user-scoped local caches so shared computers never leak data to the next user
    clearUserSavedCache(activeUserId);
    await clearLocalReadingProgress();
    await clearAllOfflineDocuments();
    if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "CLEAR_USER_CACHE" });
    }

    setUser(null);
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    (async () => {
      const fetched = await fetchMe();
      if (active) {
        setUser(fetched);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchMe]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
