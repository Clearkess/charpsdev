"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAuthToken } from "@/lib/api";
import { setTokenCookie } from "@/lib/cookies";
import type { ApiResponse, LoginResponse, User } from "@/types/api";

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, password_confirmation: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setToken: (token: string | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = "charpsdev_token";

function persistToken(token: string | null) {
  if (typeof window !== "undefined") {
    if (token) window.localStorage.setItem(STORAGE_KEY, token);
    else window.localStorage.removeItem(STORAGE_KEY);
  }
  setTokenCookie(token);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setToken = (value: string | null) => {
    setTokenState(value);
    setAuthToken(value);
    persistToken(value);
  };

  const refreshUser = async () => {
    if (!token) {
      setUser(null);
      return;
    }
    setAuthToken(token);
    const response = await api.get<ApiResponse<User>>("/me");
    setUser(response.data.data);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedToken = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
        if (!storedToken) {
          setLoading(false);
          return;
        }
        setTokenState(storedToken);
        setAuthToken(storedToken);
        const response = await api.get<ApiResponse<User>>("/me");
        setUser(response.data.data);
        persistToken(storedToken);
      } catch {
        setAuthToken(null);
        persistToken(null);
        setTokenState(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post<ApiResponse<LoginResponse>>("/login", { email, password });
    const { token: nextToken, user: nextUser } = response.data.data;
    setToken(nextToken);
    setUser(nextUser);
  };

  const register = async (name: string, email: string, password: string, password_confirmation: string) => {
    await api.post("/register", { name, email, password, password_confirmation });
    await login(email, password);
  };

  const logout = async () => {
    try {
      if (token) await api.post("/logout");
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, refreshUser, setToken }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
