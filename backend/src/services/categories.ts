import { AppError, pgErrorCode } from "../errors.js";
import * as repo from "../repositories/categories.js";

// Service layer: turns database outcomes into predictable API outcomes.

export const list = repo.listCategories;

export async function create(userId: string, name: string) {
  try {
    return await repo.insertCategory(userId, name);
  } catch (err) {
    if (pgErrorCode(err) === "23505") throw new AppError(409, "You already have a category with that name");
    throw err;
  }
}

export async function rename(userId: string, id: string, name: string) {
  try {
    const category = await repo.renameCategory(userId, id, name);
    if (!category) throw new AppError(404, "Category not found");
    return category;
  } catch (err) {
    if (pgErrorCode(err) === "23505") throw new AppError(409, "You already have a category with that name");
    throw err;
  }
}

export async function remove(userId: string, id: string) {
  try {
    if (!(await repo.deleteCategory(userId, id))) throw new AppError(404, "Category not found");
  } catch (err) {
    // 23503: a composite FK refuses to delete a category that transactions or budgets still use.
    if (pgErrorCode(err) === "23503") throw new AppError(409, "Category is used by transactions or budgets");
    throw err;
  }
}
