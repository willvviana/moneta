// The logo: a small vermilion seal (hanko) holding one kanji, 金 ("gold", also "money"), then the wordmark.
export function Brand() {
  return (
    <span className="brand">
      <span className="seal" aria-hidden="true">
        金
      </span>
      <span className="brand-name">Moneta</span>
    </span>
  );
}
