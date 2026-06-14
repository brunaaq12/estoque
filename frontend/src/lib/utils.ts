import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Converte string com vírgula ou ponto decimal (ex: "12,5" ou "12.5") em number
export function parseDecimal(value: string): number {
  if (value == null) return NaN;
  const str = String(value).trim();
  if (str.includes(",")) {
    // Trata "." como separador de milhar e "," como decimal
    return parseFloat(str.replace(/\./g, "").replace(",", "."));
  }
  return parseFloat(str);
}

// Formata number para exibição com vírgula decimal (padrão brasileiro)
export function formatDecimal(value: number): string {
  if (value == null || isNaN(value)) return "";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
