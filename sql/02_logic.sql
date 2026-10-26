-- Triggers, stored procedures, views
USE core_banking;
DELIMITER $$

-- Every balance change is audited automatically. @app_actor is set by the procedures
-- below because CURRENT_USER() inside a trigger returns the trigger's definer.
CREATE TRIGGER trg_audit_balance AFTER UPDATE ON Accounts
FOR EACH ROW
BEGIN
  IF OLD.balance <> NEW.balance THEN
    INSERT INTO Audit_Logs(account_id, old_balance, new_balance, changed_by)
    VALUES (NEW.account_id, OLD.balance, NEW.balance, COALESCE(@app_actor, CURRENT_USER()));
  END IF;
END$$

-- Atomic transfer (ACID). Both rows are locked in ONE statement (index order),
-- so two opposite transfers cannot deadlock each other.
CREATE PROCEDURE sp_transfer_funds(IN p_from INT, IN p_to INT, IN p_amount DECIMAL(15,2),
                                   IN p_by VARCHAR(100), OUT p_msg VARCHAR(255))
proc: BEGIN
  DECLARE v_bal DECIMAL(15,2); DECLARE v_cnt INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN ROLLBACK; SET p_msg = 'Rejected: database error, transaction rolled back'; END;
  SET @app_actor = p_by;
  IF p_amount IS NULL OR p_amount <= 0 THEN SET p_msg='Rejected: amount must be greater than zero'; LEAVE proc; END IF;
  IF p_from = p_to THEN SET p_msg='Rejected: cannot transfer to the same account'; LEAVE proc; END IF;
  START TRANSACTION;
  SELECT COUNT(*) INTO v_cnt FROM Accounts
   WHERE account_id IN (p_from, p_to) AND status='ACTIVE' FOR UPDATE;
  IF v_cnt < 2 THEN ROLLBACK; SET p_msg='Rejected: account not found or FROZEN'; LEAVE proc; END IF;
  SELECT balance INTO v_bal FROM Accounts WHERE account_id = p_from;
  IF v_bal < p_amount THEN
    ROLLBACK;
    INSERT INTO Transactions(from_account,to_account,amount,txn_type,status,note,initiated_by)
    VALUES (p_from,p_to,p_amount,'TRANSFER','FAILED','Insufficient funds',p_by);
    SET p_msg='Rejected: insufficient funds'; LEAVE proc;
  END IF;
  UPDATE Accounts SET balance = balance - p_amount WHERE account_id = p_from;
  UPDATE Accounts SET balance = balance + p_amount WHERE account_id = p_to;
  INSERT INTO Transactions(from_account,to_account,amount,txn_type,status,note,initiated_by)
  VALUES (p_from,p_to,p_amount,'TRANSFER','SUCCESS','Fund transfer',p_by);
  COMMIT;
  SET p_msg = CONCAT('Success: transferred ', FORMAT(p_amount,2), ' successfully');
END$$

CREATE PROCEDURE sp_deposit(IN p_acc INT, IN p_amount DECIMAL(15,2), IN p_by VARCHAR(100), OUT p_msg VARCHAR(255))
proc: BEGIN
  DECLARE v_cnt INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; SET p_msg='Rejected: database error, rolled back'; END;
  SET @app_actor = p_by;
  IF p_amount IS NULL OR p_amount <= 0 THEN SET p_msg='Rejected: amount must be greater than zero'; LEAVE proc; END IF;
  START TRANSACTION;
  SELECT COUNT(*) INTO v_cnt FROM Accounts WHERE account_id=p_acc AND status='ACTIVE' FOR UPDATE;
  IF v_cnt = 0 THEN ROLLBACK; SET p_msg='Rejected: account not found or FROZEN'; LEAVE proc; END IF;
  UPDATE Accounts SET balance = balance + p_amount WHERE account_id = p_acc;
  INSERT INTO Transactions(to_account,amount,txn_type,status,note,initiated_by)
  VALUES (p_acc,p_amount,'DEPOSIT','SUCCESS','Cash deposit',p_by);
  COMMIT;
  SET p_msg = CONCAT('Success: deposited ', FORMAT(p_amount,2));
END$$

CREATE PROCEDURE sp_withdraw(IN p_acc INT, IN p_amount DECIMAL(15,2), IN p_by VARCHAR(100), OUT p_msg VARCHAR(255))
proc: BEGIN
  DECLARE v_bal DECIMAL(15,2);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; SET p_msg='Rejected: database error, rolled back'; END;
  SET @app_actor = p_by;
  IF p_amount IS NULL OR p_amount <= 0 THEN SET p_msg='Rejected: amount must be greater than zero'; LEAVE proc; END IF;
  START TRANSACTION;
  SELECT balance INTO v_bal FROM Accounts WHERE account_id=p_acc AND status='ACTIVE' FOR UPDATE;
  IF v_bal IS NULL THEN ROLLBACK; SET p_msg='Rejected: account not found or FROZEN'; LEAVE proc; END IF;
  IF v_bal < p_amount THEN
    ROLLBACK;
    INSERT INTO Transactions(from_account,amount,txn_type,status,note,initiated_by)
    VALUES (p_acc,p_amount,'WITHDRAWAL','FAILED','Insufficient funds',p_by);
    SET p_msg='Rejected: insufficient funds'; LEAVE proc;
  END IF;
  UPDATE Accounts SET balance = balance - p_amount WHERE account_id = p_acc;
  INSERT INTO Transactions(from_account,amount,txn_type,status,note,initiated_by)
  VALUES (p_acc,p_amount,'WITHDRAWAL','SUCCESS','Cash withdrawal',p_by);
  COMMIT;
  SET p_msg = CONCAT('Success: withdrew ', FORMAT(p_amount,2));
END$$
DELIMITER ;

-- Views: joins written once, reused by the API
CREATE VIEW v_account_overview AS
SELECT a.account_id, a.account_no, a.type, a.balance, a.status, a.opened_on,
       u.user_id, u.full_name, u.email, u.phone, u.address, u.dob, u.pan, u.kyc_status,
       b.branch_id, b.name AS branch_name, b.ifsc, b.city
FROM Accounts a JOIN Users u USING (user_id) JOIN Branches b USING (branch_id);

CREATE VIEW v_branch_summary AS
SELECT b.branch_id, b.name, b.city, COUNT(a.account_id) AS accounts,
       COALESCE(SUM(a.balance),0) AS total_balance,
       RANK() OVER (ORDER BY COALESCE(SUM(a.balance),0) DESC) AS balance_rank   -- window function
FROM Branches b LEFT JOIN Accounts a USING (branch_id) GROUP BY b.branch_id, b.name, b.city;
