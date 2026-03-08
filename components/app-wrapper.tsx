"use client";

import type { ReactNode } from "react";
import { PiAuthProvider } from "@/contexts/pi-auth-context";

// App renders immediately for all users
// Pi authentication is optional and handled per-feature
export function AppWrapper({ children }: { children: ReactNode }) {
  return (
    <PiAuthProvider>
      {children}
    </PiAuthProvider>
  );
}
