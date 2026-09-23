const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/audit-logs?table_name=Accounts&record_id=1&limit=50
router.get('/', async (req, res) => {
  try {
    const { table_name, record_id, limit } = req.query;
    let sql = 'SELECT * FROM Audit_Logs WHERE 1=1';
    const params = [];

    if (table_name) {
      sql += ' AND table_name = ?';
      params.push(table_name);
    }
    if (record_id) {
      sql += ' AND record_id = ?';
      params.push(record_id);
    }
    sql += ' ORDER BY audit_id DESC LIMIT ?';
    params.push(Number(limit) || 50);

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
