"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarClock,
  Check,
  Cloud,
  Edit3,
  LogIn,
  Plus,
  Repeat,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type User = {
  displayName: string;
  email: string;
} | null;

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

export default function TodoApp({
  user,
  signInPath,
  signOutPath,
}: {
  user: User;
  signInPath: string;
  signOutPath: string;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Task["status"]>("all");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [loading, setLoading] = useState(Boolean(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    void loadTasks();
  }, [user]);

  const stats = useMemo(() => {
    const pending = tasks.filter((task) => task.status === "pending").length;
    const completed = tasks.length - pending;
    const dueSoon = tasks.filter((task) => isDueSoon(task) && task.status === "pending").length;
    return { pending, completed, dueSoon };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesText =
        !needle ||
        task.title.toLowerCase().includes(needle) ||
        task.description.toLowerCase().includes(needle) ||
        task.category.toLowerCase().includes(needle);
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesCategory = categoryFilter === "All" || task.category === categoryFilter;
      const matchesPriority = priorityFilter === "All" || task.priority === priorityFilter;
      return matchesText && matchesStatus && matchesCategory && matchesPriority;
    });
  }, [categoryFilter, priorityFilter, query, statusFilter, tasks]);

  async function loadTasks() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/tasks", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not load tasks.");
      setLoading(false);
      return;
    }
    setTasks(data.tasks);
    setLoading(false);
  }

  async function saveTask() {
    if (!draft.title.trim()) {
      setError("Add a task title first.");
      return;
    }

    setSaving(true);
    setError("");
    const payload = {
      ...draft,
      dueDate: draft.dueDate || null,
      reminderAt: draft.reminderAt ? new Date(draft.reminderAt).toISOString() : null,
      status: editingId
        ? tasks.find((task) => task.id === editingId)?.status ?? "pending"
        : "pending",
    };
    const response = await fetch(editingId ? `/api/tasks/${editingId}` : "/api/tasks", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not save task.");
      setSaving(false);
      return;
    }

    setTasks((current) =>
      editingId
        ? current.map((task) => (task.id === editingId ? data.task : task))
        : [data.task, ...current],
    );
    setDraft(emptyDraft);
    setEditingId(null);
    setSaving(false);
  }

  async function toggleTask(task: Task) {
    await updateTask(task, {
      status: task.status === "completed" ? "pending" : "completed",
    });
  }

  async function updateTask(task: Task, patch: Partial<Task>) {
    const next = { ...task, ...patch };
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not update task.");
      return;
    }
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? data.task : item)),
    );
  }

  async function deleteTask(task: Task) {
    const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Could not delete task.");
      return;
    }
    setTasks((current) => current.filter((item) => item.id !== task.id));
  }

  function editTask(task: Task) {
    setEditingId(task.id);
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ccfbf1_0,#f8fafc_34%,#eef2ff_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-700 text-white shadow-sm">
              <Cloud className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-teal-800">Cloud Todo List</p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Plan the day, keep it synced
              </h1>
            </div>
          </div>
          {user ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-md border border-slate-200 bg-white/75 px-3 py-2 text-slate-700">
                {user.displayName}
              </span>
              <Button variant="outline" asChild>
                <a href={signOutPath} target="_top">Sign out</a>
              </Button>
            </div>
          ) : (
            <Button asChild className="w-fit bg-teal-700 hover:bg-teal-800">
              <a href={signInPath} target="_top">
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Sign up or log in
              </a>
            </Button>
          )}
        </header>

        {!user ? (
          <section className="grid flex-1 place-items-center">
            <div className="max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Your tasks need an account</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Sign in once and your list is stored online, backed up, and available
                from your phone, tablet, or desktop.
              </p>
              <Button asChild className="mt-5 bg-teal-700 hover:bg-teal-800">
                <a href={signInPath} target="_top">Continue</a>
              </Button>
            </div>
          </section>
        ) : (
          <section className="grid flex-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="flex flex-col gap-4">
              <div className="rounded-lg border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur">
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="Pending" value={stats.pending} />
                  <Metric label="Done" value={stats.completed} />
                  <Metric label="Due soon" value={stats.dueSoon} />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white/90 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold">
                    {editingId ? "Edit task" : "New task"}
                  </h2>
                  {editingId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(null);
                        setDraft(emptyDraft);
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <Input
                    aria-label="Task title"
                    placeholder="Title"
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                  <Textarea
                    aria-label="Task description"
                    placeholder="Description"
                    value={draft.description}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className="min-h-24 resize-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      aria-label="Due date"
                      type="date"
                      value={draft.dueDate}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          dueDate: event.target.value,
                        }))
                      }
                    />
                    <Select
                      value={draft.priority}
                      onValueChange={(value: Draft["priority"]) =>
                        setDraft((current) => ({ ...current, priority: value }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {priority}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={draft.category}
                      onValueChange={(value) =>
                        setDraft((current) => ({ ...current, category: value }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={draft.recurrence}
                      onValueChange={(value: Draft["recurrence"]) =>
                        setDraft((current) => ({ ...current, recurrence: value }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {recurrences.map((recurrence) => (
                          <SelectItem key={recurrence} value={recurrence}>
                            {recurrence === "none" ? "No repeat" : recurrence}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    aria-label="Reminder time"
                    type="datetime-local"
                    value={draft.reminderAt}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        reminderAt: event.target.value,
                      }))
                    }
                  />
                  <Button
                    onClick={saveTask}
                    disabled={saving}
                    className="w-full bg-teal-700 hover:bg-teal-800"
                  >
                    {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {saving ? "Saving" : editingId ? "Update task" : "Add task"}
                  </Button>
                  {error ? <p className="text-sm text-red-700">{error}</p> : null}
                </div>
              </div>
            </aside>

            <section className="min-w-0 rounded-lg border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <Tabs
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as "all" | Task["status"])
                  }
                >
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_150px_150px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      aria-label="Search tasks"
                      placeholder="Search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All priorities</SelectItem>
                      {priorities.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    Loading synced tasks
                  </p>
                ) : filteredTasks.length ? (
                  filteredTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={() => toggleTask(task)}
                      onEdit={() => editTask(task)}
                      onDelete={() => deleteTask(task)}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
                    <p className="text-base font-medium">No matching tasks</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Clear a filter or add a new task to this cloud list.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </section>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 text-center">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}

function TaskItem({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
      <Checkbox
        checked={task.status === "completed"}
        onCheckedChange={onToggle}
        aria-label={`Mark ${task.title} ${task.status === "completed" ? "pending" : "completed"}`}
        className="mt-1"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className={`text-base font-semibold ${
              task.status === "completed" ? "text-slate-500 line-through" : ""
            }`}
          >
            {task.title}
          </h3>
          <Badge className={priorityClass(task.priority)}>{task.priority}</Badge>
          <Badge variant="outline">{task.category}</Badge>
        </div>
        {task.description ? (
          <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          {task.dueDate ? (
            <span className={isOverdue(task) ? "font-medium text-red-700" : ""}>
              <CalendarClock className="mr-1 inline h-3.5 w-3.5" />
              {formatDate(task.dueDate)}
            </span>
          ) : null}
          {task.reminderAt ? (
            <span>
              <Bell className="mr-1 inline h-3.5 w-3.5" />
              {formatDateTime(task.reminderAt)}
            </span>
          ) : null}
          {task.recurrence !== "none" ? (
            <span>
              <Repeat className="mr-1 inline h-3.5 w-3.5" />
              {task.recurrence}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex gap-2 sm:justify-end">
        <Button variant="outline" size="icon" onClick={onEdit} aria-label={`Edit ${task.title}`}>
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onDelete}
          aria-label={`Delete ${task.title}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );
}

function priorityClass(priority: Task["priority"]) {
  if (priority === "High") return "bg-red-100 text-red-800 hover:bg-red-100";
  if (priority === "Medium") return "bg-amber-100 text-amber-800 hover:bg-amber-100";
  return "bg-teal-100 text-teal-800 hover:bg-teal-100";
}

function isOverdue(task: Task) {
  if (!task.dueDate || task.status === "completed") return false;
  return new Date(`${task.dueDate}T23:59:59`) < new Date();
}

function isDueSoon(task: Task) {
  if (!task.dueDate) return false;
  const due = new Date(`${task.dueDate}T23:59:59`).getTime();
  const now = Date.now();
  return due >= now && due - now < 1000 * 60 * 60 * 24 * 2;
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
