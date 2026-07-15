ALTER TABLE users
  ADD COLUMN system_role ENUM('user','super_admin') NOT NULL DEFAULT 'user' AFTER must_change_password;

-- Bootstrap the owner of the first mess. Change this assignment afterward if needed.
UPDATE users SET system_role='super_admin'
WHERE id=(SELECT created_by FROM messes ORDER BY id LIMIT 1);
