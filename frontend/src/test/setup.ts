import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock do cliente REST para testes unitários
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getToken: vi.fn(() => null),
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));
