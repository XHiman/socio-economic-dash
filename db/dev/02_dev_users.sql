-- DEV ONLY (hard-coded password). Production uses db/prod/create_readonly_user.sql.
CREATE USER IF NOT EXISTS 'dash_ro'@'%' IDENTIFIED BY 'dev_ro_password';
GRANT SELECT ON `socioecon`.* TO 'dash_ro'@'%';
FLUSH PRIVILEGES;
