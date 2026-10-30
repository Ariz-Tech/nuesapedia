"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  department: string;
  level: string;
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

let cachedUser: AuthUser | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 30000; // 30 seconds cache to eliminate repeated fetches on every navigation
let inFlightPromise: Promise<AuthUser | null> | null = null;

async function fetchAuthUser(force = false): Promise<AuthUser | null> {
  const now = Date.now();
  if (!force && cachedUser && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedUser;
  }
  if (!force && inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        cachedUser = null;
        lastFetchTime = now;
        return null;
      }
      const data = await res.json();
      if (data?.success && data?.user) {
        cachedUser = data.user;
        lastFetchTime = now;
        return data.user;
      }
      cachedUser = null;
      lastFetchTime = now;
      return null;
    } catch {
      cachedUser = null;
      return null;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(cachedUser);
  const [loading, setLoading] = useState(cachedUser === null);

  const refresh = useCallback(async () => {
    const fetched = await fetchAuthUser(true);
    setUser(fetched);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    cachedUser = null;
    lastFetchTime = 0;
    setUser(null);
  }, []);

  useEffect(() => {
    fetchAuthUser(false).then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
