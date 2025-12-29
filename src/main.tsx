import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSecurityMeasures } from "./lib/security";
import { registerServiceWorker, preloadCriticalResources } from "./lib/cache";

// Initialize security measures in production
initSecurityMeasures();

// Register service worker for caching
registerServiceWorker();

// Preload critical resources
preloadCriticalResources();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
