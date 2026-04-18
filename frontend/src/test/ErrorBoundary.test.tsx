import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "@/components/ErrorBoundary";

// Suprime console.error para não poluir output dos testes
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const ThrowingComponent = () => {
  throw new Error("Erro de teste");
};

const SafeComponent = () => <div>Conteúdo seguro</div>;

describe("ErrorBoundary", () => {
  it("renderiza children normalmente quando não há erro", () => {
    render(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText("Conteúdo seguro")).toBeInTheDocument();
  });

  it("exibe tela de fallback quando filho lança erro", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText("Algo deu errado")).toBeInTheDocument();
    expect(screen.getByText("Erro de teste")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recarregar/i })).toBeInTheDocument();
  });
});
