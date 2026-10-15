// Environment configuration that must be right or fail loudly at startup.

// APP_ORIGIN is compared against the browser's Origin header, so it must be exactly an origin:
// scheme + host (+ port), no path, no trailing slash. In production it is required and must be https.
export function parseAppOrigin(raw: string | undefined, isProd: boolean): string {
  if (!raw) {
    if (isProd) throw new Error("APP_ORIGIN must be set in production");
    return "http://localhost:5173";
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`APP_ORIGIN is not a valid URL: "${raw}"`);
  }
  if (url.origin !== raw) throw new Error(`APP_ORIGIN must be an origin only (e.g. https://app.example.com), got "${raw}"`);
  if (isProd && url.protocol !== "https:") throw new Error("APP_ORIGIN must use https in production");
  return raw;
}

// TRUST_PROXY = number of reverse-proxy hops in front of the app. Unset means "no proxy".
// A wrong number is dangerous (too high lets clients spoof their IP), so anything that is not a
// small positive integer is an error instead of being ignored.
export function parseTrustProxy(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (!/^[1-9]\d?$/.test(raw)) throw new Error(`TRUST_PROXY must be a number of proxy hops between 1 and 99, got "${raw}"`);
  return Number(raw);
}
