import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";

type Priority = "High" | "Medium" | "Low";
type Status = "pending" | "completed";
type Recurrence = "none" | "daily" | "weekly";

type TaskRow = {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  priority: Priority;
  category: string;
  status: Status;
  reminder_at: string | null;
  recurrence: Recurrence;
  next_created: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const priorities = new Set(["High", "Medium", "Low"]);
const statuses = new Set(["pending", "completed"]);
const recurrences = new Set(["none", "daily", "weekly"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to update tasks." }, { status: 401 });
  }

  const { id } = await params;
  const input = await request.json().catch(() => null);
  const task = sanitizeTaskInput(input);
  if (!task.title) {
    return NextResponse.json({ error: "Task title is required." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const completedAt = task.status === "completed" ? now : null;
  const createsNext =
    task.status === "completed" &&
    task.dueDate !== null &&
    task.recurrence !== "none";
  const intervalDays = task.recurrence === "weekly" ? 7 : 1;
  const nextDueDate = createsNext ? addDays(task.dueDate!, intervalDays) : null;
  const nextReminderAt =
    createsNext && task.reminderAt
      ? addDaysToDateTime(task.reminderAt, intervalDays)
      : null;

  const updateStatement = env.DB.prepare(
    `UPDATE tasks SET
      title = ?,
      description = ?,
      due_date = ?,
      priority = ?,
      category = ?,
      status = ?,
      reminder_at = ?,
      recurrence = ?,
      next_created = CASE
        WHEN status = 'pending' AND next_created = 0 AND ? = 1 THEN 1
        ELSE next_created
      END,
      updated_at = ?,
      completed_at = ?
     WHERE id = ? AND user_id = ?`,
  )
    .bind(
      task.title,
      task.description,
      task.dueDate,
      task.priority,
      task.category,
      task.status,
      task.reminderAt,
      task.recurrence,
      createsNext ? 1 : 0,
      now,
      completedAt,
      id,
      user.userId,
    );

  let updateResult: D1Result;
  let nextTaskId: string | null = null;
  if (createsNext) {
    const nextId = crypto.randomUUID();
    const insertNextStatement = env.DB.prepare(
      `INSERT INTO tasks (
        id, user_id, title, description, due_date, priority, category, status,
        reminder_at, recurrence, next_created, created_at, updated_at, completed_at
      )
      SELECT ?, user_id, ?, ?, ?, ?, ?, 'pending', ?, ?, 0, ?, ?, NULL
      FROM tasks
      WHERE id = ? AND user_id = ? AND status = 'pending' AND next_created = 0`,
    ).bind(
      nextId,
      task.title,
      task.description,
      nextDueDate,
      task.priority,
      task.category,
      nextReminderAt,
      task.recurrence,
      now,
      now,
      id,
      user.userId,
    );
    const [inserted, updated] = await env.DB.batch([
      insertNextStatement,
      updateStatement,
    ]);
    updateResult = updated;
    nextTaskId = inserted.meta.changes ? nextId : null;
  } else {
    updateResult = await updateStatement.run();
  }

  if (!updateResult.meta.changes) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const row = await env.DB.prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?")
    .bind(id, user.userId)
    .first<TaskRow>();
  const nextRow = nextTaskId
    ? await env.DB.prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?")
        .bind(nextTaskId, user.userId)
        .first<TaskRow>()
    : null;

  return NextResponse.json({
    task: row ? fromRow(row) : null,
    nextTask: nextRow ? fromRow(nextRow) : null,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to delete tasks." }, { status: 401 });
  }

  const { id } = await params;
  const result = await env.DB.prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?")
    .bind(id, user.userId)
    .run();

  if (!result.meta.changes) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
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

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addDaysToDateTime(value: string, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
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
