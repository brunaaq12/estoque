import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { useStockItems, useReplenishments, useAddReplenishment, useUpdateReplenishment, useDeleteReplenishment, useBulkDeleteReplenishments, useWithdrawalTotals, useWithdrawals } from "@/hooks/useStockItems";
import BulkDeleteByPeriod from "@/components/BulkDeleteByPeriod";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Plus, PackagePlus, ShoppingCart, Trash2, FileSpreadsheet, Pencil, FileText, CalendarIcon, Trophy, Download } from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

type MonthlyItem = { item_id: string; item_code: string; item_name: string; quantity: number };

function formatCode(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length > 2) return digits.slice(0, 2) + "." + digits.slice(2);
  return digits;
}

export default function ReplenishmentManager() {
  const { isAdmin } = useUserRole();
  const { user, fullName } = useAuth();
  const { data: items = [] } = useStockItems();
  const { data: replenishments = [], isLoading } = useReplenishments();
  const { data: withdrawalTotals = {} } = useWithdrawalTotals();
  const { data: withdrawals = [] } = useWithdrawals();
  const addReplenishment = useAddReplenishment();
  const updateReplenishment = useUpdateReplenishment();
  const deleteReplenishment = useDeleteReplenishment();
  const bulkDeleteReplenishments = useBulkDeleteReplenishments();

  const [codeInput, setCodeInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [qty, setQty] = useState("");

  // Edit replenishment
  const [editRepId, setEditRepId] = useState<string | null>(null);
  const [editRepQty, setEditRepQty] = useState("");
  const [editRepItemId, setEditRepItemId] = useState("");
  const [editRepOldQty, setEditRepOldQty] = useState(0);

  // Monthly list state
  const [monthlyOpen, setMonthlyOpen] = useState(false);
  const [monthlyList, setMonthlyList] = useState<MonthlyItem[]>(() => {
    try {
      const saved = localStorage.getItem("monthly_replenishment_list");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Report state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState<Date | undefined>();
  const [reportDateTo, setReportDateTo] = useState<Date | undefined>();

  // Ranking state
  const [rankingOpen, setRankingOpen] = useState(false);

  const ranking = useMemo(() => {
    const counts: Record<string, number> = {};
    withdrawals.forEach((w) => {
      counts[w.item_id] = (counts[w.item_id] || 0) + 1;
    });
    return items
      .map((item) => ({
        item_id: item.id,
        item_code: item.item_code,
        item_name: item.item_name,
        total: counts[item.id] || 0,
      }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [items, withdrawals]);

  const handleExportRanking = () => {
    if (ranking.length === 0) { toast.error("Nenhuma retirada registrada"); return; }
    const rows = ranking.map((r, idx) => ({
      "Posição": idx + 1,
      "Cód Item": r.item_code,
      "Nome": r.item_name,
      "Qtd Registros": r.total,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ranking Retiradas");
    XLSX.writeFile(wb, `ranking_retiradas_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.xlsx`);
    toast.success("Ranking exportado!");
  };

  useEffect(() => {
    localStorage.setItem("monthly_replenishment_list", JSON.stringify(monthlyList));
  }, [monthlyList]);

  // Calculate replenishment totals per item
  const replenishmentTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    replenishments.forEach((r) => {
      totals[r.item_id] = (totals[r.item_id] || 0) + r.quantity;
    });
    return totals;
  }, [replenishments]);

  // Auto-sync monthly list: add items with balance < ideal_stock, remove items with balance >= ideal_stock
  useEffect(() => {
    if (items.length === 0) return;

    const lowStockIds = new Set<string>();
    const lowStockItems = items.filter((item) => {
      const balance = item.quantity - (withdrawalTotals[item.id] || 0);
      const ideal = item.ideal_stock || 0;
      if (ideal > 0 && balance < ideal) {
        lowStockIds.add(item.id);
        return true;
      }
      return false;
    });

    setMonthlyList((prev) => {
      // Remove items that no longer have low stock
      const filtered = prev.filter((m) => lowStockIds.has(m.item_id));

      // Add new low stock items
      const existingIds = new Set(filtered.map((m) => m.item_id));
      const newItems = lowStockItems
        .filter((item) => !existingIds.has(item.id))
        .map((item) => {
          const balance = item.quantity - (withdrawalTotals[item.id] || 0);
          const ideal = item.ideal_stock || 0;
          return {
            item_id: item.id,
            item_code: item.item_code,
            item_name: item.item_name,
            quantity: Math.max(1, ideal - balance),
          };
        });

      const result = [...filtered, ...newItems];
      // Only update if changed
      if (result.length === prev.length && result.every((r, i) => r.item_id === prev[i].item_id)) return prev;
      return result;
    });
  }, [items, replenishmentTotals, withdrawalTotals]);

  const [mlCode, setMlCode] = useState("");
  const [mlName, setMlName] = useState("");
  const [mlItemId, setMlItemId] = useState("");
  const [mlQty, setMlQty] = useState("");
  const [mlEditIdx, setMlEditIdx] = useState<number | null>(null);
  const [mlEditQty, setMlEditQty] = useState("");

  const handleCodeChange = (val: string) => {
    const formatted = formatCode(val);
    setCodeInput(formatted);
    const found = items.find((i) => i.item_code.toLowerCase() === formatted.toLowerCase());
    if (found) { setNameInput(found.item_name); setSelectedItemId(found.id); }
    else setSelectedItemId("");
  };

  const handleNameChange = (val: string) => {
    setNameInput(val);
    const found = items.find((i) => i.item_name.toLowerCase() === val.toLowerCase());
    if (found) { setCodeInput(found.item_code); setSelectedItemId(found.id); }
    else setSelectedItemId("");
  };

  const handleAdd = async () => {
    if (!selectedItemId || !qty.trim()) {
      toast.error("Preencha código/nome do item e quantidade");
      return;
    }
    try {
      await addReplenishment.mutateAsync({ item_id: selectedItemId, quantity: parseInt(qty), user_name: fullName || user?.email || null });
      setCodeInput(""); setNameInput(""); setSelectedItemId(""); setQty("");
      toast.success("Reposição registrada!");
    } catch {
      toast.error("Erro ao registrar reposição");
    }
  };

  // Monthly list handlers
  const handleMlCodeChange = (val: string) => {
    const formatted = formatCode(val);
    setMlCode(formatted);
    const found = items.find((i) => i.item_code.toLowerCase() === formatted.toLowerCase());
    if (found) { setMlName(found.item_name); setMlItemId(found.id); }
    else setMlItemId("");
  };

  const handleMlNameChange = (val: string) => {
    setMlName(val);
    const found = items.find((i) => i.item_name.toLowerCase() === val.toLowerCase());
    if (found) { setMlCode(found.item_code); setMlItemId(found.id); }
    else setMlItemId("");
  };

  const handleMlAdd = () => {
    if (!mlItemId || !mlQty.trim()) { toast.error("Preencha código/nome e quantidade"); return; }
    if (monthlyList.some((m) => m.item_id === mlItemId)) { toast.error("Item já adicionado à lista"); return; }
    const item = items.find((i) => i.id === mlItemId);
    if (!item) return;
    setMonthlyList([...monthlyList, { item_id: mlItemId, item_code: item.item_code, item_name: item.item_name, quantity: parseInt(mlQty) }]);
    setMlCode(""); setMlName(""); setMlItemId(""); setMlQty("");
  };

  const handleMlRemove = (item_id: string) => setMonthlyList(monthlyList.filter((m) => m.item_id !== item_id));

  const handleMlStartEdit = (idx: number) => {
    setMlEditIdx(idx);
    setMlEditQty(String(monthlyList[idx].quantity));
  };

  const handleMlSaveEdit = () => {
    if (mlEditIdx === null) return;
    const updated = [...monthlyList];
    updated[mlEditIdx] = { ...updated[mlEditIdx], quantity: parseInt(mlEditQty) || updated[mlEditIdx].quantity };
    setMonthlyList(updated);
    setMlEditIdx(null);
  };

  const handleMlExport = () => {
    if (monthlyList.length === 0) { toast.error("A lista está vazia"); return; }
    const rows = monthlyList.map((m) => ({ "Cód Item": m.item_code, "Nome": m.item_name, "Quantidade": m.quantity }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lista Mensal");
    XLSX.writeFile(wb, `lista_reposicao_mensal_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.xlsx`);
    toast.success("Lista exportada!");
    setMonthlyList([]);
    setMonthlyOpen(false);
  };

  // Report handler
  const handleGenerateReport = () => {
    if (!reportDateFrom || !reportDateTo) {
      toast.error("Selecione o período (data inicial e final)");
      return;
    }

    const filtered = replenishments.filter((r) => {
      const date = new Date(r.created_at);
      return isWithinInterval(date, { start: startOfDay(reportDateFrom), end: endOfDay(reportDateTo) });
    });

    if (filtered.length === 0) {
      toast.error("Nenhum registro encontrado no período selecionado");
      return;
    }

    const rows = filtered.map((r) => ({
      "Cód Item": r.stock_items?.item_code || "",
      "Nome": r.stock_items?.item_name || "",
      "Quantidade Reposta": r.quantity,
      "Usuário": r.user_name || "—",
      "Data": new Date(r.created_at).toLocaleDateString("pt-BR"),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relação Reposições");
    const fromStr = format(reportDateFrom, "dd-MM-yyyy");
    const toStr = format(reportDateTo, "dd-MM-yyyy");
    XLSX.writeFile(wb, `relacao_reposicoes_${fromStr}_a_${toStr}.xlsx`);
    toast.success("Relatório exportado!");
    setReportOpen(false);
  };

  // Replenishment edit/delete
  const handleEditRep = (r: any) => {
    setEditRepId(r.id);
    setEditRepQty(String(r.quantity));
    setEditRepItemId(r.item_id);
    setEditRepOldQty(r.quantity);
  };

  const handleSaveRep = async () => {
    if (!editRepId) return;
    try {
      await updateReplenishment.mutateAsync({ id: editRepId, quantity: parseInt(editRepQty), item_id: editRepItemId, oldQuantity: editRepOldQty });
      setEditRepId(null);
      toast.success("Reposição atualizada!");
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  const handleDeleteRep = async (r: any) => {
    try {
      await deleteReplenishment.mutateAsync({ id: r.id, item_id: r.item_id, quantity: r.quantity });
      toast.success("Reposição removida!");
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const codeSuggestions = codeInput.length > 0 && !selectedItemId
    ? items.filter((i) => i.item_code.toLowerCase().includes(codeInput.toLowerCase())).slice(0, 5)
    : [];
  const nameSuggestions = nameInput.length > 0 && !selectedItemId
    ? items.filter((i) => i.item_name.toLowerCase().includes(nameInput.toLowerCase())).slice(0, 5)
    : [];

  const mlCodeSuggestions = mlCode.length > 0 && !mlItemId
    ? items.filter((i) => i.item_code.toLowerCase().includes(mlCode.toLowerCase())).slice(0, 5)
    : [];
  const mlNameSuggestions = mlName.length > 0 && !mlItemId
    ? items.filter((i) => i.item_name.toLowerCase().includes(mlName.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Dialog open={monthlyOpen} onOpenChange={setMonthlyOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-sky-500 hover:bg-sky-600 text-white">
              <ShoppingCart className="h-4 w-4" /> Lista de Reposição Mensal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Lista de Reposição Mensal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex gap-2 flex-wrap items-start">
                <div className="relative">
                  <Input placeholder="00.0000" value={mlCode} onChange={(e) => handleMlCodeChange(e.target.value)} className="w-36" maxLength={7} />
                  {mlCodeSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 w-full bg-card border rounded-md shadow-lg mt-1">
                      {mlCodeSuggestions.map((i) => (
                        <button key={i.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setMlCode(i.item_code); setMlName(i.item_name); setMlItemId(i.id); }}>
                          {i.item_code} — {i.item_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <Input placeholder="Nome do item" value={mlName} onChange={(e) => handleMlNameChange(e.target.value)} className="w-48" readOnly={!!mlItemId} />
                  {mlNameSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 w-full bg-card border rounded-md shadow-lg mt-1">
                      {mlNameSuggestions.map((i) => (
                        <button key={i.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setMlCode(i.item_code); setMlName(i.item_name); setMlItemId(i.id); }}>
                          {i.item_code} — {i.item_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Input placeholder="Qtd" type="number" value={mlQty} onChange={(e) => setMlQty(e.target.value)} className="w-24" />
                <Button onClick={handleMlAdd} size="sm" className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
              </div>

              {monthlyList.length > 0 && (
                <div className="rounded-lg border bg-card overflow-auto flex-1 max-h-[40vh]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-primary/5">
                        <TableHead>Código</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyList.map((m, idx) => (
                        <TableRow key={m.item_id}>
                          <TableCell className="font-mono font-medium">{m.item_code}</TableCell>
                          <TableCell>{m.item_name}</TableCell>
                          <TableCell className="text-right font-medium">
                            {mlEditIdx === idx ? (
                              <Input type="number" value={mlEditQty} onChange={(e) => setMlEditQty(e.target.value)} className="w-20 inline-block" onBlur={handleMlSaveEdit} onKeyDown={(e) => e.key === "Enter" && handleMlSaveEdit()} autoFocus />
                            ) : m.quantity}
                          </TableCell>
                          <TableCell className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleMlStartEdit(idx)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleMlRemove(m.item_id)} className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleMlExport} disabled={monthlyList.length === 0} className="gap-2 bg-sky-500 hover:bg-sky-600 text-white">
                  <FileSpreadsheet className="h-4 w-4" /> Concluir
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Report button */}
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" variant="outline">
              <FileText className="h-4 w-4" /> Relação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Relação de Reposições</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Inicial</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {reportDateFrom ? format(reportDateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={reportDateFrom} onSelect={setReportDateFrom} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Final</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {reportDateTo ? format(reportDateTo, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={reportDateTo} onSelect={setReportDateTo} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleGenerateReport} className="w-full gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Gerar Relação
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Ranking button */}
        <Dialog open={rankingOpen} onOpenChange={setRankingOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
              <Trophy className="h-4 w-4" /> Ranking
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Ranking de Retiradas</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              {ranking.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhuma retirada registrada</div>
              ) : (
                <div className="rounded-lg border bg-card overflow-auto flex-1 max-h-[55vh]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-primary/5">
                        <TableHead className="w-20 font-semibold">Posição</TableHead>
                        <TableHead className="font-semibold">Código</TableHead>
                        <TableHead className="font-semibold">Item</TableHead>
                        <TableHead className="font-semibold text-right">Total Retirado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ranking.map((r, idx) => {
                        const isTop = idx === 0;
                        return (
                          <TableRow key={r.item_id} className={isTop ? "bg-destructive/10" : ""}>
                            <TableCell className={`font-bold ${isTop ? "text-destructive" : ""}`}>{idx + 1}º</TableCell>
                            <TableCell className={`font-mono font-medium ${isTop ? "text-destructive" : ""}`}>{r.item_code}</TableCell>
                            <TableCell className={isTop ? "text-destructive font-medium" : ""}>{r.item_name}</TableCell>
                            <TableCell className={`text-right font-bold ${isTop ? "text-destructive" : ""}`}>{r.total}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleExportRanking} disabled={ranking.length === 0} className="gap-2 bg-sky-500 hover:bg-sky-600 text-white">
                  <Download className="h-4 w-4" /> Exportar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {isAdmin ? (
          <BulkDeleteByPeriod
            records={replenishments}
            onDeleteRecords={async (records) => {
              await bulkDeleteReplenishments.mutateAsync(records.map((r: any) => ({ id: r.id, item_id: r.item_id, quantity: r.quantity })));
            }}
          />
        ) : (
          <Button variant="destructive" className="gap-2" onClick={() => toast.error("Você não tem permissão para esta ação")}>
            <Trash2 className="h-4 w-4" /> Excluir Registros Mensal
          </Button>
        )}
      </div>

      {/* Add form */}
      <div className="flex gap-3 flex-wrap items-start">
        <div className="relative">
          <Input placeholder="00.0000" value={codeInput} onChange={(e) => handleCodeChange(e.target.value)} className="w-40" maxLength={7} />
          {codeSuggestions.length > 0 && (
            <div className="absolute z-10 top-full left-0 w-full bg-card border rounded-md shadow-lg mt-1">
              {codeSuggestions.map((i) => (
                <button key={i.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setCodeInput(i.item_code); setNameInput(i.item_name); setSelectedItemId(i.id); }}>
                  {i.item_code} — {i.item_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <Input placeholder="Nome do item" value={nameInput} onChange={(e) => handleNameChange(e.target.value)} className="w-52" readOnly={!!selectedItemId} />
          {nameSuggestions.length > 0 && (
            <div className="absolute z-10 top-full left-0 w-full bg-card border rounded-md shadow-lg mt-1">
              {nameSuggestions.map((i) => (
                <button key={i.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setCodeInput(i.item_code); setNameInput(i.item_name); setSelectedItemId(i.id); }}>
                  {i.item_code} — {i.item_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <Input placeholder="Quantidade" type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="w-32" />
        <Button onClick={handleAdd} disabled={addReplenishment.isPending} className="gap-2">
          <Plus className="h-4 w-4" /> Registrar Reposição
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/5">
               <TableHead className="font-semibold">Código</TableHead>
               <TableHead className="font-semibold">Item</TableHead>
               <TableHead className="font-semibold text-right">Qtd Reposta</TableHead>
               <TableHead className="font-semibold">Usuário</TableHead>
               <TableHead className="font-semibold">Data</TableHead>
               <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : replenishments.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                <PackagePlus className="mx-auto h-8 w-8 mb-2 opacity-40" />
                Nenhuma reposição registrada
              </TableCell></TableRow>
            ) : (
              replenishments.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-medium">{r.stock_items?.item_code}</TableCell>
                  <TableCell>{r.stock_items?.item_name}</TableCell>
                  <TableCell className="text-right font-medium">
                    {editRepId === r.id ? (
                      <Input type="number" value={editRepQty} onChange={(e) => setEditRepQty(e.target.value)} className="w-20 inline-block" autoFocus />
                    ) : r.quantity}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.user_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="flex gap-1">
                    {editRepId === r.id ? (
                      <Button size="sm" onClick={handleSaveRep}>Salvar</Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => handleEditRep(r)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteRep(r)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
