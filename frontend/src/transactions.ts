import { api } from "./api";

export interface Category {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  categoryId: string;
  type: "income" | "expense";
  amountCents: number;
  date: string; // YYYY-MM-DD
  description: string;
}

export type TransactionInput = Omit<Transaction, "id">;

export const listCategories = () => api<{ categories: Category[] }>("/categories").then((r) => r.categories);

export const createCategory = (name: string) =>
  api<{ category: Category }>("/categories", { method: "POST", body: { name } }).then((r) => r.category);

// Only the name changes. Transactions and budgets reference the category by id, so they follow automatically.
export const renameCategory = (id: string, name: string) =>
  api<{ category: Category }>(`/categories/${id}`, { method: "PATCH", body: { name } }).then((r) => r.category);

// The server refuses (409) while any transaction or budget still uses the category.
export const deleteCategory = (id: string) => api<void>(`/categories/${id}`, { method: "DELETE" });

// from is included, to is excluded: [from, to)
export const listTransactions = (from: string, to: string) =>
  api<{ transactions: Transaction[] }>(`/transactions?from=${from}&to=${to}`).then((r) => r.transactions);

export const createTransaction = (input: TransactionInput) =>
  api<{ transaction: Transaction }>("/transactions", { method: "POST", body: input }).then((r) => r.transaction);

export const updateTransaction = (id: string, input: TransactionInput) =>
  api<{ transaction: Transaction }>(`/transactions/${id}`, { method: "PATCH", body: input }).then((r) => r.transaction);

export const deleteTransaction = (id: string) => api<void>(`/transactions/${id}`, { method: "DELETE" });
