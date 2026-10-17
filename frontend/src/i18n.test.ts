import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { amountRangeProblem } from "./filters";
import { errorText } from "./i18n/errors";
import { initialLang } from "./i18n/locale";
import { MESSAGES } from "./i18n/messages";
import { centsToInput, describeRemaining, formatCents, formatCentsShort, formatSignedCents, parseDollarsToCents } from "./money";
import { capitalize, monthLabel, monthName, rangeProblem } from "./month";

const NBSP = " "; // between "R$" and the number, so they never wrap apart

describe("initialLang", () => {
  it("uses a saved choice first", () => {
    expect(initialLang("pt-BR", ["en-US"])).toBe("pt-BR");
    expect(initialLang("en-US", ["pt-BR"])).toBe("en-US");
  });

  it("ignores an unknown saved value and falls back to the browser language", () => {
    expect(initialLang("fr-FR", ["pt-BR"])).toBe("pt-BR");
    expect(initialLang("<script>", [])).toBe("en-US");
  });

  it("picks Portuguese for any pt browser language, English otherwise", () => {
    expect(initialLang(null, ["pt-BR", "en"])).toBe("pt-BR");
    expect(initialLang(null, ["pt"])).toBe("pt-BR");
    expect(initialLang(null, ["PT-pt"])).toBe("pt-BR");
    expect(initialLang(null, ["de-DE", "pt-BR"])).toBe("pt-BR"); // any preferred language counts
    expect(initialLang(null, ["en-GB"])).toBe("en-US");
    expect(initialLang(null, [])).toBe("en-US");
  });
});

describe("pt-BR money formatting (same cents, Brazilian notation)", () => {
  it.each([
    [0, `R$${NBSP}0,00`],
    [5, `R$${NBSP}0,05`],
    [1234, `R$${NBSP}12,34`],
    [100000, `R$${NBSP}1.000,00`],
    [123456789, `R$${NBSP}1.234.567,89`],
    [99999999999999, `R$${NBSP}999.999.999.999,99`],
  ])("formats %d cents as %j", (cents, text) => {
    expect(formatCents(cents, "pt-BR")).toBe(text);
  });

  it("signs net figures", () => {
    expect(formatSignedCents(140000, "pt-BR")).toBe(`+R$${NBSP}1.400,00`);
    expect(formatSignedCents(-11345, "pt-BR")).toBe(`−R$${NBSP}113,45`);
    expect(formatSignedCents(0, "pt-BR")).toBe(`R$${NBSP}0,00`);
  });

  it("describes what is left of a budget", () => {
    expect(describeRemaining(18000, "pt-BR")).toBe(`Restam R$${NBSP}180,00`);
    expect(describeRemaining(0, "pt-BR")).toBe(`Restam R$${NBSP}0,00`); // at the limit is not over
    expect(describeRemaining(-12000, "pt-BR")).toBe(`Excedido em R$${NBSP}120,00`);
  });

  it("short chart labels round half up and switch to thousands (mil)", () => {
    expect(formatCentsShort(514050, "pt-BR")).toBe(`R$${NBSP}5.141`);
    expect(formatCentsShort(12_345_678, "pt-BR")).toBe(`R$${NBSP}123${NBSP}mil`);
    expect(formatCentsShort(-514050, "pt-BR")).toBe(`−R$${NBSP}5.141`);
  });

  it("pre-fills edit forms with a decimal comma that parses back to the same cents", () => {
    expect(centsToInput(1234, "pt-BR")).toBe("12,34");
    expect(centsToInput(100000, "pt-BR")).toBe("1000,00"); // no thousands separator: must stay parseable
    for (const cents of [1, 9, 99, 100, 1234, 100000, 99999999999999]) {
      expect(parseDollarsToCents(centsToInput(cents, "pt-BR"))).toBe(cents);
    }
  });

  it("still rejects Brazilian thousands separators instead of guessing", () => {
    expect(parseDollarsToCents("1.234,56")).toBeNull();
    expect(parseDollarsToCents("1.234")).toBeNull(); // 1234 or 1.234? Ambiguous: refused
  });
});

describe("pt-BR months and messages", () => {
  it("names months in Portuguese (lowercase mid-sentence, capitalised for titles)", () => {
    expect(monthLabel("2026-10", "pt-BR")).toBe("outubro de 2026");
    expect(monthName("2026-03", "pt-BR")).toBe("março");
    expect(capitalize(monthName("2026-03", "pt-BR"))).toBe("Março");
  });

  it("explains range and amount problems in Portuguese", () => {
    expect(rangeProblem("2026-03", "2026-01", "pt-BR")).toBe("O mês inicial não pode ser depois do mês final.");
    expect(rangeProblem("2021-01", "2026-01", "pt-BR")).toContain("no máximo 60");
    expect(amountRangeProblem("20", "10", "pt-BR")).toBe("O mínimo não pode ser maior que o máximo.");
    expect(amountRangeProblem("abc", "", "pt-BR")).toContain("maiores que 0");
  });
});

describe("errorText", () => {
  it("translates an API error by its code in Portuguese", () => {
    const err = new ApiError(409, "You already have a category with that name", "CATEGORY_NAME_TAKEN");
    expect(errorText(err, "pt-BR")).toBe("Você já tem uma categoria com esse nome.");
  });

  it("keeps the server's own message in English", () => {
    const err = new ApiError(400, "amountCents: Number must be greater than 0", "VALIDATION");
    expect(errorText(err, "en-US")).toBe("amountCents: Number must be greater than 0");
  });

  it("falls back to the server message for an unknown or missing code", () => {
    expect(errorText(new ApiError(418, "Teapot", "SOMETHING_NEW"), "pt-BR")).toBe("Teapot");
    expect(errorText(new ApiError(400, "Bad"), "pt-BR")).toBe("Bad");
  });

  it("translates client-side codes too", () => {
    expect(errorText(new ApiError(0, "Cannot reach the server", "NETWORK"), "pt-BR")).toBe("Não foi possível conectar ao servidor.");
  });

  it("never returns an empty string", () => {
    expect(errorText(undefined, "pt-BR")).toBe("Erro desconhecido");
    expect(errorText(new Error(""), "en-US")).toBe("Unknown error");
  });
});

describe("dictionaries", () => {
  // The type system already requires the same keys; this also checks the runtime shape and that
  // no entry was left empty.
  type Tree = { [k: string]: unknown };
  function shape(node: unknown, path: string, out: string[]) {
    if (typeof node === "string") {
      if (node.trim() === "" && !path.endsWith("emptyAfter")) out.push(`${path} is empty`);
      out.push(`${path}:string`);
    } else if (typeof node === "function") out.push(`${path}:function/${node.length}`);
    else for (const [k, v] of Object.entries(node as Tree)) shape(v, `${path}.${k}`, out);
    return out;
  }

  it("pt-BR has exactly the same entries as en-US, none empty", () => {
    const en = shape(MESSAGES["en-US"], "", []);
    const pt = shape(MESSAGES["pt-BR"], "", []);
    expect(pt.filter((e) => e.endsWith("is empty"))).toEqual([]);
    expect(pt).toEqual(en);
  });
});
