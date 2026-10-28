# Core Banking System: Full-Stack Learning Project

A complete mini core-banking system: **MySQL/MariaDB** (all the money rules) + **Node.js/Express** REST API + a **dashboard frontend** that explains itself and shows a pop-up message for every click and action.

## 1. What is this project?
"Core banking" is the central software a bank runs on. Every ATM withdrawal, UPI payment, net-banking transfer or branch deposit becomes an operation on it: *check the balance → move the money → record what happened.*
This project implements the essentials:

| Feature | Where it lives |
|---|---|
| Customers (KYC, PAN, address), branches, accounts | `Users`, `Branches`, `Accounts` tables |
| Deposit / Withdraw / Transfer | stored procedures `sp_deposit`, `sp_withdraw`, `sp_transfer_funds` |
| Automatic audit trail | trigger `trg_audit_balance` → `Audit_Logs` |
| Rejections (insufficient funds, frozen account, negative amount) | procedure checks + `CHECK` constraints |
| Reporting | views `v_account_overview`, `v_branch_summary` (uses `RANK()` window function) |
| Dashboard with toast messages | `frontend/` |

## 2. Why does it exist? (the core idea)
Money must **never** be created, lost or double-spent, even if the server crashes mid-transfer or two people pay at once. So the rules live **inside the database**, not in app code:

* **Atomicity**: a transfer debits *and* credits, or does nothing (`START TRANSACTION … COMMIT / ROLLBACK`).
* **Consistency**: `CHECK (balance >= 0)`, foreign keys and `ENUM`s make invalid data impossible.
* **Isolation**: `SELECT … FOR UPDATE` locks rows so parallel transfers can't overdraw an account.
* **Durability**: committed data survives crashes.
* **Auditability**: a trigger logs every balance change; the app cannot forget or tamper with it.

## 3. Where is this used in real life?
Banks and NBFCs (Finacle, Flexcube, TCS BaNCS), wallets and payment apps (Paytm, PhonePe, Google Pay back-ends), brokerages, insurance premium systems, and any app that holds balances: game credits, ride-share wallets, loyalty points.

## 4. How it works (one transfer)
```
Browser form ─► POST /api/transfer ─► sp_transfer_funds (MySQL)
                                        ├─ validates amount, accounts, status
                                        ├─ locks both rows (FOR UPDATE)
                                        ├─ checks balance, debits, credits
                                        ├─ inserts Transactions row, COMMIT
                                        └─ trigger writes Audit_Logs
◄── "Success: transferred 5,000.00 successfully" (shown as a toast)
```
The API does **no money math**; it only relays what the database decided.

## 5. Project structure
```
core-banking/
├── sql/01_schema.sql   tables, constraints, indexes
├── sql/02_logic.sql    trigger, 3 stored procedures, 2 views
├── sql/03_seed.sql     4 branches, 6 customers, 9 accounts, history
├── backend/            Express API (server.js, db.js)
└── frontend/           index.html, styles.css, app.js (no build step)
```

## Run with Docker

Requires Docker with Compose v2. No Node or MySQL install needed.

```bash
cp .env.example .env        # optional: edit APP_PORT and passwords
docker compose up --build
```
Open http://localhost:4000 (or whatever `APP_PORT` is set to).

**Change the port:** set `APP_PORT=8080` in `.env`, or run `APP_PORT=8080 docker compose up`. Only the host side of the mapping changes; the container keeps listening on 4000.

Useful commands:
```bash
docker compose down        # stop (data is kept)
docker compose down -v     # stop and delete the database volume (re-seeds on next start)
docker compose logs -f app # follow API logs
```
The SQL files in `sql/` run automatically the first time the database volume is created.

## 6. Run it (terminal commands)
**Requirements:** Node.js 18+ and MySQL 8+ or MariaDB 10.5+.

