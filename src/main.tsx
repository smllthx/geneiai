import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "./lib/pwa";

// Theme bootstrap — dark by default, respects user choice
const savedTheme = localStorage.getItem("genai:theme") ?? "dark";
document.documentElement.classList.toggle("dark", savedTheme !== "light");

registerSW();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
