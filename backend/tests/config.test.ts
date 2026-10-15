import { describe, expect, it } from "vitest";
import { parseAppOrigin, parseTrustProxy } from "../src/config.js";

describe("parseAppOrigin", () => {
  it("falls back to the Vite dev origin outside production, but is required in production", () => {
    expect(parseAppOrigin(undefined, false)).toBe("http://localhost:5173");
    expect(() => parseAppOrigin(undefined, true)).toThrow("must be set");
  });

  it("accepts a clean https origin", () => {
    expect(parseAppOrigin("https://moneta.example.com", true)).toBe("https://moneta.example.com");
  });

  it("rejects values that could never match a browser Origin header", () => {
    expect(() => parseAppOrigin("moneta.example.com", false)).toThrow("not a valid URL");
    expect(() => parseAppOrigin("https://moneta.example.com/", false)).toThrow("origin only");
    expect(() => parseAppOrigin("https://moneta.example.com/app", false)).toThrow("origin only");
  });

  it("requires https in production", () => {
    expect(() => parseAppOrigin("http://moneta.example.com", true)).toThrow("https");
    expect(parseAppOrigin("http://localhost:5173", false)).toBe("http://localhost:5173");
  });
});

describe("parseTrustProxy", () => {
  it("is off when unset or empty", () => {
    expect(parseTrustProxy(undefined)).toBeUndefined();
    expect(parseTrustProxy("")).toBeUndefined();
  });

  it("accepts a small positive hop count", () => {
    expect(parseTrustProxy("1")).toBe(1);
    expect(parseTrustProxy("2")).toBe(2);
  });

  it("rejects anything else instead of silently ignoring it", () => {
    for (const bad of ["0", "-1", "true", "1.5", "100", "loopback"]) {
      expect(() => parseTrustProxy(bad)).toThrow("TRUST_PROXY");
    }
  });
});
