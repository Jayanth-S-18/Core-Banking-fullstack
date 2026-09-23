-- ============================================================
--  CORE BANKING SYSTEM WITH AUDIT TRAILS
--  File: 01_schema.sql
--  Engine: MySQL 8.0+ / MariaDB 10.5+  (InnoDB required for FKs + transactions)
-- ============================================================

DROP DATABASE IF EXISTS core_banking;
CREATE DATABASE core_banking CHARACTER SET utf8mb4;
USE core_banking;

-- ------------------------------------------------------------
-- 1. BRANCHES
-- ------------------------------------------------------------
CREATE TABLE Branches (
    branch_id     INT AUTO_INCREMENT PRIMARY KEY,
    branch_name   VARCHAR(100) NOT NULL,
    branch_code   VARCHAR(20)  NOT NULL UNIQUE,
    city          VARCHAR(100),
    swift_code    VARCHAR(20)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. USERS  (KYC information)
-- ------------------------------------------------------------
CREATE TABLE Users (
    user_id        INT AUTO_INCREMENT PRIMARY KEY,
    full_name      VARCHAR(150) NOT NULL,
    date_of_birth  DATE NOT NULL,
    national_id    VARCHAR(50)  NOT NULL UNIQUE,   -- SSN / national ID / passport
    email          VARCHAR(150) NOT NULL UNIQUE,
    phone          VARCHAR(20),
    address        VARCHAR(255),
    kyc_status     ENUM('PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'PENDING',
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 3. ACCOUNTS  (Savings / Checking / Loan)
-- ------------------------------------------------------------
CREATE TABLE Accounts (
    account_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    branch_id       INT NOT NULL,
    account_number  VARCHAR(30) NOT NULL UNIQUE,
    account_type    ENUM('SAVINGS','CHECKING','LOAN') NOT NULL,
    balance         DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    currency        CHAR(3) NOT NULL DEFAULT 'USD',
    interest_rate   DECIMAL(5,2) DEFAULT NULL,      -- applies to SAVINGS / LOAN
    status          ENUM('ACTIVE','FROZEN','CLOSED') NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_accounts_user   FOREIGN KEY (user_id)   REFERENCES Users(user_id),
    CONSTRAINT fk_accounts_branch FOREIGN KEY (branch_id) REFERENCES Branches(branch_id),
    CONSTRAINT chk_balance_nonneg CHECK (balance >= 0)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4. TRANSACTIONS  (transfers, deposits, withdrawals, loan activity)
-- ------------------------------------------------------------
CREATE TABLE Transactions (
    transaction_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    from_account_id   INT NULL,     -- NULL for external deposits
    to_account_id     INT NULL,     -- NULL for external withdrawals
    amount            DECIMAL(18,2) NOT NULL,
    currency          CHAR(3) NOT NULL DEFAULT 'USD',
    reference_no      VARCHAR(50) NOT NULL UNIQUE,
    transaction_type  ENUM('TRANSFER','DEPOSIT','WITHDRAWAL','LOAN_DISBURSEMENT','LOAN_REPAYMENT') NOT NULL,
    status            ENUM('PENDING','COMPLETED','FAILED','REVERSED') NOT NULL DEFAULT 'PENDING',
    initiated_by      VARCHAR(100) NOT NULL,   -- app-level actor (teller/customer/system)
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_txn_from FOREIGN KEY (from_account_id) REFERENCES Accounts(account_id),
    CONSTRAINT fk_txn_to   FOREIGN KEY (to_account_id)   REFERENCES Accounts(account_id),
    CONSTRAINT chk_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_txn_endpoints CHECK (from_account_id IS NOT NULL OR to_account_id IS NOT NULL)
) ENGINE=InnoDB;

CREATE INDEX idx_txn_from ON Transactions(from_account_id);
CREATE INDEX idx_txn_to   ON Transactions(to_account_id);

-- ------------------------------------------------------------
-- 5. AUDIT_LOGS  (generic, append-only trail written by triggers)
-- ------------------------------------------------------------
CREATE TABLE Audit_Logs (
    audit_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    table_name    VARCHAR(50) NOT NULL,
    record_id     INT NOT NULL,
    operation     ENUM('INSERT','UPDATE','DELETE') NOT NULL,
    column_name   VARCHAR(50),
    old_value     VARCHAR(255),
    new_value     VARCHAR(255),
    changed_by    VARCHAR(100) NOT NULL,   -- database session user (CURRENT_USER())
    changed_at    TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;

CREATE INDEX idx_audit_table_record ON Audit_Logs(table_name, record_id);
CREATE INDEX idx_audit_changed_at   ON Audit_Logs(changed_at);
