// The logo: a navy drop of water holding one kanji, 水 ("water"), then the wordmark.
export function Brand() {
  return (
    <span className="brand">
      <svg className="seal" viewBox="0 0 24 30" aria-hidden="true">
        <path
          d="M12 1.5C10 5 3 13 3 19.5a9 9 0 0 0 18 0C21 13 14 5 12 1.5Z"
          fill="currentColor"
          fillOpacity="0.16"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <text x="12" y="23" textAnchor="middle" fontSize="11" fill="currentColor">
          水
        </text>
      </svg>
      <span className="brand-name">Moneta</span>
    </span>
  );
}
