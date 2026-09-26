const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { recordAudit } = require('../utils/audit');

const BCRYPT_ROUNDS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const isStrong = (pw) =>
  typeof pw === 'string' && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, institutionId: user.institution_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department,
    institutionId: u.institution_id,
    mustChangePassword: !!u.must_change_password
  };
}

/** POST /api/auth/signup  (scoped to an institution, domain-restricted) */
exports.signup = async (req, res) => {
  try {
    const { institutionSlug, name, email, password, role, department, rollNumber, phone } = req.body;

    if (!institutionSlug || !name || !email || !password || !role) {
      return res.status(400).json({ message: 'institutionSlug, name, email, password and role are required' });
    }
    if (!['student', 'faculty'].includes(role)) {
      // Admin accounts are provisioned by an existing admin, never self-serve.
      return res.status(400).json({ message: 'You can only register as a student or faculty member' });
    }
    if (!isStrong(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters and include a letter and a number' });
    }

    const [insts] = await pool.query(
      'SELECT id, email_domains FROM institutions WHERE slug = ? AND is_active = 1',
      [institutionSlug]
    );
    if (insts.length === 0) return res.status(404).json({ message: 'Institution not found' });
    const inst = insts[0];

    const domains = inst.email_domains.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
    const emailLower = String(email).trim().toLowerCase();
    const domainOk = domains.some((d) => emailLower.endsWith('@' + d));
    if (!domainOk) {
      return res.status(400).json({ message: `Use your institution email (${domains.map((d) => '@' + d).join(' or ')})` });
    }

    const [existing] = await pool.query(
      'SELECT id FROM users WHERE institution_id = ? AND email = ?',
      [inst.id, emailLower]
    );
    if (existing.length > 0) return res.status(409).json({ message: 'An account with this email already exists' });

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [result] = await pool.query(
      `INSERT INTO users (institution_id, name, email, password_hash, role, department, roll_number, phone, must_change_password)
       VALUES (?,?,?,?,?,?,?,?,0)`,
      [inst.id, name.trim(), emailLower, hash, role, department || null, rollNumber || null, phone || null]
    );

    if (role === 'faculty') {
      await pool.query('INSERT INTO faculty_availability (faculty_id, status) VALUES (?, ?)', [result.insertId, 'Out of Office']);
    }

    await recordAudit(req, {
      action: 'CREATE',
      entityType: 'user',
      entityId: result.insertId,
      summary: `New ${role} account registered: ${name} <${emailLower}>`,
      after: { name, email: emailLower, role, department: department || null },
      institutionId: inst.id,
      actor: { id: result.insertId, name, role }
    });

    res.status(201).json({ message: 'Account created. You can sign in now.', userId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not create the account' });
  }
};

/** POST /api/auth/login */
exports.login = async (req, res) => {
  try {
    const { institutionSlug, email, password } = req.body;
    if (!institutionSlug || !email || !password) {
      return res.status(400).json({ message: 'institutionSlug, email and password are required' });
    }

    const [insts] = await pool.query('SELECT id FROM institutions WHERE slug = ? AND is_active = 1', [institutionSlug]);
    if (insts.length === 0) return res.status(404).json({ message: 'Institution not found' });
    const institutionId = insts[0].id;

    const emailLower = String(email).trim().toLowerCase();
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE institution_id = ? AND email = ?',
      [institutionId, emailLower]
    );

    // Same generic message whether the email is unknown or the password is wrong,
    // so the endpoint can't be used to discover which accounts exist.
    const generic = { message: 'Incorrect email or password' };

    if (rows.length === 0) {
      await recordAudit(req, {
        action: 'LOGIN_FAILED', entityType: 'auth', summary: `Failed sign-in for unknown email ${emailLower}`,
        institutionId
      });
      return res.status(401).json(generic);
    }

    const user = rows[0];

    if (!user.is_active) return res.status(403).json({ message: 'This account has been disabled' });

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ message: 'Too many failed attempts. Try again in a few minutes.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const attempts = user.failed_login_attempts + 1;
      const lockUntil = attempts >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null;
      await pool.query('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
        [attempts, lockUntil, user.id]);
      await recordAudit(req, {
        action: 'LOGIN_FAILED', entityType: 'auth', entityId: user.id,
        summary: `Failed sign-in (${attempts}/${MAX_FAILED}) for ${user.email}`,
        institutionId, actor: { id: user.id, name: user.name, role: user.role }
      });
      return res.status(401).json(generic);
    }

    await pool.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?',
      [user.id]
    );

    await recordAudit(req, {
      action: 'LOGIN', entityType: 'auth', entityId: user.id,
      summary: `${user.name} signed in`,
      institutionId, actor: { id: user.id, name: user.name, role: user.role }
    });

    res.json({ message: 'Signed in', token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not sign in' });
  }
};

/** GET /api/auth/me */
exports.me = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.*, i.slug AS institution_slug, i.name AS institution_name, i.accent_color
     FROM users u JOIN institutions i ON u.institution_id = i.id WHERE u.id = ?`,
    [req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Account not found' });
  const u = rows[0];
  res.json({
    ...publicUser(u),
    institutionSlug: u.institution_slug,
    institutionName: u.institution_name,
    accentColor: u.accent_color
  });
};

/** PUT /api/auth/password */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    }
    if (!isStrong(newPassword)) {
      return res.status(400).json({ message: 'New password must be at least 8 characters and include a letter and a number' });
    }

    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) return res.status(401).json({ message: 'Your current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [hash, req.user.id]);

    await recordAudit(req, {
      action: 'UPDATE', entityType: 'user', entityId: req.user.id,
      summary: `${req.user.name} changed their password`
    });

    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update the password' });
  }
};

/* ------------------------------------------------------------------
   Password reset via emailed link (does not require the old password)
   ------------------------------------------------------------------ */
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/mailer');

const RESET_TOKEN_MINUTES = 30;

/** POST /api/auth/forgot-password  { institutionSlug, email } */
exports.forgotPassword = async (req, res) => {
  // Always return the same generic response, whether or not the email
  // exists -- this endpoint must not reveal which emails are registered.
  const generic = { message: 'If that email is registered, a reset link has been sent.' };

  try {
    const { institutionSlug, email } = req.body;
    if (!institutionSlug || !email) return res.status(400).json(generic);

    const [insts] = await pool.query('SELECT id, name FROM institutions WHERE slug = ? AND is_active = 1', [institutionSlug]);
    if (insts.length === 0) return res.json(generic);
    const institution = insts[0];

    const emailLower = String(email).trim().toLowerCase();
    const [users] = await pool.query(
      'SELECT id, name, email FROM users WHERE institution_id = ? AND email = ? AND is_active = 1',
      [institution.id, emailLower]
    );
    if (users.length === 0) return res.json(generic);
    const user = users[0];

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60000);

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)',
      [user.id, tokenHash, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password/${institutionSlug}/${rawToken}`;

    await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl, institutionName: institution.name });

    await recordAudit(req, {
      action: 'CREATE', entityType: 'password_reset_request', entityId: user.id,
      summary: `Password reset requested for ${user.email}`,
      institutionId: institution.id, actor: { id: user.id, name: user.name, role: null }
    });

    res.json(generic);
  } catch (err) {
    console.error('[forgotPassword]', err.message);
    // Still generic to the client -- but we log the real error server-side
    // (e.g. SMTP not configured) so it's fixable without leaking to users.
    res.json(generic);
  }
};

