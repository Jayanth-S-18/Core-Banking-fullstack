const path = require('path');
const express = require('express');
const pool = require('./db');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const wrap = fn => (req, res) => fn(req, res).catch(e => {
  console.error(e); res.status(500).json({ ok: false, message: 'Server error: ' + (e.code || e.message) });
});

// Run a stored procedure with one OUT message parameter (@m) on a single connection
async function callProc(sql, params) {
  const c = await pool.getConnection();
  try { await c.query(sql, params); const [[r]] = await c.query('SELECT @m AS msg'); return r.msg; }
  finally { c.release(); }
}
const num = v => Number(v);
const actor = v => String(v || 'Web-Dashboard').slice(0, 100);
const reply = (res, msg) => res.status(msg.startsWith('Success') ? 200 : 400).json({ ok: msg.startsWith('Success'), message: msg });

app.get('/api/health', wrap(async (_q, res) => {
  await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' });
}));

app.get('/api/accounts', wrap(async (_q, res) => {
  const [rows] = await pool.query('SELECT * FROM v_account_overview ORDER BY account_id'); res.json(rows);
}));
app.get('/api/accounts/:id', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM v_account_overview WHERE account_id=?', [req.params.id]);
  rows.length ? res.json(rows[0]) : res.status(404).json({ ok: false, message: 'Account not found' });
}));

app.get('/api/stats', wrap(async (_q, res) => {
  const [[t]] = await pool.query(`SELECT
    (SELECT COUNT(*) FROM Users) users, (SELECT COUNT(*) FROM Accounts) accounts,
    (SELECT COALESCE(SUM(balance),0) FROM Accounts) total, (SELECT COUNT(*) FROM Transactions) txns,
    (SELECT COUNT(*) FROM Transactions WHERE status='FAILED') failed`);
  const [branches] = await pool.query('SELECT * FROM v_branch_summary ORDER BY balance_rank');
  res.json({ ...t, branches });
}));

app.get('/api/users', wrap(async (_q, res) => {
  const [rows] = await pool.query('SELECT * FROM Users ORDER BY user_id'); res.json(rows);
}));

// Onboard a customer + first account inside ONE database transaction
app.post('/api/users', wrap(async (req, res) => {
  const { full_name, email, phone, branch_id, type, opening_deposit } = req.body;
  if (!full_name || !email || !phone || !branch_id)
    return res.status(400).json({ ok: false, message: 'Rejected: name, email, phone and branch are required' });
  const dep = Math.max(0, num(opening_deposit) || 0);
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [u] = await c.query('INSERT INTO Users(full_name,email,phone) VALUES (?,?,?)', [full_name, email, phone]);
    const no = 'CB' + String(Date.now()).slice(-7);
    const [a] = await c.query('INSERT INTO Accounts(account_no,user_id,branch_id,type,balance) VALUES (?,?,?,?,?)',
      [no, u.insertId, branch_id, ['SAVINGS', 'CURRENT', 'SALARY'].includes(type) ? type : 'SAVINGS', dep]);
    if (dep > 0) await c.query("INSERT INTO Transactions(to_account,amount,txn_type,status,note,initiated_by) VALUES (?,?,'DEPOSIT','SUCCESS','Opening deposit','Web-Dashboard')", [a.insertId, dep]);
    await c.commit();
    res.json({ ok: true, message: `Success: ${full_name} onboarded, account ${no} opened` });
  } catch (e) {
    await c.rollback();
    res.status(400).json({ ok: false, message: e.code === 'ER_DUP_ENTRY' ? 'Rejected: email already registered' : 'Rejected: ' + e.code });
  } finally { c.release(); }
}));

app.post('/api/transfer', wrap(async (req, res) => {
  const { from_account, to_account, amount, initiated_by } = req.body;
  reply(res, await callProc('CALL sp_transfer_funds(?,?,?,?,@m)', [num(from_account), num(to_account), num(amount), actor(initiated_by)]));
}));
app.post('/api/deposit', wrap(async (req, res) => {
  const { account, amount, initiated_by } = req.body;
  reply(res, await callProc('CALL sp_deposit(?,?,?,@m)', [num(account), num(amount), actor(initiated_by)]));
}));
app.post('/api/withdraw', wrap(async (req, res) => {
  const { account, amount, initiated_by } = req.body;
  reply(res, await callProc('CALL sp_withdraw(?,?,?,@m)', [num(account), num(amount), actor(initiated_by)]));
}));

app.get('/api/transactions', wrap(async (_q, res) => {
  const [rows] = await pool.query(`SELECT t.*, f.account_no AS from_no, o.account_no AS to_no
    FROM Transactions t LEFT JOIN Accounts f ON f.account_id=t.from_account
    LEFT JOIN Accounts o ON o.account_id=t.to_account ORDER BY t.txn_id DESC LIMIT 50`);
  res.json(rows);
}));
app.get('/api/audit-logs', wrap(async (_q, res) => {
  const [rows] = await pool.query(`SELECT l.*, a.account_no FROM Audit_Logs l
    JOIN Accounts a USING (account_id) ORDER BY l.log_id DESC LIMIT 50`);
  res.json(rows);
}));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Core banking API + dashboard running at http://localhost:${PORT}`));
