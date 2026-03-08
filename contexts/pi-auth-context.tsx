"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

export type LoginDTO = {
  id: string;
  username: string;
  credits_balance: number;
  terms_accepted: boolean;
};

interface PiAuthResult {
  accessToken: string;
  user: {
    uid: string;
    username: string;
  };
}

declare global {
  interface Window {
    Pi: {
      init: (config: { version: string; sandbox?: boolean }) => Promise<void>;
      authenticate: (scopes: string[]) => Promise<PiAuthResult>;
    };
  }
}

interface PiAuthContextType {
  isAuthenticated: boolean;
  isPiAvailable: boolean;
  authMessage: string;
  piAccessToken: string | null;
  userData: LoginDTO | null;
  reinitialize: () => Promise<void>;
}

const PiAuthContext = createContext<PiAuthContextType | undefined>(undefined);

export function PiAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPiAvailable, setIsPiAvailable] = useState(false);
  const [authMessage, setAuthMessage] = useState("Initializing...");
  const [piAccessToken, setPiAccessToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<LoginDTO | null>(null);

  const initializePi = async () => {
    try {
      // Check if Pi SDK is available (Pi Browser only)
      if (typeof window === "undefined") return;

      // Try to load Pi SDK
      const loadSDK = (): Promise<void> =>
        new Promise((resolve, reject) => {
          if (typeof window.Pi !== "undefined") {
            resolve();
            return;
          }
          const script = document.createElement("script");
          script.src = "https://sdk.minepi.com/pi-sdk.js";
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Pi SDK not available"));
          document.head.appendChild(script);
        });

      await loadSDK();

      if (typeof window.Pi === "undefined") {
        // Not in Pi browser, that's fine - app still works
        setIsPiAvailable(false);
        return;
      }

      setIsPiAvailable(true);
      setAuthMessage("Authenticating with Pi Network...");

      await window.Pi.init({ version: "2.0", sandbox: false });
      const piAuthResult = await window.Pi.authenticate(["username"]);

      if (piAuthResult?.accessToken) {
        setPiAccessToken(piAuthResult.accessToken);
        setIsAuthenticated(true);
        setAuthMessage("Authenticated with Pi Network");
      }
    } catch (err) {
      // Pi auth failed - app still works without it
      setIsPiAvailable(false);
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    // Run Pi init in background, don't block app
    initializePi();
  }, []);

  const value: PiAuthContextType = {
    isAuthenticated,
    isPiAvailable,
    authMessage,
    piAccessToken,
    userData,
    reinitialize: initializePi,
  };

  return (
    <PiAuthContext.Provider value={value}>{children}</PiAuthContext.Provider>
  );
}

export function usePiAuth() {
  const context = useContext(PiAuthContext);
  if (context === undefined) {
    throw new Error("usePiAuth must be used within a PiAuthProvider");
  }
  return context;
}
