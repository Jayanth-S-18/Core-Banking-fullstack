-- Core Banking schema (MySQL 8+ / MariaDB 10.5+)
DROP DATABASE IF EXISTS core_banking;
CREATE DATABASE core_banking CHARACTER SET utf8mb4;
USE core_banking;

CREATE TABLE Branches (
  branch_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  ifsc VARCHAR(11) NOT NULL UNIQUE,
  city VARCHAR(60) NOT NULL
);

CREATE TABLE Users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(15) NOT NULL,
  address VARCHAR(200),
  dob DATE,
  pan VARCHAR(10) UNIQUE,
  kyc_status ENUM('VERIFIED','PENDING') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Accounts (
  account_id INT AUTO_INCREMENT PRIMARY KEY,
  account_no VARCHAR(16) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  branch_id INT NOT NULL,
  type ENUM('SAVINGS','CURRENT','SALARY') NOT NULL DEFAULT 'SAVINGS',
  balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  status ENUM('ACTIVE','FROZEN') NOT NULL DEFAULT 'ACTIVE',
  opened_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  CONSTRAINT chk_balance CHECK (balance >= 0),          -- the DB itself refuses negative money
  FOREIGN KEY (user_id) REFERENCES Users(user_id),
  FOREIGN KEY (branch_id) REFERENCES Branches(branch_id),
  INDEX idx_acc_user (user_id), INDEX idx_acc_branch (branch_id)
);

CREATE TABLE Transactions (
  txn_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  from_account INT NULL,
  to_account INT NULL,
  amount DECIMAL(15,2) NOT NULL,
  txn_type ENUM('TRANSFER','DEPOSIT','WITHDRAWAL') NOT NULL,
  status ENUM('SUCCESS','FAILED') NOT NULL,
  note VARCHAR(200),
  initiated_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_amount CHECK (amount > 0),
  FOREIGN KEY (from_account) REFERENCES Accounts(account_id),
  FOREIGN KEY (to_account) REFERENCES Accounts(account_id),
  INDEX idx_txn_time (created_at)
);

CREATE TABLE Audit_Logs (
  log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  old_balance DECIMAL(15,2),
  new_balance DECIMAL(15,2),
  changed_by VARCHAR(100),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES Accounts(account_id)
);
