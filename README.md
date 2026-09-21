 Cloud To-Do

A cloud-synced task manager with priorities, categories, search, filters and secure sign-in. Tasks are stored in a Cloudflare D1 database, so every signed-in device sees the same list.

**Live demo:** https://cloud-todo-list.ncinc412.chatgpt.site

![Cloud To-Do screenshot](docs/screenshot.png)

## Features

- **Sign in and out** with Sign in with ChatGPT (managed by the hosting platform)
- **Quick add:** type a title and press Add
- **Full task control:** create, edit, delete, and mark tasks completed or pending
- **Task details:** title (up to 140 characters), description (up to 800), due date, priority (High, Medium, Low) and category (Work, Personal, Study, Shopping)
- **Search** across title, description and category
- **Filters** for category, priority, and pending or completed
- **Grouping** into Overdue and Today sections, with counts
- **Cloud storage:** every change is saved to D1 and tasks reload when you open the app or return to its tab
- **Light and dark theme** with a toggle

## Tech stack

| Layer | Technology |
|---|---|
| UI | React 19 |
| Framework | Vinext (Next.js App Router API on Vite) |
| Build tool | Vite |
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| ORM and migrations | Drizzle ORM and Drizzle Kit |
| CLI | Wrangler |
| Auth | Sites-managed Sign in with ChatGPT |

## How it works

1. The React UI sends a request to an API route (a Next-style route handler).
2. The route reads the signed-in user's identity from trusted request headers.
3. Drizzle runs a query against D1, always scoped to that user.
4. The API returns JSON and the UI updates.

## Data model

Two tables, defined with Drizzle and created by the migration in `drizzle/`.

| Table | Contents |
|---|---|
| `users` | id, email, display name, timestamps |
| `tasks` | owner (user), title, description, due date, priority, category, status, reminder time, recurrence, and created, updated and completed timestamps |

`tasks` has indexes on (user, status) and (user, due date) to keep lists fast.

## Security

- API reads and writes require an authenticated user.
- Every task query is filtered by the signed-in user's id on the server, so one user cannot read another user's tasks.
- The user's identity comes from platform request headers, never from data sent by the browser.
- Title and description lengths are validated.

## Getting started

### Prerequisites

- Node.js 20.19 or newer
- npm (or pnpm)

### Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173.

In local development the platform's Vite plugin supplies a local D1 database and a mock account, so no real sign-in or internet connection is needed. Local data lives on your machine and is separate from the live site.

### Build

```bash
npm run build
```

### Change the database schema

1. Edit the Drizzle schema.
2. Generate a migration:
   ```bash
   npx drizzle-kit generate
   ```
3. Commit the new file in `drizzle/`.

A new migration must also reach the production database before the matching code is published, or the live app will fail on the missing column.

## Deployment

The app is published through ChatGPT Sites, which provides the sign-in, the production D1 database and its binding (`DB`). There is no checked-in `wrangler.toml` or `wrangler.jsonc`; the Wrangler config is generated at build time in `dist/server/wrangler.json`.

## Known limitations

- Sync happens on load and when the tab regains focus, not live.
- The Repeat and Reminder fields are stored, but recurring tasks are not generated and reminders are not delivered yet.
- Sign-in requires a ChatGPT account.

## Roadmap

- [ ] Recurring tasks that create their next occurrence automatically
- [ ] Reminders (browser notifications first, then background push)
- [ ] Live sync across devices
- [ ] Export tasks as JSON
- [ ] Email and password sign-in for users without a ChatGPT account

## Author

Built by Gourav ([@hustlr2004](https://github.com/hustlr2004)).
