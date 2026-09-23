-- ============================================================
--  File: 02_triggers.sql
--  Purpose: BEFORE UPDATE (validation) + AFTER UPDATE (audit) triggers
--           on Accounts, plus an audit trigger on Users (KYC data).
-- ============================================================
USE core_banking;

-- ------------------------------------------------------------
-- IMPORTANT: a MySQL/MariaDB trigger always executes with the identity of
-- whoever DEFINED the trigger, not whoever fired the UPDATE that invoked it.
-- CURRENT_USER() inside a trigger body reflects the trigger's DEFINER,
-- always - this is documented engine behaviour, not a bug, but it means a
-- naive audit trigger would tag every row with the same name regardless of
-- which application user actually made the change.
--
-- The fix: the application sets a session variable, @app_actor, right
-- before it issues a write (sp_transfer_funds does this automatically from
-- its p_initiated_by parameter). The triggers below read @app_actor first
-- and only fall back to CURRENT_USER() if nothing set it - e.g. a DBA
-- running a raw UPDATE directly in a SQL client, where CURRENT_USER() genuinely
-- is the right and only available answer.
-- ------------------------------------------------------------

DELIMITER $$

-- ------------------------------------------------------------
-- 1) BEFORE UPDATE on Accounts: guard against invalid balances
--    (belt-and-braces alongside the CHECK constraint; also blocks
--     closed accounts from being altered).
-- ------------------------------------------------------------
CREATE TRIGGER trg_accounts_before_update
BEFORE UPDATE ON Accounts
FOR EACH ROW
BEGIN
    IF NEW.balance < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Rejected: account balance cannot go negative';
    END IF;

    IF OLD.status = 'CLOSED' AND NEW.status = 'CLOSED' AND NEW.balance <> OLD.balance THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Rejected: cannot modify balance on a closed account';
    END IF;
END$$

-- ------------------------------------------------------------
-- 2) AFTER UPDATE on Accounts: write one Audit_Logs row per
--    changed column (balance, status, interest_rate, account_type).
--    CURRENT_USER() captures the active DB user/role performing it.
-- ------------------------------------------------------------
CREATE TRIGGER trg_accounts_after_update
AFTER UPDATE ON Accounts
FOR EACH ROW
BEGIN
    IF NOT (OLD.balance <=> NEW.balance) THEN
        INSERT INTO Audit_Logs (table_name, record_id, operation, column_name, old_value, new_value, changed_by)
        VALUES ('Accounts', NEW.account_id, 'UPDATE', 'balance', OLD.balance, NEW.balance, COALESCE(@app_actor, CURRENT_USER()));
    END IF;

    IF NOT (OLD.status <=> NEW.status) THEN
        INSERT INTO Audit_Logs (table_name, record_id, operation, column_name, old_value, new_value, changed_by)
        VALUES ('Accounts', NEW.account_id, 'UPDATE', 'status', OLD.status, NEW.status, COALESCE(@app_actor, CURRENT_USER()));
    END IF;

    IF NOT (OLD.interest_rate <=> NEW.interest_rate) THEN
        INSERT INTO Audit_Logs (table_name, record_id, operation, column_name, old_value, new_value, changed_by)
        VALUES ('Accounts', NEW.account_id, 'UPDATE', 'interest_rate', OLD.interest_rate, NEW.interest_rate, COALESCE(@app_actor, CURRENT_USER()));
    END IF;

    IF NOT (OLD.account_type <=> NEW.account_type) THEN
        INSERT INTO Audit_Logs (table_name, record_id, operation, column_name, old_value, new_value, changed_by)
        VALUES ('Accounts', NEW.account_id, 'UPDATE', 'account_type', OLD.account_type, NEW.account_type, COALESCE(@app_actor, CURRENT_USER()));
    END IF;
END$$

-- ------------------------------------------------------------
-- 3) AFTER UPDATE on Users: audit changes to KYC-relevant fields
-- ------------------------------------------------------------
CREATE TRIGGER trg_users_after_update
AFTER UPDATE ON Users
FOR EACH ROW
BEGIN
    IF NOT (OLD.full_name <=> NEW.full_name) THEN
        INSERT INTO Audit_Logs (table_name, record_id, operation, column_name, old_value, new_value, changed_by)
        VALUES ('Users', NEW.user_id, 'UPDATE', 'full_name', OLD.full_name, NEW.full_name, COALESCE(@app_actor, CURRENT_USER()));
    END IF;

    IF NOT (OLD.email <=> NEW.email) THEN
        INSERT INTO Audit_Logs (table_name, record_id, operation, column_name, old_value, new_value, changed_by)
        VALUES ('Users', NEW.user_id, 'UPDATE', 'email', OLD.email, NEW.email, COALESCE(@app_actor, CURRENT_USER()));
    END IF;

    IF NOT (OLD.phone <=> NEW.phone) THEN
        INSERT INTO Audit_Logs (table_name, record_id, operation, column_name, old_value, new_value, changed_by)
        VALUES ('Users', NEW.user_id, 'UPDATE', 'phone', OLD.phone, NEW.phone, COALESCE(@app_actor, CURRENT_USER()));
    END IF;

    IF NOT (OLD.address <=> NEW.address) THEN
        INSERT INTO Audit_Logs (table_name, record_id, operation, column_name, old_value, new_value, changed_by)
        VALUES ('Users', NEW.user_id, 'UPDATE', 'address', OLD.address, NEW.address, COALESCE(@app_actor, CURRENT_USER()));
    END IF;

    IF NOT (OLD.kyc_status <=> NEW.kyc_status) THEN
        INSERT INTO Audit_Logs (table_name, record_id, operation, column_name, old_value, new_value, changed_by)
        VALUES ('Users', NEW.user_id, 'UPDATE', 'kyc_status', OLD.kyc_status, NEW.kyc_status, COALESCE(@app_actor, CURRENT_USER()));
    END IF;
END$$

DELIMITER ;
