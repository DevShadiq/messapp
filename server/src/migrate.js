import 'dotenv/config';
import { pool } from './db.js';

const [columns] = await pool.execute(`
  SELECT COLUMN_NAME FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=? AND TABLE_NAME='users' AND COLUMN_NAME='must_change_password'
`, [process.env.DB_NAME]);

if (!columns.length) {
  await pool.execute(`ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash`);
  console.log('Applied migration: users.must_change_password');
} else {
  console.log('Database is already up to date.');
}

const [roleColumns] = await pool.execute(`
  SELECT COLUMN_NAME FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=? AND TABLE_NAME='users' AND COLUMN_NAME='system_role'
`, [process.env.DB_NAME]);

if (!roleColumns.length) {
  await pool.execute("ALTER TABLE users ADD COLUMN system_role ENUM('user','super_admin') NOT NULL DEFAULT 'user' AFTER must_change_password");
  const [[owner]] = await pool.execute('SELECT created_by AS userId FROM messes ORDER BY id LIMIT 1');
  if (owner) await pool.execute("UPDATE users SET system_role='super_admin' WHERE id=?", [owner.userId]);
  console.log('Applied migration: users.system_role; first mess owner promoted to super admin.');
}

const [mealConfirmationColumns] = await pool.execute(`
  SELECT COLUMN_NAME FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=? AND TABLE_NAME='meals' AND COLUMN_NAME='is_confirmed'
`, [process.env.DB_NAME]);

if (!mealConfirmationColumns.length) {
  await pool.execute('ALTER TABLE meals ADD COLUMN is_confirmed TINYINT(1) NOT NULL DEFAULT 0 AFTER guest_meals, ADD COLUMN confirmed_at DATETIME NULL AFTER is_confirmed, ADD COLUMN confirmed_by BIGINT UNSIGNED NULL AFTER confirmed_at, ADD CONSTRAINT fk_meals_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES users(id)');
  console.log('Applied migration: meals confirmation fields.');
}

await pool.end();
