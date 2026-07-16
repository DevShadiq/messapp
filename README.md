# PicoMess — Mess Management

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

## Windows Nginx deployment

The production API listens on port `4000`; Nginx serves the built Vue app and
proxies `/api/` to that API. Do not proxy the site to Vite's development port
(`5173`) or to port `3001`.

1. Copy `deploy/messapp.env.example` to `server/.env` and set the real MySQL
   and JWT secret values. Set `WEB_ORIGIN` to the public site URL.
2. Run `npm ci`, then `npm run build`. This creates `web/dist`.
3. Start the API with `npm run start`. Use a service manager such as NSSM so it
   restarts after a reboot.
4. Replace the existing `mess.shadiqur.com` HTTPS block with
   `deploy/nginx-messapp.conf` (the `map` directive belongs once in the parent
   `http` block). Add the optional HTTP redirect block if it is not already in
   the main Nginx config.
5. Validate and reload: `C:\nginx\nginx.exe -t`, then
   `C:\nginx\nginx.exe -s reload`.

Verify from the server with `http://127.0.0.1:4000/api/health` and externally
with `https://mess.shadiqur.com/api/health`.
