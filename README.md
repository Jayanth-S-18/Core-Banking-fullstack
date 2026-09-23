# Core Banking System — Full-Stack Version

A working website on top of the same database from the SQL-only project:
a Node.js/Express REST API backend and a static HTML/CSS/JS dashboard
frontend, both served from one process. This was built and tested end to
end against a live MariaDB instance before being handed over — every screen
and endpoint described below was actually exercised, not just written.

```
core-banking-fullstack/
├── sql/                        same 4 files as the SQL-only project
│   ├── 01_schema.sql
│   ├── 02_triggers.sql
│   ├── 03_transfer_procedure.sql
│   └── 04_demo.sql
├── backend/
│   ├── server.js               Express app entry point
│   ├── db.js                   mysql2 connection pool
│   ├── routes/
│   │   ├── accounts.js         GET /api/accounts, GET /api/accounts/:id
│   │   ├── transfer.js         POST /api/transfer  (calls sp_transfer_funds)
│   │   ├── audit.js            GET /api/audit-logs
│   │   └── users.js            GET/POST /api/users
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── index.html               the dashboard
    ├── styles.css
    └── app.js                   fetch() calls to the API above
```

The frontend is plain HTML/CSS/JS with no build step and no framework —
Express just serves it as static files from the same port as the API, so
there's nothing to compile and only one process to run.

## How the frontend and backend fit together

- **Accounts table** — `GET /api/accounts` joins Accounts, Users, and
  Branches and renders as a ledger-style table. Refreshes every 8 seconds
  and immediately after a transfer.
- **Move money form** — submits to `POST /api/transfer`, which does *no*
  balance math itself; it just calls `sp_transfer_funds` and relays back
  whatever the database decided (`Success: transfer completed` or a
  specific rejection reason like `Rejected: insufficient funds`). All the
  ACID guarantees from the SQL-only project apply unchanged — the API layer
  is a thin pass-through, not a second place where bugs can creep in.
- **Recent activity feed** — `GET /api/audit-logs` reads straight from
  `Audit_Logs`, populated entirely by the triggers. Nothing in the frontend
  or backend ever writes to this table directly.

## Setup

### 1. Database

Run the four files from `sql/` in order against a MySQL 8.0+ / MariaDB
10.5+ server, exactly as in the SQL-only project:

```bash
mysql -u root -p < sql/01_schema.sql
mysql -u root -p < sql/02_triggers.sql
mysql -u root -p < sql/03_transfer_procedure.sql
mysql -u root -p < sql/04_demo.sql     # optional - seeds two demo accounts
```

Then create a dedicated application user rather than pointing the app at
`root` (this is what was actually tested):

```sql
CREATE USER 'bankapp'@'%' IDENTIFIED BY 'choose_a_password';
GRANT ALL PRIVILEGES ON core_banking.* TO 'bankapp'@'%';
FLUSH PRIVILEGES;
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set DB_USER=bankapp and DB_PASSWORD to what you chose above
npm start
```

You should see:
```
Core banking API + dashboard running at http://localhost:4000
```

### 3. Open it

Visit **http://localhost:4000** — the dashboard, the API, and the database
are now all connected. Try a transfer between the two seeded accounts and
watch the "Recent activity" panel update with the audit rows the triggers
just wrote.

If `http://localhost:4000/api/health` doesn't return
`{"status":"ok","database":"connected"}`, the backend can't reach MySQL —
check `.env` first.

## A real bug this project surfaced, and how it's fixed

While testing this, a genuine MySQL/MariaDB limitation showed up: a
**trigger always executes with the identity of whoever created it**, so
`CURRENT_USER()` inside a trigger body reports the trigger's *definer*, not
the session that actually fired the `UPDATE` — confirmed directly, by
connecting as the `bankapp` user and watching `Audit_Logs.changed_by` still
say `root@localhost`. Left as-is, every transfer made through this website
would have shown up in the audit trail under the wrong name, which is
exactly the failure mode an audit trail exists to prevent.

The fix, already applied in `sql/02_triggers.sql` and
`sql/03_transfer_procedure.sql`: `sp_transfer_funds` sets a session
variable, `SET @app_actor = p_initiated_by`, right before it touches any
rows, and the triggers log `COALESCE(@app_actor, CURRENT_USER())` — using
the real actor when the application supplied one, and only falling back to
`CURRENT_USER()` (the trigger's definer) when nothing did. This is why the
`initiated_by` field in the transfer form on the dashboard isn't cosmetic —
it's the value that ends up correctly attributed in the audit trail.

## What to demo to your faculty

1. Open the dashboard and point out the accounts table, then submit a
   transfer and watch the balance and "Recent activity" update live.
2. Submit a transfer for more than an account holds — show the rejection
   message and that the accounts table doesn't change.
3. Open a terminal, run a raw `UPDATE Accounts SET balance = balance + 1
   WHERE account_id = 1;` directly in a MySQL client, refresh the
   dashboard, and show the new audit row appeared anyway — proving the
   audit trail isn't something the website can be bypassed to avoid.
4. Explain the `@app_actor` fix above if asked how attribution actually
   works under the hood — it's a good, honest example of a real database
   engine limitation and a real fix for it, not just a feature list.

## Known limitations

- Single shared `bankapp` database credential for all web traffic — a
  production system would use per-session application-level auth (e.g. a
  `Login`/session table) rather than trusting a client-supplied
  `initiated_by` string, which anyone calling the API directly could set to
  anything. That's out of scope here; the point of this layer is to show
  the database mechanics working through a real HTTP interface, not to
  implement bank-grade authentication.
- No HTTPS/TLS setup — fine for local coursework demonstration, required
  before this would touch real data.
- The dashboard polls every 8 seconds rather than using WebSockets/SSE for
  live updates; simpler to run and to explain, at the cost of a small delay.
