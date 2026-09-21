"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ListChecks,
  LogIn,
  Moon,
  MoreHorizontal,
  Plus,
  Repeat2,
  Search,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type User = { email: string } | null;

type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  priority: "High" | "Medium" | "Low";
  category: string;
  status: "pending" | "completed";
  reminderAt: string | null;
  recurrence: "none" | "daily" | "weekly";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type Draft = {
  title: string;
  description: string;
  dueDate: string;
  priority: Task["priority"];
  category: string;
  reminderAt: string;
  recurrence: Task["recurrence"];
};

type GroupKey = "overdue" | "today" | "upcoming" | "noDate" | "completed";

const emptyDraft: Draft = {
  title: "",
  description: "",
  dueDate: "",
  priority: "Medium",
  category: "Personal",
  reminderAt: "",
  recurrence: "none",
};

const categories = ["Work", "Personal", "Study", "Shopping"];
const priorities = ["High", "Medium", "Low"] as const;
const recurrences = ["none", "daily", "weekly"] as const;
const groupDetails: Array<{ key: GroupKey; label: string; empty: string }> = [
  { key: "overdue", label: "Overdue", empty: "Nothing overdue." },
  { key: "today", label: "Today", empty: "No tasks today. Add one above." },
  { key: "upcoming", label: "Upcoming", empty: "Nothing scheduled next." },
  { key: "noDate", label: "No date", empty: "No unscheduled tasks." },
  { key: "completed", label: "Completed", empty: "Completed tasks will appear here." },
];

