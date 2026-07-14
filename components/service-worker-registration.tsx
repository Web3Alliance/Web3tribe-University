"use client";
import * as React from "react";

export function ServiceWorkerRegistration() {
  React.useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Silently ignore — offline support is a progressive enhancement, not
        // a hard requirement for the app to function.
      });
    }
  }, []);

  return null;
}
