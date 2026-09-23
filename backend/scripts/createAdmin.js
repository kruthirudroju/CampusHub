/**
 * Creates (or resets) an administrator account.
 *   node scripts/createAdmin.js "Admin Name" admin@vardhaman.org "StrongPass1" [slug]
 */
const bcrypt = require('bcrypt');
const pool = require('../config/db');

async function main() {
  const [name, email, password, slug = 'vardhaman'] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.log('Usage: node scripts/createAdmin.js "Name" email password [institution-slug]');
    process.exit(1);
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    console.log('Password must be at least 8 characters and contain a letter and a number.');
    process.exit(1);
  }

  const [insts] = await pool.query('SELECT id FROM institutions WHERE slug = ?', [slug]);
  if (insts.length === 0) throw new Error(`No institution with slug "${slug}"`);
  const institutionId = insts[0].id;

  const hash = await bcrypt.hash(password, 12);
  const emailLower = email.toLowerCase();

  const [ex] = await pool.query('SELECT id FROM users WHERE institution_id = ? AND email = ?', [institutionId, emailLower]);
  if (ex.length) {
    await pool.query("UPDATE users SET password_hash=?, role='admin', is_active=1, must_change_password=0, failed_login_attempts=0, locked_until=NULL WHERE id=?",
      [hash, ex[0].id]);
    console.log(`Password reset for existing admin ${emailLower}`);
  } else {
    await pool.query(
      `INSERT INTO users (institution_id, name, email, password_hash, role, must_change_password)
       VALUES (?,?,?,?, 'admin', 0)`,
      [institutionId, name, emailLower, hash]);
    console.log(`Admin created: ${emailLower}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
