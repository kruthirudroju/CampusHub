const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/** Verifies the bearer token and attaches req.user */
exports.verifyToken = async (req, res, next) => {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: 'Not signed in' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Confirm the account still exists and is active on every request --
    // a disabled or deleted user must not keep working off an old token.
    const [rows] = await pool.query(
      'SELECT id, institution_id, name, email, role, is_active FROM users WHERE id = ?',
      [decoded.id]
    );
    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(401).json({ message: 'Account is no longer active' });
    }

    req.user = {
      id: rows[0].id,
      institutionId: rows[0].institution_id,
      name: rows[0].name,
      email: rows[0].email,
      role: rows[0].role
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expired, please sign in again' });
  }
};

/** Restricts a route to one or more roles */
exports.requireRole = (...allowed) => (req, res, next) => {
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have permission to do this' });
  }
  next();
};
