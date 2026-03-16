"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet, apiFetch } from "@/lib/api";

interface UserPublic {
  id: string;
  email: string;
  name: string;
  role: string;
  assistant_id: string;
  created_at: string;
}

interface AppWithOwner {
  id: string;
  name: string;
  description: string;
  user_id: string;
  assistant_id: string;
  owner_email: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

type Tab = "users" | "apps";
type UserRole = "admin" | "user" | "viewer";

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: "viewer", label: "Viewer", description: "Read-only access" },
  { value: "user",   label: "User",   description: "Create & manage own apps" },
  { value: "admin",  label: "Admin",  description: "Full access" },
];

// ── User Edit Modal ────────────────────────────────────────────────────────────

function UserEditModal({
  user,
  currentUserId,
  onClose,
  onSaved,
}: {
  user: UserPublic;
  currentUserId: string;
  onClose: () => void;
  onSaved: (updated: UserPublic) => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<UserRole>(
    (["admin", "user", "viewer"].includes(user.role) ? user.role : "user") as UserRole
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      const res = await apiFetch(`/api/v1/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, email, role }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail ?? "Failed to save");
      }
      const updated: UserPublic = await res.json();
      onSaved(updated);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const isSelf = user.id === currentUserId;

  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl shadow-black/20 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Edit User</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <p className="text-sm text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Fields */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-bb-blue/40 focus:border-bb-blue/50 transition-colors"
              placeholder="Full name"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-bb-blue/40 focus:border-bb-blue/50 transition-colors"
              placeholder="user@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => {
                const isSelected = role === r.value;
                return (
                  <button
                    key={r.value}
                    disabled={isSelf}
                    onClick={() => setRole(r.value)}
                    className={[
                      "rounded-lg border px-3 py-2.5 text-left transition-colors",
                      isSelected
                        ? r.value === "admin"
                          ? "border-bb-blue bg-bb-blue/10 text-bb-blue"
                          : r.value === "user"
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                          : "border-border bg-muted/60 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30",
                      isSelf ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <p className="text-sm font-medium">{r.label}</p>
                    <p className="text-[10px] mt-0.5 opacity-70">{r.description}</p>
                  </button>
                );
              })}
            </div>
            {isSelf && (
              <p className="text-xs text-muted-foreground">You cannot change your own role.</p>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="rounded-lg bg-muted/20 border border-border/60 px-3 py-2.5 space-y-1">
          <p className="text-[11px] text-muted-foreground/60 font-mono">ID: {user.id}</p>
          <p className="text-[11px] text-muted-foreground/60 font-mono truncate">
            Assistant: {user.assistant_id || "—"}
          </p>
          <p className="text-[11px] text-muted-foreground/60">
            Joined: {new Date(user.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-bb-blue px-4 py-2 text-sm font-medium text-white hover:bg-bb-blue/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Admin Page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, selectApp } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [apps, setApps] = useState<AppWithOwner[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingApps, setLoadingApps] = useState(false);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);

  // Guard: non-admins bounce back
  useEffect(() => {
    if (user && user.role !== "admin") router.replace("/");
  }, [user, router]);

  useEffect(() => {
    apiGet<UserPublic[]>("/api/v1/admin/users")
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    if (tab !== "apps" || apps.length > 0) return;
    setLoadingApps(true);
    apiGet<AppWithOwner[]>("/api/v1/admin/apps")
      .then(setApps)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingApps(false));
  }, [tab, apps.length]);

  function handleAppClick(a: AppWithOwner) {
    selectApp({
      id: a.id,
      name: a.name,
      description: a.description,
      user_id: a.user_id,
      assistant_id: a.assistant_id,
      created_at: a.created_at,
      updated_at: a.updated_at,
    });
    router.push("/");
  }

  function handleUserSaved(updated: UserPublic) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }

  const roleBadge = (role: string) => {
    if (role === "admin") return "bg-bb-blue/15 text-bb-blue";
    if (role === "user") return "bg-emerald-500/15 text-emerald-400";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="page-enter">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage users and view all compliance workspaces.
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-rose-500 bg-rose-500/10 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {(["users", "apps"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
              tab === t
                ? "border-bb-blue text-bb-blue"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Users tab ── */}
      {tab === "users" && (
        loadingUsers ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl border border-border bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className={[
                      "cursor-pointer transition-colors",
                      i < users.length - 1 ? "border-b border-border/60" : "",
                      u.id === user?.id ? "bg-bb-blue/5 hover:bg-bb-blue/10" : "hover:bg-muted/30",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {u.name}
                      {u.id === user?.id && (
                        <span className="ml-2 text-[10px] text-muted-foreground/60 font-normal">you</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${roleBadge(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Apps tab ── */}
      {tab === "apps" && (
        loadingApps ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl border border-border bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No apps exist yet.
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">App</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Owner</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Assistant ID</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a, i) => (
                  <tr
                    key={a.id}
                    onClick={() => handleAppClick(a)}
                    className={[
                      "cursor-pointer hover:bg-muted/30 transition-colors",
                      i < apps.length - 1 ? "border-b border-border/60" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{a.name}</p>
                      {a.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{a.owner_name}</p>
                      <p className="text-xs text-muted-foreground">{a.owner_email}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground/70 max-w-[180px] truncate">
                      {a.assistant_id}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── User Edit Modal ── */}
      {selectedUser && user && (
        <UserEditModal
          user={selectedUser}
          currentUserId={user.id}
          onClose={() => setSelectedUser(null)}
          onSaved={handleUserSaved}
        />
      )}
    </div>
  );
}
