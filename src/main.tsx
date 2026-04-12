import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSecurityMeasures } from "./lib/security";
import { registerServiceWorker, preloadCriticalResources } from "./lib/cache";
import { getVpsCdnUrl } from "./lib/config";
import { registerServiceWorker, preloadCriticalResources } from "./lib/cache";

// Initialize security measures in production
initSecurityMeasures();

// Register service worker for caching
registerServiceWorker();
preloadCriticalResources();

// Prime VPS config cache from DB
getVpsCdnUrl();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
