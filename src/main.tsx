import "./validation";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./plan/dashboard.css";
import "./appearance.css";
import { applyAppearance } from "./appearance";
import { readSettings } from "./settings";

applyAppearance(readSettings());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
