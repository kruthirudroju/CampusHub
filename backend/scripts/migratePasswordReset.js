const pool = require('../config/db');

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY ix_prt_user (user_id),
      KEY ix_prt_expires (expires_at)
    ) ENGINE=InnoDB`);
  console.log('+ password_reset_tokens table ready');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
