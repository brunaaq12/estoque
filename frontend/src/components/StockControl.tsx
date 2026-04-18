import { useState } from "react";
import { useStockItems, useWithdrawalTotals, useAddStockItem, useUpdateStockItem, useDeleteStockItem, useEmployees, useAddEmployee, useUpdateEmployee, useDeleteEmployee, useCategories, useAddCategory, useDeleteCategory } from "@/hooks/useStockItems";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Plus, Trash2, Package, Users, Pencil, Filter, FileDown, ClipboardCheck, Tag } from "lucide-react";
import * as XLSX from "xlsx";
import InventoryDialog from "./InventoryDialog";
import { useQueryClient } from "@tanstack/react-query";

const UNIT_OPTIONS = ["PÇ", "LITROS", "METROS", "UNIDADE", "KILOGRAMA", "CAIXA", "PCTE", "FRDO"];
const SHELF_OPTIONS = Array.from({ length: 15 }, (_, i) => String(i + 1));

function formatCode(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length > 2) return digits.slice(0, 2) + "." + digits.slice(2);
  return digits;
}

export default function StockControl() {
  const queryClient = useQueryClient();
  const { user, fullName } = useAuth();
  const { data: items = [], isLoading } = useStockItems();
  const { data: totals = {} } = useWithdrawalTotals();
  const { data: employees = [] } = useEmployees();
  const { data: categories = [] } = useCategories();
  const addItem = useAddStockItem();
  const updateItem = useUpdateStockItem();
  const deleteItem = useDeleteStockItem();
  const addEmployee = useAddEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const addCategory = useAddCategory();
  const deleteCategory = useDeleteCategory();

  const [search, setSearch] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [idealStock, setIdealStock] = useState("");
  const [unit, setUnit] = useState("PÇ");
  const [shelf, setShelf] = useState("");
  const [category, setCategory] = useState("");
  const [qtyFilter, setQtyFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState<"all" | "red" | "orange" | "green">("all");

  // Employee dialog
  const [empDialogOpen, setEmpDialogOpen] = useState(false);
  const [empName, setEmpName] = useState("");
  const [empRole, setEmpRole] = useState("");
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);

  // Inventory dialog
  const [inventoryOpen, setInventoryOpen] = useState(false);

  // Category dialog
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catName, setCatName] = useState("");
  // Edit item dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editIdealStock, setEditIdealStock] = useState("");
  const [editUnit, setEditUnit] = useState("PÇ");
  const [editShelf, setEditShelf] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const filtered = items.filter((i) => {
    const s = search.toLowerCase();
    const matchSearch = i.item_code.toLowerCase().includes(s) || i.item_name.toLowerCase().includes(s);
    const withdrawn = totals[i.id] || 0;
    const balance = i.quantity - withdrawn;

    let matchColor = true;
    const ideal = i.ideal_stock || 5;
    if (colorFilter === "red") matchColor = balance <= 0;
    else if (colorFilter === "orange") matchColor = balance > 0 && balance < ideal;
    else if (colorFilter === "green") matchColor = balance >= ideal;

    let matchQty = true;
    if (qtyFilter.trim()) matchQty = i.quantity === parseInt(qtyFilter);

    let matchCategory = true;
    if (categoryFilter !== "all") matchCategory = i.category_id === categoryFilter;

    return matchSearch && matchColor && matchQty && matchCategory;
  });

  const handleCodeInput = (val: string) => {
    setCode(formatCode(val));
  };

  const handleAdd = async () => {
    const rawCode = code.replace(/\D/g, "");
    if (rawCode.length !== 6 || !name.trim() || !qty.trim() || !shelf) {
      toast.error("Código deve ter 6 dígitos. Preencha todos os campos e selecione a prateleira.");
      return;
    }
    try {
      await addItem.mutateAsync({ item_code: code, item_name: name.trim(), quantity: parseInt(qty), unit_measure: unit, shelf: shelf || null, ideal_stock: parseInt(idealStock) || 0, category_id: category || null, user_name: fullName || user?.email || null });
      setCode(""); setName(""); setQty(""); setIdealStock(""); setUnit("PÇ"); setShelf(""); setCategory("");
      toast.success("Item adicionado!");
    } catch (e: any) {
      toast.error(e.message?.includes("duplicate") ? "Código já existe" : "Erro ao adicionar");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteItem.mutateAsync(id);
      toast.success("Item removido!");
    } catch {
      toast.error("Erro ao remover (pode ter retiradas vinculadas)");
    }
  };

  const openEdit = (item: any) => {
    setEditId(item.id);
    setEditCode(item.item_code);
    setEditName(item.item_name);
    setEditQty(String(item.quantity));
    setEditIdealStock(String(item.ideal_stock || 0));
    setEditUnit(item.unit_measure || "PÇ");
    setEditShelf(item.shelf || "");
    setEditCategory(item.category_id || "");
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    const rawCode = editCode.replace(/\D/g, "");
    if (rawCode.length !== 6 || !editName.trim()) {
      toast.error("Código deve ter 6 dígitos e nome é obrigatório");
      return;
    }
    try {
      await updateItem.mutateAsync({ id: editId, item_code: editCode, item_name: editName.trim(), quantity: parseInt(editQty), ideal_stock: parseInt(editIdealStock) || 0, unit_measure: editUnit, shelf: editShelf || null, category_id: editCategory || null });
      setEditDialogOpen(false);
      toast.success("Item atualizado!");
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  const handleAddEmployee = async () => {
    if (!empName.trim() || !empRole.trim()) {
      toast.error("Preencha nome e função");
      return;
    }
    try {
      if (editingEmpId) {
        await updateEmployee.mutateAsync({ id: editingEmpId, name: empName.trim(), role: empRole.trim() });
        setEditingEmpId(null);
        toast.success("Funcionário atualizado!");
      } else {
        await addEmployee.mutateAsync({ name: empName.trim(), role: empRole.trim() });
        toast.success("Funcionário cadastrado!");
      }
      setEmpName(""); setEmpRole("");
    } catch {
      toast.error("Erro ao salvar funcionário");
    }
  };

  const handleEditEmployee = (emp: { id: string; name: string; role: string }) => {
    setEditingEmpId(emp.id);
    setEmpName(emp.name);
    setEmpRole(emp.role);
  };

  const handleDeleteEmployee = async (id: string) => {
    try {
      await deleteEmployee.mutateAsync(id);
      toast.success("Funcionário removido!");
    } catch {
      toast.error("Erro ao remover funcionário");
    }
  };

  const handleExportStock = () => {
    const data = items.map((item) => {
      const withdrawn = totals[item.id] || 0;
      const balance = item.quantity - withdrawn;
      return {
        "Código": item.item_code,
        "Nome do Item": item.item_name,
        "Categoria": item.categories?.name || "—",
        "Unidade": item.unit_measure || "PÇ",
        "Prateleira": item.shelf || "—",
        "Quantidade": item.quantity,
        "Retirado": withdrawn,
        "Saldo": balance,
        "Usuário": item.user_name || "—",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque");
    XLSX.writeFile(wb, "relacao_estoque.xlsx");
    toast.success("Relação exportada com sucesso!");
  };

  const handleAddCategory = async () => {
    if (!catName.trim()) { toast.error("Preencha o nome da categoria"); return; }
    try {
      await addCategory.mutateAsync({ name: catName.trim() });
      setCatName("");
      toast.success("Categoria cadastrada!");
    } catch {
      toast.error("Erro ao cadastrar categoria");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory.mutateAsync(id);
      toast.success("Categoria removida!");
    } catch {
      toast.error("Erro ao remover categoria");
    }
  };

  return (
    <div className="space-y-6">
      {/* Item count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          <span><strong className="text-foreground">{items.length}</strong> itens cadastrados em estoque</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setInventoryOpen(true)} className="gap-2" variant="outline">
            <ClipboardCheck className="h-4 w-4" /> Inventário
          </Button>
          <Button onClick={handleExportStock} className="gap-2" variant="outline">
            <FileDown className="h-4 w-4" /> Exportar Relação
          </Button>
        </div>
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por código ou nome do item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Input
          placeholder="Filtrar por qtd"
          type="number"
          value={qtyFilter}
          onChange={(e) => setQtyFilter(e.target.value)}
          className="w-32"
        />
        <Button onClick={() => { setEmpDialogOpen(true); setEditingEmpId(null); setEmpName(""); setEmpRole(""); }} className="gap-2 bg-sky-500 hover:bg-sky-600 text-white">
          <Users className="h-4 w-4" /> Funcionário
        </Button>
        <Button onClick={() => setCatDialogOpen(true)} className="gap-2" variant="outline">
          <Tag className="h-4 w-4" /> Categorias
        </Button>
      </div>

      {/* Color filter buttons */}
      <div className="flex gap-2 flex-wrap items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Button size="sm" variant={colorFilter === "all" ? "default" : "outline"} onClick={() => setColorFilter("all")}>Todos</Button>
        <Button size="sm" variant={colorFilter === "red" ? "default" : "outline"} onClick={() => setColorFilter("red")} className={colorFilter === "red" ? "bg-destructive hover:bg-destructive/90 text-white" : "text-destructive border-destructive/50"}>
          Sem Saldo
        </Button>
        <Button size="sm" variant={colorFilter === "orange" ? "default" : "outline"} onClick={() => setColorFilter("orange")} className={colorFilter === "orange" ? "bg-orange-500 hover:bg-orange-600 text-white" : "text-orange-500 border-orange-500/50"}>
          Saldo Baixo
        </Button>
        <Button size="sm" variant={colorFilter === "green" ? "default" : "outline"} onClick={() => setColorFilter("green")} className={colorFilter === "green" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-emerald-600 border-emerald-600/50"}>
          Saldo OK
        </Button>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Add form */}
      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <label className="text-xs text-muted-foreground">Código (6 dígitos)</label>
          <Input placeholder="00.0000" value={code} onChange={(e) => handleCodeInput(e.target.value)} className="w-32" maxLength={7} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground">Nome do item</label>
          <Input placeholder="Nome do item" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Quantidade</label>
          <Input placeholder="Qtd" type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="w-24" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Est. Ideal</label>
          <Input placeholder="0" type="number" value={idealStock} onChange={(e) => setIdealStock(e.target.value)} className="w-24" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Unidade</label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Prateleira</label>
          <Select value={shelf} onValueChange={setShelf}>
            <SelectTrigger className="w-24"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {SHELF_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Categoria</label>
          <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAdd} disabled={addItem.isPending} className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
             <TableRow className="bg-primary/5">
               <TableHead className="font-semibold">Código</TableHead>
              <TableHead className="font-semibold">Nome do Item</TableHead>
              <TableHead className="font-semibold">Categoria</TableHead>
              <TableHead className="font-semibold">Unid.</TableHead>
              <TableHead className="font-semibold">Prat.</TableHead>
              <TableHead className="font-semibold text-right">Quantidade</TableHead>
              <TableHead className="font-semibold text-right">Retirado</TableHead>
              <TableHead className="font-semibold text-right">Saldo</TableHead>
              <TableHead className="font-semibold text-right">Est. Ideal</TableHead>
              <TableHead className="font-semibold">Usuário</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                <Package className="mx-auto h-8 w-8 mb-2 opacity-40" />
                Nenhum item encontrado
              </TableCell></TableRow>
            ) : (
              filtered.map((item) => {
                const withdrawn = totals[item.id] || 0;
                const balance = item.quantity - withdrawn;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono font-medium">{item.item_code}</TableCell>
                    <TableCell>{item.item_name}</TableCell>
                    <TableCell className="text-sm">{item.categories?.name || "—"}</TableCell>
                    <TableCell className="text-sm">{item.unit_measure || "PÇ"}</TableCell>
                    <TableCell className="text-sm">{item.shelf || "—"}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{withdrawn}</TableCell>
                    <TableCell className={`text-right font-bold ${balance <= 0 ? "text-destructive" : balance < (item.ideal_stock || 5) ? "text-orange-500" : "text-emerald-600"}`}>
                      {balance}
                    </TableCell>
                    <TableCell className="text-right">{item.ideal_stock || 0}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{item.user_name || "—"}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Item Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Item</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Código (00.0000)" value={editCode} onChange={(e) => setEditCode(formatCode(e.target.value))} maxLength={7} />
            <Input placeholder="Nome do item" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <Input placeholder="Quantidade" type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)} />
            <div>
              <label className="text-xs text-muted-foreground">Estoque Ideal</label>
              <Input placeholder="Estoque ideal" type="number" value={editIdealStock} onChange={(e) => setEditIdealStock(e.target.value)} />
            </div>
            <Select value={editUnit} onValueChange={setEditUnit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={editShelf || "none"} onValueChange={(v) => setEditShelf(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Prateleira" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {SHELF_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <div>
              <label className="text-xs text-muted-foreground">Categoria</label>
              <Select value={editCategory || "none"} onValueChange={(v) => setEditCategory(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdate}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory Dialog */}
      <InventoryDialog
        open={inventoryOpen}
        onOpenChange={setInventoryOpen}
        items={items}
        totals={totals}
        onUpdateStock={async (updates) => {
          for (const u of updates) {
            await updateItem.mutateAsync({ id: u.id, quantity: u.quantity });
          }
        }}
      />

      {/* Employee Dialog */}
      <Dialog open={empDialogOpen} onOpenChange={setEmpDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmpId ? "Editar Funcionário" : "Cadastrar Funcionário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="Nome" value={empName} onChange={(e) => setEmpName(e.target.value)} />
            <Input placeholder="Função" value={empRole} onChange={(e) => setEmpRole(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEmpDialogOpen(false); setEditingEmpId(null); }}>Cancelar</Button>
            <Button onClick={handleAddEmployee} disabled={addEmployee.isPending || updateEmployee.isPending} className="gap-2">
              <Plus className="h-4 w-4" /> {editingEmpId ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
          {employees.length > 0 && (
            <div className="rounded-lg border bg-card overflow-hidden mt-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/5">
                    <TableHead>ID</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-mono font-medium">{emp.employee_id}</TableCell>
                      <TableCell>{emp.name}</TableCell>
                      <TableCell>{emp.role}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditEmployee(emp)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteEmployee(emp.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="Nome da categoria" value={catName} onChange={(e) => setCatName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddCategory} disabled={addCategory.isPending} className="gap-2">
              <Plus className="h-4 w-4" /> Cadastrar
            </Button>
          </DialogFooter>
          {categories.length > 0 && (
            <div className="rounded-lg border bg-card overflow-hidden mt-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/5">
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell>{cat.name}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
