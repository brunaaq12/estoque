import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------
// Funções utilitárias extraídas da lógica de negócio
// ---------------------------------------------------------------

function formatCode(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length > 2) return digits.slice(0, 2) + "." + digits.slice(2);
  return digits;
}

function calcBalance(quantity: number, withdrawn: number): number {
  return quantity - withdrawn;
}

function calcStockStatus(
  balance: number,
  idealStock: number
): "critical" | "low" | "ok" {
  if (balance <= 0) return "critical";
  if (balance < idealStock) return "low";
  return "ok";
}

// ---------------------------------------------------------------
// Testes
// ---------------------------------------------------------------

describe("formatCode", () => {
  it("formata código com 6 dígitos", () => {
    expect(formatCode("123456")).toBe("12.3456");
  });

  it("não excede 6 dígitos", () => {
    expect(formatCode("12345678")).toBe("12.3456");
  });

  it("aceita código com menos de 3 dígitos sem ponto", () => {
    expect(formatCode("12")).toBe("12");
  });

  it("ignora caracteres não numéricos", () => {
    expect(formatCode("ab12.34cd")).toBe("12.34");
  });
});

describe("calcBalance", () => {
  it("calcula saldo corretamente", () => {
    expect(calcBalance(100, 30)).toBe(70);
  });

  it("saldo pode ser zero", () => {
    expect(calcBalance(50, 50)).toBe(0);
  });

  it("saldo pode ser negativo (inconsistência)", () => {
    expect(calcBalance(10, 15)).toBe(-5);
  });
});

describe("calcStockStatus", () => {
  it("retorna critical quando saldo <= 0", () => {
    expect(calcStockStatus(0, 10)).toBe("critical");
    expect(calcStockStatus(-1, 10)).toBe("critical");
  });

  it("retorna low quando saldo positivo mas abaixo do ideal", () => {
    expect(calcStockStatus(3, 10)).toBe("low");
  });

  it("retorna ok quando saldo >= ideal", () => {
    expect(calcStockStatus(10, 10)).toBe("ok");
    expect(calcStockStatus(20, 10)).toBe("ok");
  });
});
