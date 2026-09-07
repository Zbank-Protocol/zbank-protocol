import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

/*
 * Two faces, two jobs: Archivo sets everything readable, JetBrains Mono sets anything that is
 * data — figures, addresses, labels. The serif display face from the previous design is gone
 * with the design; a financial product does not set its numbers in Fraunces.
 *
 * `wdth.css` for Archivo because headings are tuned on the width axis as well as weight.
 */
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/jetbrains-mono/wght.css";

import "./styles.css";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
