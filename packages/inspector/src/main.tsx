// Chronos Inspector entry (Phase 4.1–4.2). Mounts the React app into #root.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

const el = document.getElementById("root");
if (!el) throw new Error("#root element not found in index.html");

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
