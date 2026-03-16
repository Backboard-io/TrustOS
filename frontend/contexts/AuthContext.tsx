"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  clearSelectedAppId,
  clearToken,
  getSelectedAppId,
  getToken,
  setSelectedAppId,
  setToken,
} from "@/lib/api";

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  role: string;
  assistant_id: string;
  created_at: string;
}

export interface AppRead {
  id: string;
  name: string;
  description: string;
  user_id: string;
  assistant_id: string;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: UserPublic | null;
  token: string | null;
  selectedApp: AppRead | null;
  isLoading: boolean;

  login: (token: string, user: UserPublic) => void;
  logout: () => void;
  selectApp: (app: AppRead) => void;
  clearApp: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<UserPublic | null>(null);
  const [selectedApp, setSelectedApp] = useState<AppRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const storedToken = getToken();
    const storedAppId = getSelectedAppId();

    if (storedToken) {
      // Decode the JWT payload to get user info (no verify needed client-side)
      try {
        const payloadB64 = storedToken.split(".")[1];
        const payload = JSON.parse(atob(payloadB64));
        setTokenState(storedToken);
        setUser({
          id: payload.sub,
          email: payload.email ?? "",
          name: payload.name ?? "",
          role: payload.role ?? "viewer",
          assistant_id: payload.assistant_id ?? "",
          created_at: "",
        });
      } catch {
        clearToken();
      }
    }

    // Restore selected app from localStorage (stored as JSON)
    if (storedAppId) {
      const raw = localStorage.getItem("ps_app_json");
      if (raw) {
        try {
          setSelectedApp(JSON.parse(raw));
        } catch {
          clearSelectedAppId();
          localStorage.removeItem("ps_app_json");
        }
      }
    }

    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string, newUser: UserPublic) => {
    setToken(newToken);
    setTokenState(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    clearSelectedAppId();
    localStorage.removeItem("ps_app_json");
    setTokenState(null);
    setUser(null);
    setSelectedApp(null);
  }, []);

  const selectApp = useCallback((app: AppRead) => {
    setSelectedAppId(app.id);
    localStorage.setItem("ps_app_json", JSON.stringify(app));
    setSelectedApp(app);
  }, []);

  const clearApp = useCallback(() => {
    clearSelectedAppId();
    localStorage.removeItem("ps_app_json");
    setSelectedApp(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, selectedApp, isLoading, login, logout, selectApp, clearApp }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