export default function TodoApp({ user, signInPath, signOutPath }: {
  user: User;
  signInPath: string;
  signOutPath: string;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [loading, setLoading] = useState(Boolean(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("task-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const frame = window.requestAnimationFrame(() => {
      setDark(saved ? saved === "dark" : prefersDark);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("task-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    if (!user) return;
    void loadTasks();
    const refresh = () => {
      if (document.visibilityState === "visible") void loadTasks();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user]);

  const filteredTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesText = !needle || task.title.toLowerCase().includes(needle) ||
        task.description.toLowerCase().includes(needle) || task.category.toLowerCase().includes(needle);
      return matchesText &&
        (categoryFilter === "All" || task.category === categoryFilter) &&
        (priorityFilter === "All" || task.priority === priorityFilter);
    });
  }, [categoryFilter, priorityFilter, query, tasks]);

  const groups = useMemo(() => groupTasks(filteredTasks), [filteredTasks]);
  const pendingCount = tasks.filter((task) => task.status === "pending").length;
  const activeFilterCount = Number(categoryFilter !== "All") + Number(priorityFilter !== "All");

  async function loadTasks() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/tasks", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Tasks could not be loaded.");
      setTasks(data.tasks);
    } catch (caught) {
      setError(`${messageFrom(caught)} Check your connection and try again.`);
    } finally {
      setLoading(false);
    }
  }

  async function saveTask(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.title.trim()) {
      setError("Enter a title, then add the task again.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const wasEditing = Boolean(editingId);
    const payload = {
      ...draft,
      dueDate: draft.dueDate || null,
      reminderAt: draft.reminderAt ? new Date(draft.reminderAt).toISOString() : null,
      status: editingId ? tasks.find((task) => task.id === editingId)?.status ?? "pending" : "pending",
    };
    try {
      const response = await fetch(editingId ? `/api/tasks/${editingId}` : "/api/tasks", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Task could not be saved.");
      setTasks((current) => editingId
        ? current.map((task) => task.id === editingId ? data.task : task)
        : [data.task, ...current]);
      resetDraft();
      setNotice(wasEditing ? "Task saved." : "Task added.");
    } catch (caught) {
      setError(`${messageFrom(caught)} Review the task and try again.`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(task: Task) {
    setError("");
    const completing = task.status === "pending";
    try {
      await updateTask(task, { status: completing ? "completed" : "pending" });
      setNotice(completing ? "Task completed." : "Task moved to pending.");
    } catch {
      // updateTask provides the actionable error.
    }
  }

  async function updateTask(task: Task, patch: Partial<Task>) {
    const next = { ...task, ...patch };
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Task could not be updated.");
      setTasks((current) => data.nextTask
        ? [data.nextTask, ...current.map((item) => item.id === task.id ? data.task : item)]
        : current.map((item) => item.id === task.id ? data.task : item));
    } catch (caught) {
      setError(`${messageFrom(caught)} Try again.`);
      throw caught;
    }
  }

  async function deleteTask(task: Task) {
    setError("");
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Task could not be deleted.");
      }
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setNotice("Task deleted.");
    } catch (caught) {
      setError(`${messageFrom(caught)} Try again.`);
    }
  }

  function editTask(task: Task) {
    setEditingId(task.id);
    setError("");
    setDraft({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate ?? "",
      priority: task.priority,
      category: task.category,
      reminderAt: task.reminderAt ? toDateTimeLocal(task.reminderAt) : "",
      recurrence: task.recurrence,
    });
  }

  function resetDraft() {
    setDraft(emptyDraft);
    setEditingId(null);
    setShowOptions(false);
  }

  function handleEditorKeys(event: KeyboardEvent) {
    if (event.key === "Escape") resetDraft();
  }

  return (
    <main className="task-app min-h-screen">
      <div className="mx-auto min-h-screen w-full max-w-[1080px] px-4 pb-16 pt-5 sm:px-7 lg:px-10">
        <header className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[var(--ink)] text-[var(--surface)]">
              <ListChecks className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[28px] font-semibold leading-none">Tasks</h1>
              {user ? <p className="mt-1 truncate text-xs text-[var(--muted-ink)]">{pendingCount} {pendingCount === 1 ? "task" : "tasks"} pending</p> : null}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="touch-target" onClick={() => setDark((current) => !current)} aria-label={dark ? "Use light theme" : "Use dark theme"} title={dark ? "Use light theme" : "Use dark theme"}>
              {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </Button>
            {user ? <Button variant="ghost" asChild className="touch-target px-3"><a href={signOutPath} target="_top">Sign out</a></Button> : null}
          </div>
        </header>

        {!user ? (
          <section className="mx-auto max-w-lg py-24 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)]"><ListChecks aria-hidden="true" /></div>
            <h2 className="mt-5 text-xl font-semibold">Keep your list with you</h2>
            <p className="mx-auto mt-2 max-w-[52ch] text-sm leading-6 text-[var(--muted-ink)]">Sign in to save tasks online and use the same list on every device.</p>
            <Button asChild className="mt-6 h-11 bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"><a href={signInPath} target="_top"><LogIn aria-hidden="true" />Sign in</a></Button>
          </section>
        ) : (
          <>
            <section className="py-5" aria-label="Add task">
              <form className="quick-add overflow-hidden rounded-md border border-[var(--line-strong)] bg-[var(--surface)]" onSubmit={saveTask} onKeyDown={handleEditorKeys}>
                <div className="flex items-center gap-2 p-2">
                  <Plus className="ml-2 size-5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                  <Input aria-label="Task title" placeholder={editingId ? "Finish editing the task below" : "Add a task"} value={editingId ? "" : draft.title} disabled={Boolean(editingId)} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="h-11 border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0" />
                  <Button type="submit" disabled={saving || Boolean(editingId)} className="h-11 bg-[var(--accent)] px-4 text-white hover:bg-[var(--accent-strong)]">{saving && !editingId ? "Adding" : "Add"}</Button>
                </div>
                {!editingId ? (
                  <div className="border-t border-[var(--line)]">
                    <button type="button" className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-medium text-[var(--muted-ink)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]" onClick={() => setShowOptions((current) => !current)} aria-expanded={showOptions} aria-controls="quick-options">
                      <ChevronDown className={`size-4 transition-transform ${showOptions ? "rotate-180" : ""}`} />More options
                    </button>
                    {showOptions ? <div id="quick-options" className="editor-options border-t border-[var(--line)] p-4"><TaskFields draft={draft} setDraft={setDraft} /></div> : null}
                  </div>
                ) : null}
              </form>
              <div aria-live="polite" className="mt-2 min-h-5 px-1 text-sm">
                {error ? <p role="alert" className="text-[var(--danger)]">{error}</p> : null}
                {!error && notice ? <p className="text-[var(--accent-strong)]">{notice}</p> : null}
              </div>
            </section>

            <section aria-label="Task filters" className="filter-bar mb-2 border-y border-[var(--line)] py-3">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-ink)]" />
                  <Input aria-label="Search tasks" placeholder="Search tasks" value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 border-[var(--line)] bg-[var(--surface)] pl-9 shadow-none" />
                </div>
                <Button type="button" variant="outline" className="touch-target shrink-0 border-[var(--line)] bg-[var(--surface)] sm:hidden" onClick={() => setShowFilters((current) => !current)} aria-expanded={showFilters} aria-controls="task-filters-mobile">
                  <SlidersHorizontal aria-hidden="true" />Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
                </Button>
                <div className="filter-controls hidden sm:flex">
                  <FilterSelect label="Category" value={categoryFilter} onChange={setCategoryFilter} options={["All", ...categories]} />
                  <FilterSelect label="Priority" value={priorityFilter} onChange={setPriorityFilter} options={["All", ...priorities]} />
                </div>
              </div>
              {showFilters ? <div id="task-filters-mobile" className="mt-2 flex gap-2 sm:hidden"><FilterSelect label="Category" value={categoryFilter} onChange={setCategoryFilter} options={["All", ...categories]} /><FilterSelect label="Priority" value={priorityFilter} onChange={setPriorityFilter} options={["All", ...priorities]} /></div> : null}
            </section>

            <section aria-label="Task list" className="mt-5">
              {loading ? <TaskSkeleton /> : groupDetails.map((group) => (
                <TaskGroup key={group.key} label={group.label} empty={group.empty} tasks={groups[group.key]} editingId={editingId} draft={draft} saving={saving} setDraft={setDraft} onToggle={toggleTask} onEdit={editTask} onDelete={deleteTask} onSave={saveTask} onCancel={resetDraft} onEditorKeyDown={handleEditorKeys} />
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function TaskFields({ draft, setDraft }: {
  draft: Draft;
  setDraft: (value: Draft | ((current: Draft) => Draft)) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="field-label sm:col-span-2"><span>Description</span><Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Add a note" className="min-h-20 resize-y bg-[var(--surface)]" /></label>
      <label className="field-label"><span>Due date</span><Input type="date" value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} /></label>
      <label className="field-label"><span>Priority</span><select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as Draft["priority"] }))}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
      <label className="field-label"><span>Category</span><select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="field-label"><span>Repeat</span><select value={draft.recurrence} onChange={(event) => setDraft((current) => ({ ...current, recurrence: event.target.value as Draft["recurrence"] }))}>{recurrences.map((recurrence) => <option key={recurrence} value={recurrence}>{recurrence === "none" ? "Does not repeat" : recurrence}</option>)}</select></label>
      <label className="field-label sm:col-span-2"><span>Reminder</span><Input type="datetime-local" value={draft.reminderAt} onChange={(event) => setDraft((current) => ({ ...current, reminderAt: event.target.value }))} /></label>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  const allLabel = label === "Category" ? "All categories" : "All priorities";
  return (
    <label className="sr-only-label"><span>{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option === "All" ? allLabel : option}</option>)}</select></label>
  );
}

function TaskGroup({ label, empty, tasks, editingId, draft, saving, setDraft, onToggle, onEdit, onDelete, onSave, onCancel, onEditorKeyDown }: {
  label: string;
  empty: string;
  tasks: Task[];
  editingId: string | null;
  draft: Draft;
  saving: boolean;
  setDraft: (value: Draft | ((current: Draft) => Draft)) => void;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onSave: (event?: FormEvent) => void;
  onCancel: () => void;
  onEditorKeyDown: (event: KeyboardEvent) => void;
}) {
  const headingId = `group-${label.replace(" ", "-").toLowerCase()}`;
  return (
    <section className="task-group" aria-labelledby={headingId}>
      <div className="group-heading"><h2 id={headingId}>{label}</h2><span aria-label={`${tasks.length} tasks`}>{String(tasks.length).padStart(2, "0")}</span></div>
      <div className="task-list">
        {tasks.length ? tasks.map((task) => editingId === task.id ? (
          <form key={task.id} className={`task-row editing priority-${task.priority.toLowerCase()}`} onSubmit={onSave} onKeyDown={onEditorKeyDown}>
            <div className="col-start-2 min-w-0 space-y-3 pr-2 sm:pr-0">
              <Input autoFocus aria-label="Task title" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="h-11 text-base font-semibold" />
              <TaskFields draft={draft} setDraft={setDraft} />
              <div className="flex gap-2"><Button type="submit" disabled={saving} className="h-11 bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]">{saving ? "Saving" : "Save"}</Button><Button type="button" variant="outline" className="h-11" onClick={onCancel}>Cancel</Button></div>
            </div>
          </form>
        ) : <TaskRow key={task.id} task={task} onToggle={() => onToggle(task)} onEdit={() => onEdit(task)} onDelete={() => onDelete(task)} />) : <p className="group-empty">{empty}</p>}
      </div>
    </section>
  );
}

function TaskRow({ task, onToggle, onEdit, onDelete }: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className={`task-row priority-${task.priority.toLowerCase()} ${task.status === "completed" ? "is-completed" : ""}`}>
      <div className="flex min-h-11 items-start justify-center pt-3"><Checkbox checked={task.status === "completed"} onCheckedChange={onToggle} aria-label={`Mark ${task.title} ${task.status === "completed" ? "pending" : "completed"}`} className="size-5" /></div>
      <div className="min-w-0 py-2.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h3 className="min-w-0 text-base font-semibold leading-6">{task.title}</h3><span className="priority-label">{task.priority} priority</span></div>
        {task.description ? <p className="mt-1 max-w-[72ch] text-sm leading-6 text-[var(--muted-ink)]">{task.description}</p> : null}
        <div className="task-meta mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-ink)]">
          <span>{task.category}</span>
          {task.dueDate ? <span><CalendarDays aria-hidden="true" />{formatDate(task.dueDate)}</span> : null}
          {task.reminderAt ? <span><Bell aria-hidden="true" />{formatDateTime(task.reminderAt)}</span> : null}
          {task.recurrence !== "none" ? <span><Repeat2 aria-hidden="true" />{task.recurrence}</span> : null}
        </div>
      </div>
      <details className="row-menu relative"><summary aria-label={`Actions for ${task.title}`} title="Task actions"><MoreHorizontal aria-hidden="true" /></summary><div className="absolute right-0 top-10 z-20 min-w-32 rounded-md border border-[var(--line)] bg-[var(--surface)] p-1 shadow-lg"><button type="button" onClick={onEdit}>Edit</button><button type="button" className="text-[var(--danger)]" onClick={onDelete}>Delete</button></div></details>
    </article>
  );
}

function TaskSkeleton() {
  return (
    <div aria-label="Loading tasks" aria-busy="true" className="space-y-8">
      {[0, 1, 2].map((group) => <div key={group}><div className="skeleton mb-3 h-5 w-28" /><div className="border-y border-[var(--line)]">{[0, 1].map((row) => <div key={row} className="flex gap-4 border-b border-[var(--line)] p-4 last:border-0"><div className="skeleton size-5" /><div className="flex-1"><div className="skeleton h-4 w-2/5" /><div className="skeleton mt-3 h-3 w-3/5" /></div></div>)}</div></div>)}
    </div>
  );
}

function groupTasks(tasks: Task[]): Record<GroupKey, Task[]> {
  const groups: Record<GroupKey, Task[]> = { overdue: [], today: [], upcoming: [], noDate: [], completed: [] };
  const today = localDateKey(new Date());
  for (const task of tasks) {
    if (task.status === "completed") groups.completed.push(task);
    else if (!task.dueDate) groups.noDate.push(task);
    else if (task.dueDate < today) groups.overdue.push(task);
    else if (task.dueDate === today) groups.today.push(task);
    else groups.upcoming.push(task);
  }
  return groups;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
