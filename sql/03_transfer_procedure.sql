-- ============================================================
--  File: 03_transfer_procedure.sql
--  Purpose: A single ACID transaction block for money transfers,
--           wrapped in a stored procedure with proper error handling,
--           row locking (to stop race conditions) and deadlock-safe
--           lock ordering (always lock the lower account_id first).
-- ============================================================
USE core_banking;

DELIMITER $$

-- SQL SECURITY INVOKER matters here, not just as a formality: by default a
-- MySQL/MariaDB procedure runs as SQL SECURITY DEFINER, which means
-- CURRENT_USER() inside the audit triggers fired by this procedure's
-- UPDATEs would report the *definer* (whoever ran this CREATE PROCEDURE
-- statement) instead of the account that actually called the procedure.
-- For an audit trail that's the difference between "who really did this"
-- and a name that's wrong on every single row. INVOKER fixes that.
CREATE PROCEDURE sp_transfer_funds (
    IN  p_from_account   INT,
    IN  p_to_account     INT,
    IN  p_amount         DECIMAL(18,2),
    IN  p_reference_no   VARCHAR(50),
    IN  p_initiated_by   VARCHAR(100),
    OUT p_result         VARCHAR(200)
)
    SQL SECURITY INVOKER
proc_body: BEGIN
    DECLARE v_from_balance DECIMAL(18,2);
    DECLARE v_from_status  VARCHAR(20);
    DECLARE v_to_status    VARCHAR(20);
    DECLARE v_first        INT;
    DECLARE v_second       INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        GET DIAGNOSTICS CONDITION 1 p_result = MESSAGE_TEXT;
        INSERT INTO Transactions (from_account_id, to_account_id, amount, reference_no,
                                   transaction_type, status, initiated_by)
        VALUES (p_from_account, p_to_account, p_amount, p_reference_no,
                'TRANSFER', 'FAILED', p_initiated_by)
        ON DUPLICATE KEY UPDATE status = 'FAILED';
        SET @app_actor = NULL;  -- don't leak onto later statements on a reused pooled connection
    END;

    -- Tell the Accounts audit trigger who is *really* making this change -
    -- see the note at the top of 02_triggers.sql for why CURRENT_USER()
    -- alone can't answer that inside a trigger.
    SET @app_actor = p_initiated_by;

    IF p_amount <= 0 THEN
        SET p_result = 'Rejected: transfer amount must be positive';
        LEAVE proc_body;
    END IF;

    IF p_from_account = p_to_account THEN
        SET p_result = 'Rejected: source and destination accounts must differ';
        LEAVE proc_body;
    END IF;

    -- Lock rows in a fixed order (smaller account_id first) to avoid deadlocks
    -- when two transfers happen concurrently in opposite directions.
    SET v_first  = LEAST(p_from_account, p_to_account);
    SET v_second = GREATEST(p_from_account, p_to_account);

    START TRANSACTION;

        PERFORM_LOCK: BEGIN
            DECLARE dummy INT;
            SELECT account_id INTO dummy FROM Accounts WHERE account_id = v_first  FOR UPDATE;
            SELECT account_id INTO dummy FROM Accounts WHERE account_id = v_second FOR UPDATE;
        END PERFORM_LOCK;

        SELECT balance, status INTO v_from_balance, v_from_status
          FROM Accounts WHERE account_id = p_from_account;

        SELECT status INTO v_to_status
          FROM Accounts WHERE account_id = p_to_account;

        IF v_from_status <> 'ACTIVE' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rejected: source account is not active';
        END IF;

        IF v_to_status <> 'ACTIVE' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rejected: destination account is not active';
        END IF;

        IF v_from_balance < p_amount THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rejected: insufficient funds';
        END IF;

        UPDATE Accounts SET balance = balance - p_amount WHERE account_id = p_from_account;
        UPDATE Accounts SET balance = balance + p_amount WHERE account_id = p_to_account;

        INSERT INTO Transactions (from_account_id, to_account_id, amount, reference_no,
                                   transaction_type, status, initiated_by)
        VALUES (p_from_account, p_to_account, p_amount, p_reference_no,
                'TRANSFER', 'COMPLETED', p_initiated_by);

    COMMIT;

    SET @app_actor = NULL;  -- reset immediately so it never bleeds into unrelated later writes
    SET p_result = 'Success: transfer completed';
END$$

DELIMITER ;

-- ------------------------------------------------------------
-- NOTE on the ACID guarantees this procedure gives you:
--   Atomicity   - both balance UPDATEs and the Transactions INSERT
--                 either all commit or all roll back (EXIT HANDLER).
--   Consistency - CHECK constraints + BEFORE UPDATE trigger stop the
--                 balance from ever landing in an illegal state.
--   Isolation   - SELECT ... FOR UPDATE takes row locks in a fixed
--                 order so concurrent transfers can't read a stale
--                 balance or deadlock each other.
--   Durability  - InnoDB + COMMIT makes the change survive a crash.
-- ------------------------------------------------------------
