const express = require('express');
const router = express.Router();
const pool = require('../db');

const maskEmail = (email = '') => {
  if (!email) return '—';
  const [local, domain] = String(email).split('@');
  if (!domain) return `${email.slice(0, 2)}***`;
  return `${local.slice(0, 2)}***@${domain}`;
};

const maskPhone = (phone = '') => {
  if (!phone) return '—';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  const visible = digits.slice(-4);
  return `*** *** ${visible}`;
};

const maskNationalId = (nationalId = '') => {
  if (!nationalId) return '—';
  const value = String(nationalId);
  return value.length > 4 ? `${value.slice(0, 2)}******${value.slice(-2)}` : `${value.slice(0, 1)}***`;
};

const maskUser = (row) => ({
  ...row,
  email: maskEmail(row.email),
  phone: maskPhone(row.phone),
  national_id: maskNationalId(row.national_id),
  address: row.address ? `${row.address.slice(0, 2)}***` : '—',
});

// GET /api/users - customer directory for bank staff. Personal data is masked for safer display.
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `
      SELECT user_id, full_name, email, phone, national_id, address, kyc_status, created_at
      FROM Users
    `;
    const params = [];

    if (search) {
      sql += ' WHERE full_name LIKE ? OR email LIKE ? OR national_id LIKE ?';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY user_id';

    const [rows] = await pool.query(sql, params);
    res.json(rows.map(maskUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id - retrieve one customer profile with masked PII for safer access.
router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT user_id, full_name, date_of_birth, national_id, email, phone, address, kyc_status, created_at
       FROM Users WHERE user_id = ?`,
      [req.params.id]
    );

    if (!row) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(maskUser(row));
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
