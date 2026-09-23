const pool = require('../config/db');
const { recordAudit } = require('../utils/audit');

/** GET /api/faculty?search= */
exports.getAllFacultyStatus = async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `
      SELECT u.id AS faculty_id, u.name, u.department, u.email,
             fa.status, fa.note, fa.updated_at
      FROM users u
      JOIN faculty_availability fa ON u.id = fa.faculty_id
      WHERE u.role = 'faculty' AND u.institution_id = ? AND u.is_active = 1`;
    const params = [req.user.institutionId];

    if (search) {
      sql += ' AND (u.name LIKE ? OR u.department LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY u.name';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load faculty' });
  }
};

/** GET /api/faculty/:facultyId */
exports.getFacultyStatusById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id AS faculty_id, u.name, u.department, fa.status, fa.note, fa.updated_at
       FROM users u JOIN faculty_availability fa ON u.id = fa.faculty_id
       WHERE u.id = ? AND u.role = 'faculty' AND u.institution_id = ?`,
      [req.params.facultyId, req.user.institutionId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Faculty member not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load faculty member' });
  }
};

/** PUT /api/faculty/status  (faculty only, always their own row) */
exports.updateOwnStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const valid = ['Available', 'In Class', 'In Meeting', 'Out of Office'];
    if (!valid.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${valid.join(', ')}` });
    }

    const [before] = await pool.query('SELECT status, note FROM faculty_availability WHERE faculty_id = ?', [req.user.id]);

    await pool.query(
      `INSERT INTO faculty_availability (faculty_id, status, note) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note)`,
      [req.user.id, status, note ? String(note).slice(0, 160) : null]
    );

    await recordAudit(req, {
      action: 'UPDATE', entityType: 'faculty_availability', entityId: req.user.id,
      summary: `${req.user.name} set availability to ${status}`,
      before: before[0] || null, after: { status, note: note || null }
    });

    res.json({ message: 'Status updated', status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update status' });
  }
};
