import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Captura erros JavaScript não tratados na árvore de componentes
 * e exibe uma tela de fallback amigável ao usuário.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Em produção, aqui você enviaria para um serviço como Sentry
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="text-center space-y-4 max-w-md">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">Algo deu errado</h1>
            <p className="text-muted-foreground text-sm">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            {this.state.message && (
              <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
                {this.state.message}
              </p>
            )}
            <Button onClick={() => window.location.reload()}>
              Recarregar página
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
