import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Trash2, CalendarIcon } from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BulkDeleteByPeriodProps {
  label?: string;
  records: { id: string; created_at: string; [key: string]: any }[];
  onDeleteRecords: (records: any[]) => Promise<void>;
}

export default function BulkDeleteByPeriod({ label = "Excluir Registros Mensal", records, onDeleteRecords }: BulkDeleteByPeriodProps) {
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [matchedCount, setMatchedCount] = useState(0);
  const [matchedRecords, setMatchedRecords] = useState<any[]>([]);
  const [deleting, setDeleting] = useState(false);

  const handleSearch = () => {
    if (!dateFrom || !dateTo) {
      toast.error("Selecione o período (data inicial e final)");
      return;
    }
    const filtered = records.filter((r) => {
      const date = new Date(r.created_at);
      return isWithinInterval(date, { start: startOfDay(dateFrom), end: endOfDay(dateTo) });
    });
    if (filtered.length === 0) {
      toast.error("Nenhum registro encontrado no período selecionado");
      return;
    }
    setMatchedRecords(filtered);
    setMatchedCount(filtered.length);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDeleteRecords(matchedRecords);
      toast.success(`${matchedCount} registro(s) excluído(s) com sucesso!`);
      setConfirmOpen(false);
      setOpen(false);
      setDateFrom(undefined);
      setDateTo(undefined);
    } catch {
      toast.error("Erro ao excluir registros");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button onClick={() => { setDateFrom(undefined); setDateTo(undefined); setOpen(true); }} variant="destructive" className="gap-2">
        <Trash2 className="h-4 w-4" /> {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={handleSearch} variant="destructive" className="w-full gap-2">
              <Trash2 className="h-4 w-4" /> Buscar e Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja realmente excluir <strong>{matchedCount}</strong> registro(s) do período selecionado? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Não
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Sim"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
