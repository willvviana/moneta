import { describe, expect, it } from "vitest";
import { hexToRgb, INITIAL_STATE, parseStored, rgbLabel } from "./theme";

describe("parseStored", () => {
  it("falls back to dark with no overrides for missing or broken data", () => {
    expect(parseStored(null)).toEqual(INITIAL_STATE);
    expect(parseStored("{not json")).toEqual(INITIAL_STATE);
  });

  it("keeps valid modes and colours, lower-cased", () => {
    const s = parseStored(JSON.stringify({ mode: "light", overrides: { light: { income: "#00FF00" }, dark: {} } }));
    expect(s.mode).toBe("light");
    expect(s.overrides.light.income).toBe("#00ff00");
  });

  it("drops unknown modes, unknown roles and malformed colours", () => {
    const s = parseStored(
      JSON.stringify({ mode: "neon", overrides: { dark: { income: "red", expense: "#12345", bogus: "#112233", nav: "#112233" } } }),
    );
    expect(s.mode).toBe("dark");
    expect(s.overrides.dark).toEqual({ nav: "#112233" });
  });
});

describe("fonts", () => {
  it("keeps allowed font choices and drops anything else", () => {
    const s = parseStored(JSON.stringify({ version: 2, fonts: { display: "mono", body: "times" } }));
    expect(s.fonts).toEqual({ display: "mono", body: "times", label: "jetbrains" });
    // fonts saved before versioning used different defaults, so they are ignored
    expect(parseStored(JSON.stringify({ fonts: { display: "instrument", body: "inter" } })).fonts).toEqual({ display: "arial", body: "arial", label: "jetbrains" });
    // unknown values (and the old "default" id) fall back to each role's own default
    const bad = parseStored(JSON.stringify({ version: 2, fonts: { display: "Comic Sans", body: "default" } }));
    expect(bad.fonts).toEqual({ display: "arial", body: "arial", label: "jetbrains" });
  });
});

describe("rgb helpers", () => {
  it("converts #rrggbb to channels", () => {
    expect(hexToRgb("#ff2e4d")).toEqual([255, 46, 77]);
    expect(rgbLabel("#000000")).toBe("rgb(0, 0, 0)");
  });
});
