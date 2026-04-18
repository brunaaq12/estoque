import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, PackagePlus, Package, QrCode, LogOut, Shield } from "lucide-react";
import StockControl from "@/components/StockControl";
import WithdrawalManager from "@/components/WithdrawalManager";
import ReplenishmentManager from "@/components/ReplenishmentManager";
import QRCodeManager from "@/components/QRCodeManager";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import logoEstoque from "@/assets/logo-estoque.png";

const Index = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-5 px-6 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-3 relative">
          <img src={logoEstoque} alt="Estoque Civil" className="h-10 w-10 object-contain" />
          <h1 className="text-lg font-bold tracking-tight uppercase">Estoque Civil</h1>
          <div className="absolute right-0 flex items-center gap-2">
            {isAdmin && <span title="Administrador"><Shield className="h-4 w-4 text-warning" /></span>}
            <span className="text-xs hidden sm:inline truncate max-w-[120px]">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair" className="text-primary-foreground hover:bg-primary/80">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-6 px-4">
        <Tabs defaultValue="withdrawals" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="withdrawals" className="gap-2">
              <ClipboardList className="h-4 w-4" /> Retiradas
            </TabsTrigger>
            <TabsTrigger value="replenishment" className="gap-2">
              <PackagePlus className="h-4 w-4" /> Reposição
            </TabsTrigger>
            <TabsTrigger value="stock" className="gap-2">
              <Package className="h-4 w-4" /> Estoque
            </TabsTrigger>
            <TabsTrigger value="qrcode" className="gap-2">
              <QrCode className="h-4 w-4" /> QR Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stock">
            <StockControl />
          </TabsContent>
          <TabsContent value="withdrawals">
            <WithdrawalManager />
          </TabsContent>
          <TabsContent value="replenishment">
            <ReplenishmentManager />
          </TabsContent>
          <TabsContent value="qrcode">
            <QRCodeManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
