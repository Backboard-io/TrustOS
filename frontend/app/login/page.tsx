"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiPost } from "@/lib/api";

interface TokenResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    assistant_id: string;
    created_at: string;
  };
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiPost<TokenResponse>("/api/v1/auth/login", {
        email,
        password,
      });
      login(data.access_token, data.user);
      router.replace("/apps");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo / title */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">ReAssent</h1>
          <p className="text-sm text-muted-foreground mt-1">Compliance automation platform</p>
        </div>

        <div className="rounded-xl border border-border bg-[hsl(var(--card-bg))] p-8">
          <h2 className="text-lg font-semibold text-foreground mb-6">Sign in</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-bb-blue/50 focus:border-bb-blue transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-bb-blue/50 focus:border-bb-blue transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-bb-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-bb-blue/90 disabled:opacity-50 transition-colors duration-150"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/signup" className="text-bb-blue hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
