// The ONE place that talks to the backend: URL prefix, cookies, JSON encoding,
// and error parsing live here so components never repeat them.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

// Called when a NON-auth request comes back 401 (session expired or revoked while using the app).
// AuthProvider registers it, so every feature gets expiry handling without repeating it.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export async function api<T>(path: string, { method = "GET", body }: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "include", // send the HTTP-only session cookie
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only rejects on network failure (server down, offline), not on HTTP errors.
    throw new ApiError(0, "Cannot reach the server");
  }

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    // A 401 on /auth/* means wrong password or "not logged in yet", which those screens handle themselves.
    if (res.status === 401 && !path.startsWith("/auth/")) onUnauthorized?.();
    // Our API always answers errors with JSON ({ error }). A non-JSON 5xx therefore comes from
    // something in front of it (Vite's proxy in dev, a gateway in production): the API is unreachable.
    const fallback = res.status >= 500 ? "Cannot reach the server" : "Request failed";
    const message = (data as { error?: string } | null)?.error ?? fallback;
    throw new ApiError(res.status, message);
  }
  return data as T;
}
