import { AppError, pgErrorCode } from "../errors.js";
import * as repo from "../repositories/transactions.js";

// 23503 = foreign_key_violation. With our composite FK it means the category does
// not exist FOR THIS USER (missing or someone else's): same answer, no leak.
function translate(err: unknown): never {
  if (pgErrorCode(err) === "23503") throw new AppError(400, "CATEGORY_UNKNOWN", "categoryId: category not found");
  throw err;
}

export async function list(userId: string, from: string, to: string) {
  if (from >= to) throw new AppError(400, "VALIDATION", "'from' must be earlier than 'to'"); // ISO dates compare correctly as strings
  return repo.listTransactions(userId, from, to);
}

export async function create(userId: string, input: repo.NewTransaction) {
  try {
    return await repo.insertTransaction(userId, input);
  } catch (err) {
    return translate(err);
  }
}

export async function update(userId: string, id: string, patch: repo.TransactionPatch) {
  let tx;
  try {
    tx = await repo.updateTransaction(userId, id, patch);
  } catch (err) {
    return translate(err);
  }
  if (!tx) throw new AppError(404, "TRANSACTION_NOT_FOUND", "Transaction not found"); // also what another user's id returns
  return tx;
}

export async function remove(userId: string, id: string) {
  if (!(await repo.deleteTransaction(userId, id))) throw new AppError(404, "TRANSACTION_NOT_FOUND", "Transaction not found");
}
