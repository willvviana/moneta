import type { ReactNode } from "react";

// Page title block: a small uppercase eyebrow, then a serif headline.
// `accent` is an optional second part shown lighter and in italics ("September 2026").
export function PageHeader({ eyebrow, title, accent }: { eyebrow: string; title: string; accent?: ReactNode }) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>
        {title}
        {accent !== undefined && <> <span className="title-accent">{accent}</span></>}
      </h1>
    </header>
  );
}
