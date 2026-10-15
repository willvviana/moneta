// The logo: a small violet seal (hanko) holding one kanji, 水 ("water"), then the wordmark.
export function Brand() {
  return (
    <span className="brand">
      <span className="seal" aria-hidden="true">
        水
      </span>
      <span className="brand-name">Moneta</span>
    </span>
  );
}
