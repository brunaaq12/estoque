import { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ClipboardCheck, FileDown, RefreshCw, Loader2, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import type { StockItem } from "@/hooks/useStockItems";

type InventoryCount = { item_id: string; physical_count: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: StockItem[];
  totals: Record<string, number>;
  onUpdateStock: (updates: { id: string; quantity: number }[]) => Promise<void>;
};

export default function InventoryDialog({ open, onOpenChange, items, totals, onUpdateStock }: Props) {
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.item_code.toLowerCase().includes(term) ||
        item.item_name.toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  // Carrega contagens salvas ao abrir
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<InventoryCount[]>("/api/inventory")
      .then((data) => {
        const counts: Record<string, string> = {};
        data.forEach((row) => { counts[row.item_id] = String(row.physical_count); });
        setPhysicalCounts(counts);
      })
      .catch(() => toast.error("Erro ao carregar contagens salvas."))
      .finally(() => setLoading(false));
  }, [open]);

  // Salva contagem individual ao sair do campo (onBlur)
  const saveCountToDB = useCallback(async (itemId: string, value: string) => {
    if (value === "" || value === undefined) return;
    const num = Number(value);
    if (isNaN(num)) return;
    await api.put(`/api/inventory/${itemId}`, { physical_count: num }).catch(console.error);
  }, []);

  const handleCountChange = (id: string, value: string) => {
    setPhysicalCounts((prev) => ({ ...prev, [id]: value }));
  };

  const handleCountBlur = (id: string) => {
    saveCountToDB(id, physicalCounts[id] ?? "");
  };

  const handleExport = () => {
    const itemsWithCount = items.filter(
      (item) => physicalCounts[item.id] !== undefined && physicalCounts[item.id] !== ""
    );
    if (itemsWithCount.length === 0) {
      toast.error("Preencha ao menos um campo de contagem física para exportar.");
      return;
    }
    const data = itemsWithCount.map((item) => {
      const withdrawn = totals[item.id] || 0;
      const balance = item.quantity - withdrawn;
      const physical =
        physicalCounts[item.id] !== undefined && physicalCounts[item.id] !== ""
          ? Number(physicalCounts[item.id])
          : "";
      return {
        Código: item.item_code,
        "Nome do Item": item.item_name,
        Quantidade: item.quantity,
        Saldo: balance,
        "Contagem Física": physical,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventário");
    XLSX.writeFile(wb, "inventario.xlsx");
    toast.success("Inventário exportado com sucesso!");
  };

  const handleUpdateStock = async () => {
    const updates: { id: string; quantity: number }[] = [];
    for (const item of items) {
      const val = physicalCounts[item.id];
      if (val !== undefined && val !== "") {
        const num = Number(val);
        if (!isNaN(num) && num >= 0) {
          const withdrawn = totals[item.id] || 0;
          updates.push({ id: item.id, quantity: num + withdrawn });
        }
      }
    }
    if (updates.length === 0) {
      toast.error("Preencha ao menos um campo de contagem física.");
      return;
    }
    try {
      setSaving(true);
      await onUpdateStock(updates);
      setPhysicalCounts((prev) => {
        const next = { ...prev };
        updates.forEach((u) => delete next[u.id]);
        return next;
      });
      toast.success(`Estoque atualizado para ${updates.length} item(ns)!`);
      onOpenChange(false);
    } catch {
      toast.error("Erro ao atualizar estoque.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" /> Inventário
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por código ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <FileDown className="h-4 w-4" /> Concluir
          </Button>
          <Button onClick={handleUpdateStock} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar Estoque
          </Button>
        </div>

        <div className="flex-1 overflow-auto rounded-lg border bg-card">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/5">
                  <TableHead className="font-semibold">Código</TableHead>
                  <TableHead className="font-semibold">Nome do Item</TableHead>
                  <TableHead className="font-semibold text-right">Quantidade</TableHead>
                  <TableHead className="font-semibold text-right">Saldo</TableHead>
                  <TableHead className="font-semibold text-center">Contagem Física</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const withdrawn = totals[item.id] || 0;
                  const balance = item.quantity - withdrawn;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono font-medium">{item.item_code}</TableCell>
                      <TableCell>{item.item_name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell
                        className={`text-right font-bold ${
                          balance <= 0
                            ? "text-destructive"
                            : balance < 5
                            ? "text-orange-500"
                            : "text-emerald-600"
                        }`}
                      >
                        {balance}
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="—"
                          value={physicalCounts[item.id] ?? ""}
                          onChange={(e) => handleCountChange(item.id, e.target.value)}
                          onBlur={() => handleCountBlur(item.id)}
                          className="w-24 mx-auto text-center"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
