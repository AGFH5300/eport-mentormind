import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Polyfill for process object in browser
if (typeof window !== 'undefined' && !window.process) {
  window.process = { env: {} } as any;
}

createRoot(document.getElementById("root")!).render(<App />);
