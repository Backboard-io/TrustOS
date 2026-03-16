"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

type TaskStatus = "pending" | "in_progress" | "completed";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  due_at?: string;
  completed_at?: string;
};

type Employee = {
  id: string;
  email: string;
  name: string;
  department?: string;
  started_at?: string;
};

type ExpandedState = {
  type: "onboarding" | "offboarding";
  tasks: Task[];
  loading: boolean;
};

function statusBadge(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    in_progress: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status]}`}>
      {status === "completed" ? "✓ " : ""}{status.replace("_", " ")}
    </span>
  );
}

function Toast({ msg, type, onDismiss }: { msg: string; type: "success" | "error"; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-[pageEnter_0.2s_ease_both] ${
      type === "success" ? "bg-emerald-600 text-white" : "bg-destructive text-white"
    }`}>
      {type === "success" ? "✓" : "✕"} {msg}
      <button onClick={onDismiss} className="ml-1 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

export default function WorkflowsPeoplePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", department: "", started_at: "" });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, ExpandedState>>({});
  const [triggering, setTriggering] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => setToast({ msg, type });

  function loadEmployees() {
    setLoading(true);
    apiFetch("/api/v1/workflows/people")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setEmployees)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadEmployees(); }, []);

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, string> = { name: formData.name, email: formData.email };
      if (formData.department) body.department = formData.department;
      if (formData.started_at) body.started_at = formData.started_at;
      const r = await apiFetch("/api/v1/workflows/people", { method: "POST", body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).detail ?? r.statusText);
      const emp = await r.json();
      setEmployees((prev) => [emp, ...prev]);
      setFormData({ name: "", email: "", department: "", started_at: "" });
      setShowForm(false);
      showToast(`${emp.name} added`, "success");
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function triggerWorkflow(employeeId: string, type: "onboarding" | "offboarding") {
    setTriggering(`${employeeId}-${type}`);
    try {
      const r = await apiFetch(`/api/v1/workflows/people/${employeeId}/trigger-${type}`, { method: "POST", body: "{}" });
      if (!r.ok) throw new Error((await r.json()).detail ?? r.statusText);
      showToast(`${type} workflow triggered`, "success");
      await loadTasks(employeeId, type);
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    } finally {
      setTriggering(null);
    }
  }

  async function loadTasks(employeeId: string, type: "onboarding" | "offboarding") {
    setExpanded((prev) => ({ ...prev, [employeeId]: { type, tasks: prev[employeeId]?.tasks ?? [], loading: true } }));
    try {
      const r = await apiFetch(`/api/v1/workflows/people/${employeeId}/${type}-tasks`);
      const tasks: Task[] = r.ok ? await r.json() : [];
      setExpanded((prev) => ({ ...prev, [employeeId]: { type, tasks, loading: false } }));
    } catch {
      setExpanded((prev) => ({ ...prev, [employeeId]: { ...prev[employeeId], loading: false } }));
    }
  }

  async function completeTask(employeeId: string, taskId: string, taskType: "onboarding" | "offboarding") {
    const r = await apiFetch("/api/v1/workflows/people/task-completions", {
      method: "POST",
      body: JSON.stringify({ task_id: taskId, task_type: taskType }),
    });
    if (r.ok) {
      setExpanded((prev) => ({
        ...prev,
        [employeeId]: {
          ...prev[employeeId],
          tasks: prev[employeeId].tasks.map((t) =>
            t.id === taskId ? { ...t, status: "completed" as TaskStatus } : t
          ),
        },
      }));
      showToast("Task marked complete", "success");
    }
  }

  function toggleExpand(employeeId: string, type: "onboarding" | "offboarding") {
    const cur = expanded[employeeId];
    if (cur?.type === type) {
      setExpanded((prev) => { const n = { ...prev }; delete n[employeeId]; return n; });
    } else {
      loadTasks(employeeId, type);
    }
  }

  const isEmpty = !loading && !error && employees.length === 0;

  return (
    <div className="page-enter max-w-5xl">
      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

      <header className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/workflows" className="text-sm text-muted-foreground hover:text-foreground mb-1 inline-block transition-colors">← Workflows</Link>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">People</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Employee onboarding and offboarding — SOC 2 CC6.2–6.3 · HIPAA §164.308(a)(3)
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          Add Employee
        </button>
      </header>

      {/* Inline create form */}
      {showForm && (
        <form
          onSubmit={createEmployee}
          className="mb-6 rounded-xl border border-border bg-[hsl(var(--card-bg))] p-5 animate-[pageEnter_0.2s_ease_both]"
        >
          <h2 className="text-sm font-semibold mb-4">New Employee</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
              <input
                required
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                placeholder="Jane Smith"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Email *</label>
              <input
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                placeholder="jane@company.com"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Department</label>
              <input
                value={formData.department}
                onChange={(e) => setFormData((f) => ({ ...f, department: e.target.value }))}
                placeholder="Engineering"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Start date</label>
              <input
                type="date"
                value={formData.started_at}
                onChange={(e) => setFormData((f) => ({ ...f, started_at: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] disabled:opacity-50 transition-all"
            >
              {saving ? "Saving…" : "Create Employee"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-muted-foreground animate-pulse">Loading…</p>}
      {error && <p className="text-destructive text-sm">Error: {error}</p>}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg viewBox="0 0 120 100" fill="none" className="w-32 h-28 mb-6 opacity-40" style={{ animation: "pageEnter 0.5s ease both" }}>
            <circle cx="40" cy="32" r="18" stroke="currentColor" strokeWidth="2" />
            <path d="M10 90c0-16.569 13.431-30 30-30s30 13.431 30 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="85" cy="28" r="12" stroke="currentColor" strokeWidth="2" />
            <path d="M62 78c0-12.703 10.297-23 23-23s23 10.297 23 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M55 55h10M60 50v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-lg font-medium text-foreground mb-1">No employees yet</p>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Add your first employee to start tracking onboarding compliance evidence for SOC 2 and HIPAA.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Add First Employee
          </button>
        </div>
      )}

      {/* Employee list */}
      {!loading && !error && employees.length > 0 && (
        <div className="space-y-2">
          {employees.map((emp) => {
            const exp = expanded[emp.id];
            const pendingCount = exp?.tasks.filter((t) => t.status !== "completed").length ?? 0;
            const totalCount = exp?.tasks.length ?? 0;
            return (
              <div key={emp.id} className="rounded-xl border border-border bg-[hsl(var(--card-bg))] overflow-hidden transition-all">
                <div className="flex items-center gap-4 p-4">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-sm">{emp.name}</span>
                      {emp.department && <span className="text-xs text-muted-foreground">{emp.department}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{emp.email}</span>
                    {emp.started_at && <span className="text-xs text-muted-foreground ml-2">· Started {emp.started_at}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {exp && totalCount > 0 && (
                      <span className="text-xs text-muted-foreground mr-1">
                        {totalCount - pendingCount}/{totalCount} done
                      </span>
                    )}
                    <button
                      onClick={() => toggleExpand(emp.id, "onboarding")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all active:scale-[0.97] ${
                        exp?.type === "onboarding"
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                          : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Onboarding
                    </button>
                    <button
                      onClick={() => toggleExpand(emp.id, "offboarding")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all active:scale-[0.97] ${
                        exp?.type === "offboarding"
                          ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                          : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Offboarding
                    </button>
                  </div>
                </div>

                {/* Expanded task panel */}
                {exp && (
                  <div className="border-t border-border bg-muted/20 animate-[pageEnter_0.2s_ease_both]">
                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {exp.type === "onboarding" ? "Onboarding" : "Offboarding"} Tasks
                      </span>
                      {exp.tasks.length === 0 && !exp.loading && (
                        <button
                          disabled={triggering === `${emp.id}-${exp.type}`}
                          onClick={() => triggerWorkflow(emp.id, exp.type)}
                          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] disabled:opacity-50 transition-all"
                        >
                          {triggering === `${emp.id}-${exp.type}` ? "Starting…" : `Start ${exp.type}`}
                        </button>
                      )}
                    </div>

                    {exp.loading && <p className="px-4 pb-4 text-xs text-muted-foreground animate-pulse">Loading tasks…</p>}

                    {!exp.loading && exp.tasks.length === 0 && (
                      <p className="px-4 pb-4 text-xs text-muted-foreground">
                        No tasks yet. Click "Start {exp.type}" to create the default compliance checklist.
                      </p>
                    )}

                    {!exp.loading && exp.tasks.length > 0 && (
                      <ul className="pb-3">
                        {exp.tasks.map((task) => (
                          <li key={task.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/40 transition-colors">
                            <button
                              disabled={task.status === "completed"}
                              onClick={() => completeTask(emp.id, task.id, exp.type)}
                              className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                task.status === "completed"
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "border-border hover:border-primary hover:bg-primary/5"
                              }`}
                            >
                              {task.status === "completed" && (
                                <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </button>
                            <span className={`text-sm flex-1 ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                              {task.title}
                            </span>
                            {statusBadge(task.status)}
                            {task.due_at && task.status !== "completed" && (
                              <span className="text-xs text-muted-foreground ml-1">due {task.due_at}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* All done state */}
                    {!exp.loading && exp.tasks.length > 0 && exp.tasks.every((t) => t.status === "completed") && (
                      <div className="px-4 pb-4 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd"/>
                        </svg>
                        All {exp.type} tasks complete — evidence trail recorded
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
