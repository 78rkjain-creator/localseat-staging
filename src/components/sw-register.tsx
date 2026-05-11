"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("SW registration failed:", err));

    // When a new service worker activates after a deploy, reload the page
    // so the user gets the latest JS bundles and avoids stale UI.
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SW_UPDATED") {
        window.location.reload();
      }
    });
  }, []);

  return null;
}
