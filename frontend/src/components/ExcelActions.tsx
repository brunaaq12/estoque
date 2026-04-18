import { useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { useStockItems, useWithdrawalTotals } from "@/hooks/useStockItems";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function ExcelActions() {
  const { data: items = [] } = useStockItems();
  const { data: totals = {} } = useWithdrawalTotals();
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const handleExport = () => {
    const rows = items.map((item) => ({
      "Cód Item": item.item_code,
      Nome: item.item_name,
      Quantidade: item.quantity,
      Saldo: item.quantity - (totals[item.id] || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque");
    XLSX.writeFile(wb, "estoque.xlsx");
    toast.success("Arquivo exportado!");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

    const payload = rows
      .map((row) => ({
        item_code: String(row["Cód Item"] ?? row["cod item"] ?? row["codigo"] ?? "").trim(),
        item_name: String(row["Nome"] ?? row["nome"] ?? "").trim(),
        quantity: parseInt(String(row["Quantidade"] ?? row["quantidade"] ?? "0"), 10) || 0,
      }))
      .filter((r) => r.item_code && r.item_name);

    if (payload.length === 0) {
      toast.error("Nenhum item válido encontrado na planilha.");
      return;
    }

    try {
      const { count } = await api.post<{ count: number }>("/api/items/bulk-upsert", payload);
      qc.invalidateQueries({ queryKey: ["stock_items"] });
      toast.success(`${count} itens importados!`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar planilha.");
    }

    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex gap-2">
      <Button onClick={handleExport} className="gap-2 bg-sky-500 hover:bg-sky-600 text-white">
        <Download className="h-4 w-4" /> Exportar Excel
      </Button>
      <Button onClick={() => fileRef.current?.click()} className="gap-2 bg-sky-500 hover:bg-sky-600 text-white">
        <Upload className="h-4 w-4" /> Importar Excel
      </Button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
    </div>
  );
}
