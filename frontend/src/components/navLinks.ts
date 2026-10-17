import type { Messages } from "../i18n/messages";

// The app's sections, shared by the header navigation and the footer. Labels are translated (nav.*).
export const NAV_LINKS: { to: string; key: keyof Messages["nav"]; end?: boolean }[] = [
  { to: "/", key: "overview", end: true },
  { to: "/transactions", key: "transactions" },
  { to: "/budgets", key: "budgets" },
  { to: "/categories", key: "categories" },
  { to: "/reports", key: "reports" },
];
