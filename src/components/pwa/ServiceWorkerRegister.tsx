"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Register service worker after window load to not block initial render
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("Deep Roots Service Worker active:", registration.scope);
          })
          .catch((error) => {
            console.warn("Service Worker registration failed:", error);
          });
      });
    }
  }, []);

  return null;
}
