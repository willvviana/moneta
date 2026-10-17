import { describe, expect, it } from "vitest";
import { hexToRgb, INITIAL_STATE, parseStored, rgbLabel } from "./theme";

describe("parseStored", () => {
  it("falls back to light with no overrides for missing or broken data", () => {
    expect(parseStored(null)).toEqual(INITIAL_STATE);
    expect(parseStored("{not json")).toEqual(INITIAL_STATE);
  });

  it("keeps valid modes and colours, lower-cased", () => {
    const s = parseStored(JSON.stringify({ version: 3, mode: "dark", overrides: { light: { income: "#00FF00" }, dark: {} } }));
    expect(s.mode).toBe("dark");
    expect(s.overrides.light.income).toBe("#00ff00");
  });

  it("ignores the mode saved by older versions (it was always saved, dark by default) but keeps their colours", () => {
    const s = parseStored(JSON.stringify({ version: 2, mode: "dark", overrides: { dark: { nav: "#112233" } } }));
    expect(s.mode).toBe("light");
    expect(s.overrides.dark).toEqual({ nav: "#112233" });
  });

  it("drops unknown modes, unknown roles and malformed colours", () => {
    const s = parseStored(
      JSON.stringify({ version: 3, mode: "neon", overrides: { dark: { income: "red", expense: "#12345", bogus: "#112233", nav: "#112233" } } }),
    );
    expect(s.mode).toBe("light");
    expect(s.overrides.dark).toEqual({ nav: "#112233" });
  });
});

describe("fonts", () => {
  it("keeps allowed font choices and drops anything else", () => {
    const s = parseStored(JSON.stringify({ version: 3, fonts: { display: "mono", body: "times" } }));
    expect(s.fonts).toEqual({ display: "mono", body: "times", label: "inter" });
    // fonts saved by older versions were the old defaults (Arial / JetBrains Mono), so they are ignored
    expect(parseStored(JSON.stringify({ version: 2, fonts: { display: "arial", body: "arial", label: "jetbrains" } })).fonts).toEqual(INITIAL_STATE.fonts);
    expect(parseStored(JSON.stringify({ fonts: { display: "arial" } })).fonts).toEqual(INITIAL_STATE.fonts);
    // unknown values (and the old "default" id) fall back to each role's own default
    const bad = parseStored(JSON.stringify({ version: 3, fonts: { display: "Comic Sans", body: "default" } }));
    expect(bad.fonts).toEqual({ display: "instrument", body: "inter", label: "inter" });
  });
});

describe("rgb helpers", () => {
  it("converts #rrggbb to channels", () => {
    expect(hexToRgb("#ff2e4d")).toEqual([255, 46, 77]);
    expect(rgbLabel("#000000")).toBe("rgb(0, 0, 0)");
  });
});
