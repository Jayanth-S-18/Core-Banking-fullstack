# Aurelia Bank — Core Banking Fullstack Demo

A modern full-stack banking dashboard built with Node.js, Express, MariaDB, and plain HTML/CSS/JavaScript. This project simulates a real banking operations workspace with customer onboarding, account overview, secure data masking, money transfers, and audit tracking.

## Overview

This app is designed to feel like a real bank admin dashboard for a small digital banking environment. It includes:

- customer management and onboarding
- secure masked personal details
- account and balance monitoring
- internal transfer processing
- audit log tracking for transfer activity
- polished dark banking-style dashboard UI

## Tech Stack

- Backend: Node.js + Express
- Database: MariaDB / MySQL
- Query layer: mysql2
- Frontend: HTML, CSS, JavaScript
- Business logic: SQL stored procedures and triggers

## Project Structure

```text
Core-Banking-fullstack/
├── backend/
│   ├── db.js
│   ├── package.json
│   ├── server.js
│   └── routes/
│       ├── accounts.js
│       ├── audit.js
│       ├── transfer.js
│       └── users.js
├── frontend/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── sql/
│   ├── 01_schema.sql
│   ├── 02_triggers.sql
│   ├── 03_transfer_procedure.sql
│   └── 04_demo.sql
├── README.md
└── .gitignore
```

## Features

### Banking dashboard
- overview cards for total balances, active accounts, customer counts
- responsiveness for desktop and smaller screens
- premium fintech style dark theme

### Customer management
- add new customers
- search customers by name or key terms
- view customer detail cards
- mask sensitive information such as phone, email, national ID, and address

### Transfers
- transfer funds between accounts
- validation handled in SQL stored procedure
- ledger-like updates and audit trail creation

### Audit logging
- database triggers record money movement and updates
- recent activity can be displayed in the dashboard

## Database Setup

### Option 1: using Docker (recommended)

```bash
cd /workspaces/Core-Banking-fullstack

docker run --name corebank-db \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -e MYSQL_DATABASE=core_banking \
  -p 3306:3306 \
  -d mariadb:11

docker cp ./sql corebank-db:/tmp/

docker exec -i corebank-db bash -lc "mariadb -uroot -prootpass < /tmp/sql/01_schema.sql"
docker exec -i corebank-db bash -lc "mariadb -uroot -prootpass < /tmp/sql/02_triggers.sql"
docker exec -i corebank-db bash -lc "mariadb -uroot -prootpass < /tmp/sql/03_transfer_procedure.sql"
docker exec -i corebank-db bash -lc "mariadb -uroot -prootpass < /tmp/sql/04_demo.sql"
```

### Option 2: local MariaDB/MySQL

Run the SQL files in order:

```bash
mysql -u root -p < sql/01_schema.sql
mysql -u root -p < sql/02_triggers.sql
mysql -u root -p < sql/03_transfer_procedure.sql
mysql -u root -p < sql/04_demo.sql
```

## Backend Setup

Create a `.env` file inside the `backend` folder:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=rootpass
DB_NAME=core_banking
PORT=4000
```

Then run:

```bash
cd /workspaces/Core-Banking-fullstack/backend
npm install
npm start
```

You should see:

```text
Core banking API + dashboard running at http://localhost:4000
```

## Open the App

Open this in your browser:

```text
http://localhost:4000
```

## API Endpoints

### Health
- `GET /api/health`

### Accounts
- `GET /api/accounts`

### Users
- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`

### Transfers
- `POST /api/transfer`

### Audit logs
- `GET /api/audit-logs`

## Security Notes

This project intentionally masks sensitive customer data such as:
- email
- phone number
- national ID
- address fragments

This makes the demo safer and more realistic for an operations or admin dashboard without exposing full personal details in the UI.

## Important Design Note

The money-transfer logic is enforced in the database via SQL stored procedures rather than only in JavaScript. This mirrors real banking systems better because deposits, withdrawals, and validation happen in a single trusted place, ensuring consistent logic and stronger transactional safety.

## Future Improvements

Possible upgrades for production-like readiness:
- secure login and admin authentication
- account creation and closure workflows
- role-based access control
- customer edit/delete features
- stronger reporting and analytics
- HTTPS and production deployment setup

## License

This project is intended for educational and demo use.
