import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Intervalo de polling para dados em tempo real ──────────────
const POLL_INTERVAL = 10_000;

// ── Types ──────────────────────────────────────────────────────

export type StockItem = {
  id: string;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_measure: string;
  shelf: string | null;
  ideal_stock: number;
  category_id: string | null;
  user_name: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string | null;
  categories?: { name: string } | null;
};

export type Category = { id: string; name: string; created_at: string };
export type Obra = { id: string; obra_name: string; responsible: string; created_at: string };
export type Employee = { id: string; employee_id: string; name: string; role: string; created_at: string };
export type Application = { id: string; name: string; created_at: string };

export type WithdrawalWithItem = {
  id: string;
  withdrawal_id: string;
  item_id: string;
  quantity_withdrawn: number;
  application: string;
  responsible: string;
  obra_id: string | null;
  user_email: string | null;
  created_at: string;
  item_code?: string;
  item_name?: string;
  obra_name?: string | null;
  stock_items?: { item_code: string; item_name: string } | null;
  obras?: { obra_name: string } | null;
};

export type Replenishment = {
  id: string;
  item_id: string;
  quantity: number;
  user_name: string | null;
  created_at: string;
  item_code?: string;
  item_name?: string;
  stock_items?: { item_code: string; item_name: string } | null;
};

// ── Guard — evita o ".map is not a function" ───────────────────
// Quando a API retorna null, {} ou qualquer não-array (por falha
// de rede, timeout ou erro silencioso), esta função garante que
// o resultado é sempre um array seguro antes do .map().
function ensureArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

// ── Normalizadores ─────────────────────────────────────────────

function normalizeWithdrawal(w: WithdrawalWithItem): WithdrawalWithItem {
  return {
    ...w,
    stock_items: w.stock_items ?? (w.item_code ? { item_code: w.item_code, item_name: w.item_name ?? "" } : null),
    obras: w.obras ?? (w.obra_name ? { obra_name: w.obra_name } : null),
  };
}

function normalizeReplenishment(r: Replenishment): Replenishment {
  return {
    ...r,
    stock_items: r.stock_items ?? (r.item_code ? { item_code: r.item_code, item_name: r.item_name ?? "" } : null),
  };
}

function normalizeStockItem(s: StockItem): StockItem {
  return {
    ...s,
    categories: s.categories ?? (s.category_name ? { name: s.category_name } : null),
  };
}

// ── Stock Items — polling ativo ────────────────────────────────

export function useStockItems() {
  return useQuery({
    queryKey: ["stock_items"],
    queryFn: async () => {
      const data = await api.get<StockItem[]>("/api/items");
      return ensureArray<StockItem>(data).map(normalizeStockItem);
    },
    refetchInterval: POLL_INTERVAL,
  });
}

export function useAddStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: Partial<StockItem>) => api.post<StockItem>("/api/items", item),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock_items"] }),
  });
}

export function useUpdateStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<StockItem> & { id: string }) =>
      api.put(`/api/items/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock_items"] }),
  });
}

export function useDeleteStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock_items"] }),
  });
}

// ── Withdrawal totals — polling ativo ─────────────────────────

export function useWithdrawalTotals() {
  return useQuery({
    queryKey: ["withdrawal_totals"],
    queryFn: async () => {
      const data = await api.get<Record<string, number>>("/api/withdrawal-totals");
      return (data && typeof data === "object" && !Array.isArray(data))
        ? data as Record<string, number>
        : {} as Record<string, number>;
    },
    refetchInterval: POLL_INTERVAL,
  });
}

// ── Withdrawals — polling ativo ────────────────────────────────

export function useWithdrawals() {
  return useQuery({
    queryKey: ["withdrawals"],
    queryFn: async () => {
      const data = await api.get<WithdrawalWithItem[]>("/api/withdrawals");
      return ensureArray<WithdrawalWithItem>(data).map(normalizeWithdrawal);
    },
    refetchInterval: POLL_INTERVAL,
  });
}

export function useAddWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (w: {
      item_id: string;
      quantity_withdrawn: number;
      application: string;
      responsible: string;
      obra_id?: string;
      user_email?: string;
    }) => api.post<WithdrawalWithItem>("/api/withdrawals", w),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
      qc.invalidateQueries({ queryKey: ["withdrawal_totals"] });
    },
  });
}

export function useUpdateWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<WithdrawalWithItem> & { id: string }) =>
      api.put(`/api/withdrawals/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
      qc.invalidateQueries({ queryKey: ["withdrawal_totals"] });
    },
  });
}

