import { ApiError } from "../api";
import type { Lang } from "./locale";
import { API_ERRORS, MESSAGES } from "./messages";

// The text to show for a caught error, in the given language. An API error is translated by its code;
// an unknown code (e.g. from a newer server) falls back to the server's English message, never to nothing.
export function errorText(err: unknown, lang: Lang): string {
  if (err instanceof ApiError) return (err.code && API_ERRORS[lang][err.code]) || err.message;
  if (err instanceof Error && err.message) return err.message;
  return MESSAGES[lang].common.unknownError;
}
