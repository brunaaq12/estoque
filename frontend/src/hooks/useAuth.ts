import { useState, useEffect, useCallback } from "react";
import { api, setToken, clearToken, getToken } from "@/lib/api";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "user";
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Verifica se há token salvo e carrega o usuário ao montar
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<AuthUser>("/auth/me")
      .then((u) => setUser(u))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { token, user: u } = await api.post<{ token: string; user: AuthUser }>(
        "/auth/login",
        { email, password }
      );
      setToken(token);
      setUser(u);
      return u;
    },
    []
  );

  const signUp = useCallback(
    async (email: string, password: string, full_name?: string) => {
      const { token, user: u } = await api.post<{ token: string; user: AuthUser }>(
        "/auth/register",
        { email, password, full_name }
      );
      setToken(token);
      setUser(u);
      return u;
    },
    []
  );

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    fullName: user?.full_name ?? null,
  };
}