export function useDeleteWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/withdrawals/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
      qc.invalidateQueries({ queryKey: ["withdrawal_totals"] });
    },
  });
}

export function useBulkDeleteWithdrawals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post("/api/withdrawals/bulk-delete", { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
      qc.invalidateQueries({ queryKey: ["withdrawal_totals"] });
    },
  });
}

// ── Obras — sem polling ────────────────────────────────────────

export function useObras() {
  return useQuery({
    queryKey: ["obras"],
    queryFn: async () => ensureArray<Obra>(await api.get<Obra[]>("/api/obras")),
  });
}

export function useAddObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (o: { obra_name: string; responsible: string }) =>
      api.post<Obra>("/api/obras", o),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obras"] }),
  });
}

export function useUpdateObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; obra_name: string; responsible: string }) =>
      api.put(`/api/obras/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obras"] }),
  });
}

export function useDeleteObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/obras/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obras"] }),
  });
}

// ── Replenishments — polling ativo ────────────────────────────

export function useReplenishments() {
  return useQuery({
    queryKey: ["replenishments"],
    queryFn: async () => {
      const data = await api.get<Replenishment[]>("/api/replenishments");
      return ensureArray<Replenishment>(data).map(normalizeReplenishment);
    },
    refetchInterval: POLL_INTERVAL,
  });
}

export function useAddReplenishment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (r: { item_id: string; quantity: number; user_name?: string | null }) =>
      api.post("/api/replenishments", r),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["replenishments"] });
      qc.invalidateQueries({ queryKey: ["stock_items"] });
    },
  });
}

export function useUpdateReplenishment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, quantity, item_id, oldQuantity,
    }: { id: string; quantity: number; item_id: string; oldQuantity: number }) =>
      api.put(`/api/replenishments/${id}`, { quantity, item_id, old_quantity: oldQuantity }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["replenishments"] });
      qc.invalidateQueries({ queryKey: ["stock_items"] });
    },
  });
}

export function useDeleteReplenishment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; item_id: string; quantity: number }) =>
      api.delete(`/api/replenishments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["replenishments"] });
      qc.invalidateQueries({ queryKey: ["stock_items"] });
    },
  });
}

export function useBulkDeleteReplenishments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (records: { id: string; item_id: string; quantity: number }[]) =>
      api.post("/api/replenishments/bulk-delete", records),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["replenishments"] });
      qc.invalidateQueries({ queryKey: ["stock_items"] });
    },
  });
}

// ── Applications — sem polling ─────────────────────────────────

export function useApplications() {
  return useQuery({
    queryKey: ["applications"],
    queryFn: async () => ensureArray<Application>(await api.get<Application[]>("/api/applications")),
  });
}

export function useAddApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { name: string }) => api.post<Application>("/api/applications", a),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applications"] }),
  });
}

export function useDeleteApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/applications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applications"] }),
  });
}

// ── Employees — sem polling ────────────────────────────────────

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => ensureArray<Employee>(await api.get<Employee[]>("/api/employees")),
  });
}

export function useAddEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: { name: string; role: string }) =>
      api.post<Employee>("/api/employees", e),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name: string; role: string }) =>
      api.put(`/api/employees/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/employees/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

// ── Categories — sem polling ───────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => ensureArray<Category>(await api.get<Category[]>("/api/categories")),
  });
}

export function useAddCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: { name: string }) => api.post<Category>("/api/categories", c),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["stock_items"] });
    },
  });
}
