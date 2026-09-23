-- ============================================================
--  File: 04_demo.sql
--  Purpose: Seed sample data and demonstrate the whole system:
--           successful transfer, audit trail, and a failed
--           transfer that rolls back cleanly (no partial update).
--  Run this AFTER 01_schema.sql, 02_triggers.sql, 03_transfer_procedure.sql
-- ============================================================
USE core_banking;

-- ---------------- Seed data ----------------
INSERT INTO Branches (branch_name, branch_code, city, swift_code) VALUES
('Vellore Main Branch', 'BR001', 'Vellore', 'CBSIINBB001'),
('Chennai Central',     'BR002', 'Chennai', 'CBSIINBB002');

INSERT INTO Users (full_name, date_of_birth, national_id, email, phone, address, kyc_status) VALUES
('Asha Rao',     '1994-03-12', 'NID-10001', 'asha.rao@example.com',     '9876500001', '12 MG Road, Vellore',   'VERIFIED'),
('Vikram Nair',  '1988-07-25', 'NID-10002', 'vikram.nair@example.com',  '9876500002', '45 Anna Salai, Chennai','VERIFIED');

INSERT INTO Accounts (user_id, branch_id, account_number, account_type, balance, currency, interest_rate, status) VALUES
(1, 1, 'ACC-SAV-0001', 'SAVINGS',  5000.00, 'USD', 3.50, 'ACTIVE'),
(2, 2, 'ACC-CHK-0002', 'CHECKING',  800.00, 'USD', NULL, 'ACTIVE');

-- ---------------- Case 1: Successful transfer ----------------
-- $500 from Asha's savings (account 1) to Vikram's checking (account 2)
SET @result = '';
CALL sp_transfer_funds(1, 2, 500.00, 'TXN-REF-0001', 'teller_priya', @result);
SELECT @result AS transfer_1_result;

SELECT account_id, account_number, balance, status FROM Accounts;
SELECT * FROM Transactions;
SELECT audit_id, table_name, record_id, column_name, old_value, new_value, changed_by, changed_at
  FROM Audit_Logs ORDER BY audit_id;

-- ---------------- Case 2: Failed transfer (insufficient funds) ----------------
-- Account 2 only has 1300.00 now; attempt to send 999999 should fail
-- and roll back completely, leaving balances untouched.
SET @result2 = '';
CALL sp_transfer_funds(2, 1, 999999.00, 'TXN-REF-0002', 'teller_priya', @result2);
SELECT @result2 AS transfer_2_result;

-- Balances should be UNCHANGED from after Case 1 -> proves atomicity/rollback
SELECT account_id, account_number, balance, status FROM Accounts;
SELECT * FROM Transactions;   -- second row logged with status = 'FAILED', no balance change

-- ---------------- Case 3: KYC info update -> audit trail on Users ----------------
UPDATE Users SET phone = '9876500099', kyc_status = 'VERIFIED' WHERE user_id = 1;

SELECT * FROM Audit_Logs WHERE table_name = 'Users' ORDER BY audit_id;

-- ---------------- Case 4: Direct balance edit still gets audited ----------------
-- (e.g. a manual correction by an ops user, outside the transfer procedure)
UPDATE Accounts SET balance = balance + 25.00 WHERE account_id = 1;  -- interest credit

SELECT * FROM Audit_Logs WHERE table_name = 'Accounts' ORDER BY audit_id;

-- ---------------- Case 5: BEFORE UPDATE trigger blocks illegal state ----------------
-- This should fail with the custom error from trg_accounts_before_update
-- (uncomment to test in your client - expect SQLSTATE 45000)
-- UPDATE Accounts SET balance = -100 WHERE account_id = 1;
