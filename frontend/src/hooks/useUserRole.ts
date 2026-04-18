import { useAuth } from "./useAuth";

// Role já vem embutida no JWT — sem roundtrip extra ao banco
export function useUserRole() {
  const { user, loading } = useAuth();
  const role = user?.role ?? "user";
  return { role, isAdmin: role === "admin", isLoading: loading };
}
