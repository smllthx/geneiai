import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./styles/liquid.css";
import { startAppearance } from "./lib/appearance";
import { registerSW } from "./lib/pwa";
import { startAppInstallation } from "./lib/appInstallation";

startAppearance();

startAppInstallation();
if (import.meta.env.PROD) registerSW();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
