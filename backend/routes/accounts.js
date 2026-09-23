const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/accounts - every account, with owner name and branch, for the dashboard table
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.account_id, a.account_number, a.account_type, a.balance, a.currency,
             a.status, a.interest_rate, u.user_id, u.full_name, u.kyc_status,
             b.branch_name
      FROM Accounts a
      JOIN Users u ON u.user_id = a.user_id
      JOIN Branches b ON b.branch_id = a.branch_id
      ORDER BY a.account_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/accounts/:id - one account plus its last 50 transactions
router.get('/:id', async (req, res) => {
  try {
    const [[account]] = await pool.query(
      `SELECT a.*, u.full_name, u.kyc_status
       FROM Accounts a JOIN Users u ON u.user_id = a.user_id
       WHERE a.account_id = ?`,
      [req.params.id]
    );
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const [transactions] = await pool.query(
      `SELECT * FROM Transactions
       WHERE from_account_id = ? OR to_account_id = ?
       ORDER BY created_at DESC LIMIT 50`,
      [req.params.id, req.params.id]
    );

    res.json({ account, transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
