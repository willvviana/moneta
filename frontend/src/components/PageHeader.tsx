// Page title block: a small mono eyebrow (with a vermilion ink stroke), then a serif headline.
export function PageHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
    </header>
  );
}
