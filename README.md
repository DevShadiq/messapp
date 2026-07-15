# Mealora — Mess Management

A complete mess ledger for meals, groceries, deposits, shared costs, and monthly settlement.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:4000`.

The frontend and backend are separate workspaces:

- `web/` — Vue 3 + Vite frontend
- `server/` — Express + MySQL REST API

Copy `server/.env.example` to `server/.env` and enter the credentials for your existing `mess` database. Set strong values for both JWT secrets. The API expects the tables and column names from `mess-management-system-design.txt`.

## Import existing JSON data

```bash
npm run import:store --workspace server
```

The importer reads `server/data/store.json`, maps source IDs to database IDs, hashes passwords with bcrypt, and avoids duplicate transactional records when rerun.

## Production database

The MySQL 8 schema is also included at `server/migrations/001_initial.sql` for reference. Financial month closing runs in a database transaction and stores immutable rows in `member_month_summary`.

Create the first user with `POST /api/auth/register`, then create a mess with `POST /api/messes`. Existing users can sign in from the web frontend.
