import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(form.email, form.password);
        toast.success("Login realizado com sucesso!");
      } else {
        await signUp(form.email, form.password, form.full_name);
        toast.success("Conta criada com sucesso!");
      }
      navigate("/");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Estoque Civil</CardTitle>
          <CardDescription>
            {isLogin ? "Entre com sua conta" : "Crie sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handle} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <Label htmlFor="full_name">Nome completo</Label>
                <Input
                  id="full_name"
                  placeholder="Seu nome"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aguarde...</>
              ) : isLogin ? "Entrar" : "Criar conta"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {isLogin ? (
              <>
                Não tem conta?{" "}
                <button
                  className="text-primary underline"
                  onClick={() => setIsLogin(false)}
                >
                  Criar conta
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button
                  className="text-primary underline"
                  onClick={() => setIsLogin(true)}
                >
                  Entrar
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
