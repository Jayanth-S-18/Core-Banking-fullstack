require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');

const accountsRouter = require('./routes/accounts');
const transferRouter = require('./routes/transfer');
const auditRouter = require('./routes/audit');
const usersRouter = require('./routes/users');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/accounts', accountsRouter);
app.use('/api/transfer', transferRouter);
app.use('/api/audit-logs', auditRouter);
app.use('/api/users', usersRouter);

// Health check - also confirms the DB pool can actually reach MySQL/MariaDB
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: err.message });
  }
});

// Serve the static dashboard (frontend/index.html, styles.css, app.js)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Core banking API + dashboard running at http://localhost:${PORT}`);
});