/** POST /api/auth/reset-password  { institutionSlug, token, newPassword } */
exports.resetPassword = async (req, res) => {
  try {
    const { institutionSlug, token, newPassword } = req.body;
    if (!institutionSlug || !token || !newPassword) {
      return res.status(400).json({ message: 'token and newPassword are required' });
    }
    if (!isStrong(newPassword)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters and include a letter and a number' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query(
      `SELECT prt.id AS token_id, prt.expires_at, prt.used_at, u.id AS user_id, u.name, u.email, u.institution_id
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       JOIN institutions i ON u.institution_id = i.id
       WHERE prt.token_hash = ? AND i.slug = ?`,
      [tokenHash, institutionSlug]
    );

    if (rows.length === 0) return res.status(400).json({ message: 'This reset link is invalid.' });
    const row = rows[0];
    if (row.used_at) return res.status(400).json({ message: 'This reset link has already been used.' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ message: 'This reset link has expired. Please request a new one.' });

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = ?, must_change_password = 0, failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [hash, row.user_id]);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [row.token_id]);

    await recordAudit(req, {
      action: 'UPDATE', entityType: 'user', entityId: row.user_id,
      summary: `${row.name} reset their password via emailed link`,
      institutionId: row.institution_id, actor: { id: row.user_id, name: row.name, role: null }
    });

    res.json({ message: 'Password updated. You can sign in now.' });
  } catch (err) {
    console.error('[resetPassword]', err.message);
    res.status(500).json({ message: 'Could not reset the password. Please try again.' });
  }
};