### Option A: you already have MySQL/MariaDB
```bash
git clone https://github.com/Jayanth-S-18/Core-Banking-fullstack.git
cd Core-Banking-fullstack          # or the unzipped core-banking folder

# 1) Create database, logic and demo data
mysql -u root -p < sql/01_schema.sql
mysql -u root -p < sql/02_logic.sql
mysql -u root -p < sql/03_seed.sql

# 2) Create a dedicated app user
mysql -u root -p -e "CREATE USER 'bankapp'@'%' IDENTIFIED BY 'choose_a_password'; GRANT ALL PRIVILEGES ON core_banking.* TO 'bankapp'@'%'; FLUSH PRIVILEGES;"

# 3) Start the backend (it also serves the dashboard)
cd backend
npm install
cp .env.example .env               # Windows: copy .env.example .env
# edit .env -> DB_USER=bankapp, DB_PASSWORD=choose_a_password
npm start
```

### Option B: no MySQL installed (Docker)
```bash
docker run --name bankdb -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 -d mariadb:10.11
# wait ~15 seconds, then:
docker exec -i bankdb mariadb -uroot -proot < sql/01_schema.sql
docker exec -i bankdb mariadb -uroot -proot < sql/02_logic.sql
docker exec -i bankdb mariadb -uroot -proot < sql/03_seed.sql
cd backend && npm install && cp .env.example .env
# in .env set: DB_USER=root  DB_PASSWORD=root
npm start
```

Open **http://localhost:4000**. Health check: `curl http://localhost:4000/api/health` → `{"status":"ok","database":"connected"}`.

## 7. Demo data
| Customer | Accounts | Notes |
|---|---|---|
| Aarav Sharma (Bengaluru) | CB1001001 savings, CB1001002 current | |
| Priya Nair (Chennai) | CB1002001 salary | |
| Rohan Mehta (Mumbai) | CB1003001 savings, CB1003002 current | largest balances |
| Ananya Iyer (Chennai) | CB1004001 savings | low balance: good for "insufficient funds" tests |
| Vikram Singh (Delhi) | CB1005001 savings, CB1005002 salary | |
| Meera Reddy (Hyderabad) | CB1006001 savings | **FROZEN**, KYC pending: transactions are rejected |

## 8. Things to try
1. Transfer ₹5,000 CB1001002 → CB1002001, then open **Audit trail**: two balance rows were logged by the trigger.
2. Withdraw ₹10,00,000 from CB1004001: *Rejected: insufficient funds* (and a FAILED row appears in History).
3. Deposit to the frozen account CB1006001: *Rejected: account not found or FROZEN*.
4. Onboard a new customer under **Accounts**: user, account and opening deposit are created in one DB transaction.
5. Try SQL directly: `SELECT * FROM v_branch_summary;`

## 9. API reference
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | DB connectivity |
| GET | `/api/accounts`, `/api/accounts/:id` | accounts with customer and branch |
| GET | `/api/users` | customers |
| POST | `/api/users` | onboard customer + account |
| POST | `/api/deposit` `{account, amount, initiated_by}` | deposit |
| POST | `/api/withdraw` `{account, amount, initiated_by}` | withdraw |
| POST | `/api/transfer` `{from_account, to_account, amount, initiated_by}` | transfer |
| GET | `/api/transactions`, `/api/audit-logs`, `/api/stats` | history, audit, dashboard numbers |

## 10. Design notes
* **`@app_actor` fix**: inside a trigger `CURRENT_USER()` is the trigger's definer, so procedures set `@app_actor` and the trigger logs `COALESCE(@app_actor, CURRENT_USER())`, which keeps the audit trail attributed correctly.
* **Deadlock-safe transfer**: both rows are locked in one statement, so opposite transfers can't lock each other.
* **Parameterised queries** everywhere (no SQL injection); the frontend escapes all output (no XSS).

## 11. Known limitations / next steps
No login: `initiated_by` is client-supplied (add JWT auth + roles); no HTTPS; polling instead of WebSockets; no interest, loans or cards yet. Good extensions: loans with EMI schedules, scheduled interest via `EVENT`, JWT login, Docker Compose, automated tests.
