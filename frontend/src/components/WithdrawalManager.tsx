import { useState, useRef } from "react";
import { useStockItems, useWithdrawals, useAddWithdrawal, useUpdateWithdrawal, useDeleteWithdrawal, useBulkDeleteWithdrawals, useObras, useAddObra, useUpdateObra, useDeleteObra, useEmployees, useApplications, useAddApplication, useDeleteApplication } from "@/hooks/useStockItems";
import BulkDeleteByPeriod from "@/components/BulkDeleteByPeriod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Search, Plus, ClipboardList, Trash2, Building2, Wrench, Pencil, FileText, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

function formatCode(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length > 2) return digits.slice(0, 2) + "." + digits.slice(2);
  return digits;
}

export default function WithdrawalManager() {
  const { user, fullName } = useAuth();
  const { isAdmin } = useUserRole();
  const { data: items = [] } = useStockItems();
  const { data: withdrawals = [], isLoading } = useWithdrawals();
  const { data: obras = [] } = useObras();
  const { data: employees = [] } = useEmployees();
  const { data: applications = [] } = useApplications();
  const addWithdrawal = useAddWithdrawal();
  const updateWithdrawal = useUpdateWithdrawal();
  const deleteWithdrawal = useDeleteWithdrawal();
  const bulkDeleteWithdrawals = useBulkDeleteWithdrawals();
  const addObra = useAddObra();
  const updateObra = useUpdateObra();
  const deleteObra = useDeleteObra();
  const addApplication = useAddApplication();
  const deleteApplication = useDeleteApplication();

  const [search, setSearch] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [qty, setQty] = useState("");
  const [application, setApplication] = useState("");
  const [responsibleInput, setResponsibleInput] = useState("");
  const [selectedObraId, setSelectedObraId] = useState("");

  const [showEmpDropdown, setShowEmpDropdown] = useState(false);
  const [showAppDropdown, setShowAppDropdown] = useState(false);
  const empRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);

  const [obraDialogOpen, setObraDialogOpen] = useState(false);
  const [newObraName, setNewObraName] = useState("");
  const [newObraResponsible, setNewObraResponsible] = useState("");
  const [newWithdrawalIdDialog, setNewWithdrawalIdDialog] = useState<string | null>(null);

  const [appDialogOpen, setAppDialogOpen] = useState(false);
  const [newAppName, setNewAppName] = useState("");

  const [editingObraId, setEditingObraId] = useState<string | null>(null);
  const [editObraName, setEditObraName] = useState("");
  const [editObraResponsible, setEditObraResponsible] = useState("");

  const [editingWithdrawalId, setEditingWithdrawalId] = useState<string | null>(null);
  const [editWQty, setEditWQty] = useState("");
  const [editWApp, setEditWApp] = useState("");
  const [editWResp, setEditWResp] = useState("");
  const [editWObraId, setEditWObraId] = useState<string | null>(null);

  // Report state
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState<Date | undefined>(undefined);
  const [reportDateTo, setReportDateTo] = useState<Date | undefined>(undefined);
  const [reportObraId, setReportObraId] = useState("");
  const [reportApp, setReportApp] = useState("");

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
    if (!selectedItemId || !qty.trim() || !application.trim() || !responsibleInput.trim()) {
      toast.error("Preencha todos os campos e selecione um item válido");
      return;
    }
    try {
      const result = await addWithdrawal.mutateAsync({
        item_id: selectedItemId,
        quantity_withdrawn: parseInt(qty),
        application: application.trim(),
        responsible: responsibleInput.trim(),
        obra_id: selectedObraId || undefined,
        user_email: fullName || user?.email || null,
      });
      setCodeInput(""); setNameInput(""); setSelectedItemId(""); setQty(""); setApplication(""); setResponsibleInput(""); setSelectedObraId("");
      setNewWithdrawalIdDialog(result.withdrawal_id);
      toast.success("Retirada registrada!");
    } catch {
      toast.error("Erro ao registrar retirada");
    }
  };

  const handleAddObra = async () => {
    if (!newObraName.trim() || !newObraResponsible.trim()) {
      toast.error("Preencha nome do serviço e responsável");
      return;
    }
    try {
      await addObra.mutateAsync({ obra_name: newObraName.trim(), responsible: newObraResponsible.trim() });
      setNewObraName(""); setNewObraResponsible("");
      setObraDialogOpen(false);
      toast.success("Serviço cadastrado!");
    } catch {
      toast.error("Erro ao cadastrar serviço");
    }
  };

  const handleAddApplication = async () => {
    if (!newAppName.trim()) {
      toast.error("Preencha o nome da aplicação");
      return;
    }
    try {
      await addApplication.mutateAsync({ name: newAppName.trim() });
      setNewAppName("");
      toast.success("Aplicação cadastrada!");
    } catch {
      toast.error("Erro ao cadastrar aplicação");
    }
  };

  const handleGenerateReport = () => {
    let reportData = [...withdrawals];

    if (reportDateFrom) {
      reportData = reportData.filter((w) => new Date(w.created_at) >= reportDateFrom);
    }
    if (reportDateTo) {
      const endOfDay = new Date(reportDateTo);
      endOfDay.setHours(23, 59, 59, 999);
      reportData = reportData.filter((w) => new Date(w.created_at) <= endOfDay);
    }
    if (reportObraId && reportObraId !== "all") {
      reportData = reportData.filter((w) => w.obra_id === reportObraId);
    }
    if (reportApp && reportApp !== "all") {
      reportData = reportData.filter((w) => w.application === reportApp);
    }

    if (reportData.length === 0) {
      toast.error("Nenhum registro encontrado para os filtros selecionados");
      return;
    }

    const rows = reportData.map((w) => ({
      "ID Retirada": w.withdrawal_id,
      "Código": w.stock_items?.item_code || "",
      "Item": w.stock_items?.item_name || "",
      "Qtd Retirada": w.quantity_withdrawn,
      "Aplicação": w.application,
      "Serviço": w.obras?.obra_name || "—",
      "Responsável": w.responsible,
      "Usuário": w.user_email || "—",
      "Data": new Date(w.created_at).toLocaleDateString("pt-BR"),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    const fileName = `relatorio_retiradas_${format(new Date(), "dd-MM-yyyy")}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success(`Relatório exportado com ${reportData.length} registros!`);
    setReportDialogOpen(false);
  };

  const filtered = withdrawals.filter((w) => {
    const s = search.toLowerCase();
    return (
      w.withdrawal_id.toLowerCase().includes(s) ||
      w.stock_items?.item_name?.toLowerCase().includes(s) ||
      w.stock_items?.item_code?.toLowerCase().includes(s) ||
      w.responsible.toLowerCase().includes(s)
    );
  });

  const codeSuggestions = codeInput.length > 0 && !selectedItemId
    ? items.filter((i) => i.item_code.toLowerCase().includes(codeInput.toLowerCase())).slice(0, 5)
    : [];
  const nameSuggestions = nameInput.length > 0 && !selectedItemId
    ? items.filter((i) => i.item_name.toLowerCase().includes(nameInput.toLowerCase())).slice(0, 5)
    : [];

  const empSuggestions = showEmpDropdown
    ? (responsibleInput.length > 0
        ? employees.filter((e) => e.name.toLowerCase().includes(responsibleInput.toLowerCase()))
        : employees
      ).slice(0, 8)
    : [];

  const appSuggestions = showAppDropdown
    ? (application.length > 0
        ? applications.filter((a) => a.name.toLowerCase().includes(application.toLowerCase()))
        : applications
      ).slice(0, 8)
    : [];

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por ID da retirada, item ou responsável..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => { setReportDateFrom(undefined); setReportDateTo(undefined); setReportObraId(""); setReportApp(""); setReportDialogOpen(true); }} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
          <FileText className="h-4 w-4" /> Relatório
        </Button>
        <Button onClick={() => setAppDialogOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Wrench className="h-4 w-4" /> Aplicação
        </Button>
        <Button onClick={() => setObraDialogOpen(true)} className="gap-2 bg-sky-600 hover:bg-sky-700 text-white">
          <Building2 className="h-4 w-4" /> Incluir Serviço
        </Button>
        {isAdmin ? (
          <BulkDeleteByPeriod
            records={withdrawals}
            onDeleteRecords={async (records) => {
              await bulkDeleteWithdrawals.mutateAsync(records.map((r: any) => r.id));
            }}
          />
        ) : (
          <Button variant="destructive" className="gap-2" onClick={() => toast.error("Você não tem permissão para esta ação")}>
            <Trash2 className="h-4 w-4" /> Excluir Registros Mensal
          </Button>
        )}
      </div>

      {/* Add withdrawal form */}
      <div className="flex gap-3 flex-wrap items-start">
        <div className="relative">
          <Input placeholder="Código do item" value={codeInput} onChange={(e) => handleCodeChange(e.target.value)} className="w-40" maxLength={7} />
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
          <Input placeholder="Nome do item" value={nameInput} onChange={(e) => handleNameChange(e.target.value)} className="w-52" />
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
        <Input placeholder="Qtd" type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="w-20" />
        
        {/* Aplicação field with dropdown */}
        <div className="relative min-w-[120px] flex-1" ref={appRef}>
          <Input
            placeholder="Aplicação"
            value={application}
            onChange={(e) => setApplication(e.target.value)}
            onFocus={() => setShowAppDropdown(true)}
            onBlur={() => setTimeout(() => setShowAppDropdown(false), 200)}
          />
          {appSuggestions.length > 0 && (
            <div className="absolute z-10 top-full left-0 w-full bg-card border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
              {appSuggestions.map((a) => (
                <button key={a.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setApplication(a.name); setShowAppDropdown(false); }}>
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Responsável field with dropdown */}
        <div className="relative" ref={empRef}>
          <Input
            placeholder="Responsável"
            value={responsibleInput}
            onChange={(e) => setResponsibleInput(e.target.value)}
            onFocus={() => setShowEmpDropdown(true)}
            onBlur={() => setTimeout(() => setShowEmpDropdown(false), 200)}
            className="w-44"
          />
          {empSuggestions.length > 0 && (
            <div className="absolute z-10 top-full left-0 w-full bg-card border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
              {empSuggestions.map((e) => (
                <button key={e.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setResponsibleInput(e.name); setShowEmpDropdown(false); }}>
                  {e.employee_id} — {e.name} ({e.role})
                </button>
              ))}
            </div>
          )}
        </div>

        <Select value={selectedObraId} onValueChange={setSelectedObraId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Selecionar serviço" />
          </SelectTrigger>
          <SelectContent>
            {obras.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.obra_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleAdd} disabled={addWithdrawal.isPending} className="gap-2">
          <Plus className="h-4 w-4" /> Registrar
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/5">
              <TableHead className="font-semibold">ID Retirada</TableHead>
              <TableHead className="font-semibold">Código</TableHead>
              <TableHead className="font-semibold">Item</TableHead>
              <TableHead className="font-semibold text-right">Qtd Retirada</TableHead>
              <TableHead className="font-semibold">Aplicação</TableHead>
              <TableHead className="font-semibold">Serviço</TableHead>
              <TableHead className="font-semibold">Responsável</TableHead>
              <TableHead className="font-semibold">Usuário</TableHead>
              <TableHead className="font-semibold">Data</TableHead>
              <TableHead className="font-semibold">Horário</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                <ClipboardList className="mx-auto h-8 w-8 mb-2 opacity-40" />
                Nenhuma retirada encontrada
              </TableCell></TableRow>
            ) : (
              filtered.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono font-medium text-primary">{w.withdrawal_id}</TableCell>
                  <TableCell className="font-mono">{w.stock_items?.item_code}</TableCell>
                  <TableCell>{w.stock_items?.item_name}</TableCell>
                  {editingWithdrawalId === w.id ? (
                    <>
                      <TableCell><Input type="number" value={editWQty} onChange={(e) => setEditWQty(e.target.value)} className="w-20 h-8 text-sm" /></TableCell>
                      <TableCell>
                        <Select value={editWApp} onValueChange={setEditWApp}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {applications.map((a) => (<SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={editWObraId || "none"} onValueChange={(v) => setEditWObraId(v === "none" ? null : v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {obras.map((o) => (<SelectItem key={o.id} value={o.id}>{o.obra_name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={editWResp} onValueChange={setEditWResp}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {employees.map((e) => (<SelectItem key={e.id} value={e.name}>{e.employee_id} — {e.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{w.user_email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(w.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(w.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={async () => {
                            try {
                              await updateWithdrawal.mutateAsync({
                                id: w.id,
                                quantity_withdrawn: parseInt(editWQty),
                                application: editWApp,
                                responsible: editWResp,
                                obra_id: editWObraId,
                              });
                              setEditingWithdrawalId(null);
                              toast.success("Retirada atualizada!");
                            } catch { toast.error("Erro ao atualizar"); }
                          }}>✓</Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingWithdrawalId(null)}>✕</Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-right font-medium">{w.quantity_withdrawn}</TableCell>
                      <TableCell>{w.application}</TableCell>
                      <TableCell>{w.obras?.obra_name || "—"}</TableCell>
                      <TableCell>{w.responsible}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{w.user_email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(w.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(w.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => {
                            setEditingWithdrawalId(w.id);
                            setEditWQty(String(w.quantity_withdrawn));
                            setEditWApp(w.application);
                            setEditWResp(w.responsible);
                            setEditWObraId(w.obra_id);
                          }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" onClick={() => deleteWithdrawal.mutate(w.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Incluir Serviço Dialog */}
      <Dialog open={obraDialogOpen} onOpenChange={setObraDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Serviços</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input placeholder="Nome do serviço" value={newObraName} onChange={(e) => setNewObraName(e.target.value)} className="flex-1" />
              <Input placeholder="Responsável" value={newObraResponsible} onChange={(e) => setNewObraResponsible(e.target.value)} className="flex-1" />
              <Button onClick={handleAddObra} disabled={addObra.isPending} className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
            {obras.length > 0 && (
              <div className="border rounded-md max-h-56 overflow-y-auto">
                {obras.map((o) => (
                  <div key={o.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted text-sm gap-2">
                    {editingObraId === o.id ? (
                      <>
                        <Input value={editObraName} onChange={(e) => setEditObraName(e.target.value)} className="h-7 text-sm flex-1" />
                        <Input value={editObraResponsible} onChange={(e) => setEditObraResponsible(e.target.value)} className="h-7 text-sm flex-1" />
                        <Button size="sm" className="h-7" onClick={async () => {
                          try {
                            await updateObra.mutateAsync({ id: o.id, obra_name: editObraName, responsible: editObraResponsible });
                            setEditingObraId(null);
                            toast.success("Serviço atualizado!");
                          } catch { toast.error("Erro ao atualizar serviço"); }
                        }}>Salvar</Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingObraId(null)}>✕</Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1">{o.obra_name}</span>
                        <span className="flex-1 text-muted-foreground">{o.responsible}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => { setEditingObraId(o.id); setEditObraName(o.obra_name); setEditObraResponsible(o.responsible); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteObra.mutate(o.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObraDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aplicação Dialog */}
      <Dialog open={appDialogOpen} onOpenChange={setAppDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Aplicação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input placeholder="Nome da aplicação" value={newAppName} onChange={(e) => setNewAppName(e.target.value)} className="flex-1" />
              <Button onClick={handleAddApplication} disabled={addApplication.isPending} className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
            {applications.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {applications.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted text-sm">
                    <span>{a.name}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteApplication.mutate(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Withdrawal ID Dialog */}
      <Dialog open={!!newWithdrawalIdDialog} onOpenChange={() => setNewWithdrawalIdDialog(null)}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle>Retirada Registrada</DialogTitle>
          </DialogHeader>
          <p className="text-3xl font-bold text-primary py-4">{newWithdrawalIdDialog}</p>
          <DialogFooter className="justify-center">
            <Button onClick={() => setNewWithdrawalIdDialog(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar Relatório de Retiradas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <div className="flex gap-2 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !reportDateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {reportDateFrom ? format(reportDateFrom, "dd/MM/yyyy") : "Data inicial"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={reportDateFrom} onSelect={setReportDateFrom} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">até</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !reportDateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {reportDateTo ? format(reportDateTo, "dd/MM/yyyy") : "Data final"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={reportDateTo} onSelect={setReportDateTo} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Serviço (opcional)</label>
              <Select value={reportObraId} onValueChange={setReportObraId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os serviços" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os serviços</SelectItem>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.obra_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Aplicação (opcional)</label>
              <Select value={reportApp} onValueChange={setReportApp}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as aplicações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as aplicações</SelectItem>
                  {applications.map((a) => (
                    <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerateReport} className="gap-2">
              <FileText className="h-4 w-4" /> Gerar Relatório
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
