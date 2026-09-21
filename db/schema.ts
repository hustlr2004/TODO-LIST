import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    dueDate: text("due_date"),
    priority: text("priority", { enum: ["High", "Medium", "Low"] })
      .notNull()
      .default("Medium"),
    category: text("category").notNull().default("Personal"),
    status: text("status", { enum: ["pending", "completed"] })
      .notNull()
      .default("pending"),
    reminderAt: text("reminder_at"),
    recurrence: text("recurrence", { enum: ["none", "daily", "weekly"] })
      .notNull()
      .default("none"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("idx_tasks_user_status").on(table.userId, table.status),
    index("idx_tasks_user_due_date").on(table.userId, table.dueDate),
  ],
);
