/**
 * Auth-aware fetch wrapper.
 * Automatically injects:
 *   Authorization: Bearer <token>  (from localStorage)
 *   X-App-ID: <selectedAppId>      (from localStorage)
 */

const TOKEN_KEY = "ps_token";
const APP_KEY = "ps_app_id";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getSelectedAppId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(APP_KEY);
}

export function setSelectedAppId(id: string): void {
  localStorage.setItem(APP_KEY, id);
}

export function clearSelectedAppId(): void {
  localStorage.removeItem(APP_KEY);
}

export async function apiFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getToken();
  const appId = getSelectedAppId();

  const headers: Record<string, string> = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (appId) headers["X-App-ID"] = appId;

  return fetch(url, { ...options, headers });
}

/** Convenience: GET and parse JSON. Throws on non-ok. */
export async function apiGet<T>(url: string): Promise<T> {
  const res = await apiFetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Convenience: POST JSON body and parse response. Throws on non-ok. */
export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Convenience: PATCH JSON body and parse response. Throws on non-ok. */
export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Convenience: DELETE. Throws on non-ok. */
export async function apiDelete(url: string): Promise<void> {
  const res = await apiFetch(url, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `${res.status}`);
  }
}
