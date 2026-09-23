const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST /api/transfer
// Body: { from_account_id, to_account_id, amount, reference_no, initiated_by }
// Delegates entirely to sp_transfer_funds - the API layer does no balance
// math or locking itself, the database's ACID transaction does all of that.
router.post('/', async (req, res) => {
  const { from_account_id, to_account_id, amount, reference_no, initiated_by } = req.body;

  if (!from_account_id || !to_account_id || !amount || !reference_no || !initiated_by) {
    return res.status(400).json({
      error: 'from_account_id, to_account_id, amount, reference_no, and initiated_by are all required',
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.query('CALL sp_transfer_funds(?, ?, ?, ?, ?, @result)', [
      from_account_id,
      to_account_id,
      amount,
      reference_no,
      initiated_by,
    ]);
    const [[{ result }]] = await conn.query('SELECT @result AS result');

    const succeeded = typeof result === 'string' && result.toLowerCase().startsWith('success');
    res.status(succeeded ? 200 : 422).json({ result });
  } catch (err) {
    // Duplicate reference_no, FK violation, etc. surface here
    res.status(500).json({ error: err.sqlMessage || err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
