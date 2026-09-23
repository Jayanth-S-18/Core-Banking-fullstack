const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/users - customer list for the dashboard's account-owner dropdowns
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, full_name, email, phone, kyc_status, created_at FROM Users ORDER BY user_id'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users - onboard a new customer (KYC record). Triggers on UPDATE
// only, so this INSERT is not itself audited - that's by design, since
// Audit_Logs exists to show what *changed* about an existing record.
router.post('/', async (req, res) => {
  const { full_name, date_of_birth, national_id, email, phone, address } = req.body;
  if (!full_name || !date_of_birth || !national_id || !email) {
    return res.status(400).json({ error: 'full_name, date_of_birth, national_id, and email are required' });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO Users (full_name, date_of_birth, national_id, email, phone, address, kyc_status)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [full_name, date_of_birth, national_id, email, phone || null, address || null]
    );
    res.status(201).json({ user_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.sqlMessage || err.message });
  }
});

module.exports = router;
