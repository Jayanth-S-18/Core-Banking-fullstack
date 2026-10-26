-- Demo data: 4 branches, 6 customers, 9 accounts, transaction history
USE core_banking;
INSERT INTO Branches(name,ifsc,city) VALUES
 ('T Nagar Main','CBIN0001001','Chennai'),('MG Road','CBIN0002002','Bengaluru'),
 ('Andheri West','CBIN0003003','Mumbai'),('Connaught Place','CBIN0004004','Delhi');

INSERT INTO Users(full_name,email,phone,address,dob,pan,kyc_status) VALUES
 ('Aarav Sharma','aarav.sharma@example.com','9876500001','12 MG Road, Bengaluru','1992-04-12','ABCPS1234A','VERIFIED'),
 ('Priya Nair','priya.nair@example.com','9876500002','45 Usman Road, T Nagar, Chennai','1995-09-03','BCDPN2345B','VERIFIED'),
 ('Rohan Mehta','rohan.mehta@example.com','9876500003','8 Linking Road, Andheri, Mumbai','1988-01-27','CDEPM3456C','VERIFIED'),
 ('Ananya Iyer','ananya.iyer@example.com','9876500004','23 Anna Nagar, Chennai','1998-11-19','DEFPI4567D','VERIFIED'),
 ('Vikram Singh','vikram.singh@example.com','9876500005','5 Barakhamba Road, New Delhi','1980-06-30','EFGPS5678E','VERIFIED'),
 ('Meera Reddy','meera.reddy@example.com','9876500006','17 Banjara Hills, Hyderabad','2001-02-14','FGHPR6789F','PENDING');

INSERT INTO Accounts(account_no,user_id,branch_id,type,balance,status,opened_on) VALUES
 ('CB1001001',1,2,'SAVINGS',185000.00,'ACTIVE','2021-03-15'),
 ('CB1001002',1,2,'CURRENT',420000.00,'ACTIVE','2022-07-01'),
 ('CB1002001',2,1,'SALARY', 72500.50,'ACTIVE','2023-01-10'),
 ('CB1003001',3,3,'SAVINGS',310250.75,'ACTIVE','2020-11-05'),
 ('CB1003002',3,3,'CURRENT',950000.00,'ACTIVE','2019-08-21'),
 ('CB1004001',4,1,'SAVINGS', 26800.00,'ACTIVE','2024-02-02'),
 ('CB1005001',5,4,'SAVINGS',640000.00,'ACTIVE','2018-05-18'),
 ('CB1005002',5,4,'SALARY', 98000.00,'ACTIVE','2022-12-12'),
 ('CB1006001',6,2,'SAVINGS',  5000.00,'FROZEN','2025-06-01');   -- frozen: try it to see a rejection

INSERT INTO Transactions(from_account,to_account,amount,txn_type,status,note,initiated_by,created_at) VALUES
 (NULL,1,50000,'DEPOSIT','SUCCESS','Cash deposit','Teller-Kavya',DATE_SUB(NOW(),INTERVAL 6 DAY)),
 (1,3,12000,'TRANSFER','SUCCESS','Rent share','Teller-Kavya',DATE_SUB(NOW(),INTERVAL 5 DAY)),
 (4,NULL,8000,'WITHDRAWAL','SUCCESS','Cash withdrawal','ATM-Mumbai-07',DATE_SUB(NOW(),INTERVAL 4 DAY)),
 (7,8,25000,'TRANSFER','SUCCESS','Savings top-up','Teller-Arjun',DATE_SUB(NOW(),INTERVAL 3 DAY)),
 (6,2,90000,'TRANSFER','FAILED','Insufficient funds','Teller-Priya',DATE_SUB(NOW(),INTERVAL 2 DAY)),
 (NULL,5,150000,'DEPOSIT','SUCCESS','Business receipt','Teller-Rohit',DATE_SUB(NOW(),INTERVAL 1 DAY)),
 (2,1,30000,'TRANSFER','SUCCESS','Move to savings','NetBanking-Aarav',NOW());

INSERT INTO Audit_Logs(account_id,old_balance,new_balance,changed_by,changed_at) VALUES
 (1,135000,185000,'Teller-Kavya',DATE_SUB(NOW(),INTERVAL 6 DAY)),
 (7,665000,640000,'Teller-Arjun',DATE_SUB(NOW(),INTERVAL 3 DAY)),
 (8,73000,98000,'Teller-Arjun',DATE_SUB(NOW(),INTERVAL 3 DAY));
