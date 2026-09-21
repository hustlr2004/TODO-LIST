import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";

type Priority = "High" | "Medium" | "Low";
type Status = "pending" | "completed";
type Recurrence = "none" | "daily" | "weekly";

type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  due_date: string | null;
  priority: Priority;
  category: string;
  status: Status;
  reminder_at: string | null;
  recurrence: Recurrence;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const priorities = new Set(["High", "Medium", "Low"]);
const statuses = new Set(["pending", "completed"]);
const recurrences = new Set(["none", "daily", "weekly"]);

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to view tasks." }, { status: 401 });
  }

  const result = await env.DB.prepare(
    `SELECT * FROM tasks WHERE user_id = ? ORDER BY
      CASE status WHEN 'pending' THEN 0 ELSE 1 END,
      CASE priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END,
      COALESCE(due_date, '9999-12-31') ASC,
      created_at DESC`,
  )
    .bind(user.userId)
    .all<TaskRow>();

  return NextResponse.json({
    tasks: (result.results ?? []).map(fromRow),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to create tasks." }, { status: 401 });
  }

  const input = await request.json().catch(() => null);
  const task = sanitizeTaskInput(input);
  if (!task.title) {
    return NextResponse.json({ error: "Task title is required." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await ensureUser(user.userId, user.email, user.displayName, now);
  await env.DB.prepare(
    `INSERT INTO tasks (
      id, user_id, title, description, due_date, priority, category, status,
      reminder_at, recurrence, created_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.userId,
      task.title,
      task.description,
      task.dueDate,
      task.priority,
      task.category,
      task.status,
      task.reminderAt,
      task.recurrence,
      now,
      now,
      task.status === "completed" ? now : null,
    )
    .run();

  const row = await env.DB.prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?")
    .bind(id, user.userId)
    .first<TaskRow>();

  return NextResponse.json({ task: row ? fromRow(row) : null }, { status: 201 });
}

async function ensureUser(
  id: string,
  email: string,
  displayName: string,
  now: string,
) {
  await env.DB.prepare(
    `INSERT INTO users (id, email, display_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email,
       display_name = excluded.display_name,
       updated_at = excluded.updated_at`,
  )
    .bind(id, email, displayName, now, now)
    .run();
}

function sanitizeTaskInput(input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const title = asText(body.title).slice(0, 140);
  const priority = asChoice(body.priority, priorities, "Medium") as Priority;
  const status = asChoice(body.status, statuses, "pending") as Status;
  const recurrence = asChoice(body.recurrence, recurrences, "none") as Recurrence;

  return {
    title,
    description: asText(body.description).slice(0, 800),
    dueDate: asNullableDate(body.dueDate),
    priority,
    category: asText(body.category).slice(0, 40) || "Personal",
    status,
    reminderAt: asNullableDateTime(body.reminderAt),
    recurrence,
  };
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asChoice(value: unknown, options: Set<string>, fallback: string) {
  return typeof value === "string" && options.has(value) ? value : fallback;
}

function asNullableDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function asNullableDateTime(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function fromRow(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    priority: row.priority,
    category: row.category,
    status: row.status,
    reminderAt: row.reminder_at,
    recurrence: row.recurrence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}
