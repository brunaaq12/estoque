import { useState, useRef, useEffect } from "react";
import { useStockItems, useUpdateStockItem, useAddWithdrawal, useEmployees, useApplications } from "@/hooks/useStockItems";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { QrCode, Camera, Plus, Minus, Printer, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import jsPDF from "jspdf";
import { Html5Qrcode } from "html5-qrcode";

function formatCode(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length > 2) return digits.slice(0, 2) + "." + digits.slice(2);
  return digits;
}

export default function QRCodeManager() {
  const { data: items = [] } = useStockItems();
  const { data: employees = [] } = useEmployees();
  const { data: applications = [] } = useApplications();
  const updateItem = useUpdateStockItem();
  const addWithdrawal = useAddWithdrawal();

  const [codeInput, setCodeInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatedType, setGeneratedType] = useState<"item" | "employee">("item");

  // Employee QR
  const [empSearch, setEmpSearch] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [generatedEmpCode, setGeneratedEmpCode] = useState<string | null>(null);

  // Size dialog
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false);
  const [pendingPrintType, setPendingPrintType] = useState<"item" | "employee" | null>(null);

  // Scanner
  const [scanning, setScanning] = useState(false);
  const [scannedItem, setScannedItem] = useState<{ id: string; item_code: string; item_name: string; quantity: number } | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-reader";

  // Withdrawal form state
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawResponsible, setWithdrawResponsible] = useState("");
  const [withdrawApplication, setWithdrawApplication] = useState("");
  const [withdrawQty, setWithdrawQty] = useState("1");

  const selectedItem = items.find((i) => i.id === selectedItemId);
  const selectedEmp = employees.find((e) => e.id === selectedEmpId);

  const empSuggestions = empSearch.length > 0 && !selectedEmpId
    ? employees.filter((e) => e.employee_id.toLowerCase().includes(empSearch.toLowerCase()) || e.name.toLowerCase().includes(empSearch.toLowerCase())).slice(0, 5)
    : [];

  const handleEmpSearch = (val: string) => {
    setEmpSearch(val);
    const found = employees.find((e) => e.employee_id.toLowerCase() === val.toLowerCase() || e.name.toLowerCase() === val.toLowerCase());
    if (found) setSelectedEmpId(found.id);
    else setSelectedEmpId("");
  };

  // handleGenerateEmp is now handleGenerateEmpQR defined below

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

  const codeSuggestions = codeInput.length > 0 && !selectedItemId
    ? items.filter((i) => i.item_code.toLowerCase().includes(codeInput.toLowerCase())).slice(0, 5)
    : [];
  const nameSuggestions = nameInput.length > 0 && !selectedItemId
    ? items.filter((i) => i.item_name.toLowerCase().includes(nameInput.toLowerCase())).slice(0, 5)
    : [];

  const handleGenerate = () => {
    if (!selectedItemId) {
      toast.error("Selecione um item para gerar o QR Code");
      return;
    }
    const item = items.find((i) => i.id === selectedItemId);
    if (item) {
      setGeneratedCode(item.item_code);
      setPendingPrintType("item");
      setSizeDialogOpen(true);
    }
  };

  const handleGenerateEmpQR = () => {
    if (!selectedEmpId) {
      toast.error("Selecione um funcionário");
      return;
    }
    const emp = employees.find((e) => e.id === selectedEmpId);
    if (emp) {
      setGeneratedEmpCode(emp.employee_id);
      setPendingPrintType("employee");
      setSizeDialogOpen(true);
    }
  };

  const SIZE_CONFIG = {
    small: { format: [40, 50] as [number, number], qr: 25, imgX: 7.5, imgY: 3, fontSize1: 7, fontSize2: 5, textY1: 31, textY2: 35, centerX: 20, maxW: 35 },
    medium: { format: [60, 75] as [number, number], qr: 40, imgX: 10, imgY: 4, fontSize1: 10, fontSize2: 7, textY1: 48, textY2: 54, centerX: 30, maxW: 50 },
    large: { format: [80, 100] as [number, number], qr: 60, imgX: 10, imgY: 5, fontSize1: 12, fontSize2: 9, textY1: 72, textY2: 78, centerX: 40, maxW: 70 },
  };

  const printQrPdf = (size: "small" | "medium" | "large") => {
    const isEmp = pendingPrintType === "employee";
    const selector = isEmp ? ".emp-qr-print-area svg" : ".qr-print-area svg";
    const label1 = isEmp ? selectedEmp?.employee_id : selectedItem?.item_code;
    const label2 = isEmp ? selectedEmp?.name : selectedItem?.item_name;
    const fileName = isEmp ? `QR_${selectedEmp?.employee_id}` : `QR_${selectedItem?.item_code}`;

    if (!label1 || !label2) return;

    const cfg = SIZE_CONFIG[size];

    // We need to render the QR first, so we create a hidden SVG
    const svgEl = document.querySelector(selector) as SVGElement;
    if (!svgEl) {
      // Generate hidden QR and retry
      toast.error("QR Code não encontrado. Tente novamente.");
      return;
    }
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 400, 400);
      ctx.drawImage(img, 0, 0, 400, 400);
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "mm", format: cfg.format });
      pdf.addImage(imgData, "PNG", cfg.imgX, cfg.imgY, cfg.qr, cfg.qr);
      pdf.setFontSize(cfg.fontSize1);
      pdf.text(label1, cfg.centerX, cfg.textY1, { align: "center" });
      pdf.setFontSize(cfg.fontSize2);
      pdf.text(label2, cfg.centerX, cfg.textY2, { align: "center", maxWidth: cfg.maxW });
      pdf.save(`${fileName}.pdf`);
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    setSizeDialogOpen(false);
  };

  const startScanner = async () => {
    setScanning(true);
    // Wait for DOM element to render
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(scannerContainerId);
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // Find item by code
            const found = items.find((i) => i.item_code === decodedText);
            if (found) {
              setScannedItem({ id: found.id, item_code: found.item_code, item_name: found.item_name, quantity: found.quantity });
              setActionDialogOpen(true);
              stopScanner();
            } else {
              toast.error(`Item com código "${decodedText}" não encontrado no estoque`);
            }
          },
          () => {} // ignore scan failures
        );
      } catch (err) {
        toast.error("Erro ao acessar a câmera. Verifique as permissões.");
        setScanning(false);
      }
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  const handleAction = async (action: "add" | "remove") => {
    if (!scannedItem) return;
    if (action === "add") {
      try {
        await updateItem.mutateAsync({ id: scannedItem.id, quantity: scannedItem.quantity + 1 });
        toast.success(`+1 adicionado a "${scannedItem.item_name}"`);
        setActionDialogOpen(false);
        setScannedItem(null);
      } catch {
        toast.error("Erro ao atualizar quantidade");
      }
    } else {
      // Open withdrawal form dialog
      setActionDialogOpen(false);
      setWithdrawResponsible("");
      setWithdrawApplication("");
      setWithdrawQty("1");
      setWithdrawDialogOpen(true);
    }
  };

  const handleConfirmWithdrawal = async () => {
    if (!scannedItem) return;
    const qtyNum = parseInt(withdrawQty) || 1;
    try {
      await addWithdrawal.mutateAsync({
        item_id: scannedItem.id,
        quantity_withdrawn: qtyNum,
        application: withdrawApplication,
        responsible: withdrawResponsible,
      });
      toast.success(`-${qtyNum} retirado de "${scannedItem.item_name}"`);
      setWithdrawDialogOpen(false);
      setScannedItem(null);
    } catch {
      toast.error("Erro ao registrar retirada");
    }
  };

  return (
    <div className="space-y-8">
      {/* Action buttons */}
      <div className="flex gap-4 justify-center flex-wrap">
        <Button
          onClick={scanning ? stopScanner : startScanner}
          size="lg"
          className="gap-3 text-lg px-8 py-6"
          variant={scanning ? "destructive" : "default"}
        >
          <Camera className="h-6 w-6" />
          {scanning ? "Parar" : "Ler QR Code"}
        </Button>
      </div>

      {/* Scanner area */}
      {scanning && (
        <div className="flex justify-center">
          <div id={scannerContainerId} className="w-full max-w-md rounded-lg overflow-hidden border-2 border-primary" />
        </div>
      )}

      {/* Generate QR Code section */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <QrCode className="h-5 w-5" /> Gerar QR Code
        </h3>
        <div className="flex gap-3 items-start flex-wrap">
          <div className="relative">
            <label className="text-xs text-muted-foreground">Código do item</label>
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
          <div className="relative flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Nome do item</label>
            <Input placeholder="Nome do item" value={nameInput} onChange={(e) => handleNameChange(e.target.value)} />
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
          <div className="pt-5">
            <Button onClick={handleGenerate} className="gap-2">
              <QrCode className="h-4 w-4" /> Gerar
            </Button>
          </div>
        </div>

        {generatedCode && selectedItem && (
          <div className="flex flex-col items-center gap-4 pt-4">
            <div className="qr-print-area bg-white p-6 rounded-lg shadow-md">
              <QRCodeSVG value={generatedCode} size={200} />
            </div>
            <div className="text-center">
              <p className="font-mono font-bold text-lg">{selectedItem.item_code}</p>
              <p className="text-muted-foreground">{selectedItem.item_name}</p>
            </div>
            <Button
              onClick={() => { setPendingPrintType("item"); setSizeDialogOpen(true); }}
              className="gap-2"
              variant="outline"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        )}
      </div>

      {/* Generate Employee QR Code section */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" /> Gerar QR Code de Funcionário
        </h3>
        <div className="flex gap-3 items-start flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">ID ou Nome do funcionário</label>
            <Input placeholder="Digite o ID ou nome..." value={empSearch} onChange={(e) => handleEmpSearch(e.target.value)} />
            {empSuggestions.length > 0 && (
              <div className="absolute z-10 top-full left-0 w-full bg-card border rounded-md shadow-lg mt-1">
                {empSuggestions.map((e) => (
                  <button key={e.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setEmpSearch(`${e.employee_id} — ${e.name}`); setSelectedEmpId(e.id); }}>
                    {e.employee_id} — {e.name} ({e.role})
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="pt-5">
            <Button onClick={handleGenerateEmpQR} className="gap-2">
              <QrCode className="h-4 w-4" /> Gerar
            </Button>
          </div>
        </div>

        {generatedEmpCode && selectedEmp && (
          <div className="flex flex-col items-center gap-4 pt-4">
            <div className="emp-qr-print-area bg-white p-6 rounded-lg shadow-md">
              <QRCodeSVG value={generatedEmpCode} size={200} />
            </div>
            <div className="text-center">
              <p className="font-mono font-bold text-lg">{selectedEmp.employee_id}</p>
              <p className="text-muted-foreground">{selectedEmp.name} — {selectedEmp.role}</p>
            </div>
            <Button
              onClick={() => { setPendingPrintType("employee"); setSizeDialogOpen(true); }}
              className="gap-2"
              variant="outline"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        )}
      </div>

      {/* Action Dialog after scanning */}
      <Dialog open={actionDialogOpen} onOpenChange={(open) => { setActionDialogOpen(open); if (!open) setScannedItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Item Encontrado</DialogTitle>
          </DialogHeader>
          {scannedItem && (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-1">
                <p className="font-mono font-bold text-xl">{scannedItem.item_code}</p>
                <p className="text-lg">{scannedItem.item_name}</p>
                <p className="text-muted-foreground">Quantidade atual: <strong className="text-foreground">{scannedItem.quantity}</strong></p>
              </div>
              <div className="flex gap-4 justify-center">
                <Button
                  size="lg"
                  className="gap-2 px-8 py-6 text-lg bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleAction("add")}
                  disabled={updateItem.isPending}
                >
                  <Plus className="h-6 w-6" /> Incluir
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  className="gap-2 px-8 py-6 text-lg"
                  onClick={() => handleAction("remove")}
                  disabled={updateItem.isPending}
                >
                  <Minus className="h-6 w-6" /> Retirar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Withdrawal Form Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={(open) => { setWithdrawDialogOpen(open); if (!open) setScannedItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Registrar Retirada</DialogTitle>
          </DialogHeader>
          {scannedItem && (
            <div className="space-y-4 py-2">
              <div className="text-center space-y-1">
                <p className="font-mono font-bold text-lg">{scannedItem.item_code}</p>
                <p>{scannedItem.item_name}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantidade</label>
                <Input type="number" min="1" value={withdrawQty} onChange={(e) => setWithdrawQty(e.target.value)} placeholder="1" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Responsável</label>
                <Select value={withdrawResponsible} onValueChange={setWithdrawResponsible}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.name}>{e.employee_id} — {e.name} ({e.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Aplicação</label>
                <Select value={withdrawApplication} onValueChange={setWithdrawApplication}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar aplicação" />
                  </SelectTrigger>
                  <SelectContent>
                    {applications.map((a) => (
                      <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setWithdrawDialogOpen(false); setScannedItem(null); }}>Cancelar</Button>
            <Button onClick={handleConfirmWithdrawal} disabled={addWithdrawal.isPending}>Confirmar Retirada</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Size Selection Dialog */}
      <Dialog open={sizeDialogOpen} onOpenChange={setSizeDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Tamanho do QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button variant="outline" className="py-6 text-base" onClick={() => printQrPdf("small")}>
              Pequeno (40×50mm)
            </Button>
            <Button variant="outline" className="py-6 text-base" onClick={() => printQrPdf("medium")}>
              Médio (60×75mm)
            </Button>
            <Button variant="outline" className="py-6 text-base" onClick={() => printQrPdf("large")}>
              Grande (80×100mm)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
