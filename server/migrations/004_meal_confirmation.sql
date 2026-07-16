ALTER TABLE meals
  ADD COLUMN is_confirmed TINYINT(1) NOT NULL DEFAULT 0 AFTER guest_meals,
  ADD COLUMN confirmed_at DATETIME NULL AFTER is_confirmed,
  ADD COLUMN confirmed_by BIGINT UNSIGNED NULL AFTER confirmed_at,
  ADD CONSTRAINT fk_meals_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES users(id);
