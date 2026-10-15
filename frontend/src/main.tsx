import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Fonts are bundled from npm (self-hosted): no third-party requests, works offline.
import "@fontsource/instrument-serif/latin-400.css"; // headlines
import "@fontsource-variable/inter/index.css"; // body text
import "@fontsource-variable/jetbrains-mono/index.css"; // labels
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
