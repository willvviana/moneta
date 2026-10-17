import { describe, expect, it } from "vitest";
import { INITIAL_STATE, parseStored } from "./theme";

describe("parseStored", () => {
  it("falls back to light for missing or broken data", () => {
    expect(parseStored(null)).toEqual(INITIAL_STATE);
    expect(parseStored("{not json")).toEqual(INITIAL_STATE);
  });

  it("keeps a saved dark mode", () => {
    expect(parseStored(JSON.stringify({ version: 3, mode: "dark" }))).toEqual({ mode: "dark" });
  });

  it("ignores the mode saved by older versions (it was always saved, dark by default)", () => {
    expect(parseStored(JSON.stringify({ version: 2, mode: "dark" }))).toEqual({ mode: "light" });
  });

  it("drops unknown modes", () => {
    expect(parseStored(JSON.stringify({ version: 3, mode: "neon" }))).toEqual({ mode: "light" });
  });

  it("ignores colours and fonts saved by the removed customisation feature", () => {
    const old = { version: 3, mode: "dark", overrides: { dark: { nav: "#112233" } }, fonts: { display: "mono" } };
    expect(parseStored(JSON.stringify(old))).toEqual({ mode: "dark" }); // the mode is kept, the rest is gone
  });
});
