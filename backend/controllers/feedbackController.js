const pool = require('../config/db');
const { recordAudit } = require('../utils/audit');

/** POST /api/feedback -- anonymous by default */
exports.submit = async (req, res) => {
  try {
    const { category, message, isAnonymous = true } = req.body;
    if (!message || message.trim().length < 5) {
      return res.status(400).json({ message: 'Please write a little more detail' });
    }
    const cats = ['Facilities','Academics','Transport','Canteen','Safety','Other'];
    const cat = cats.includes(category) ? category : 'Other';

    const [result] = await pool.query(
      'INSERT INTO feedback (institution_id, category, message, is_anonymous, submitted_by) VALUES (?,?,?,?,?)',
      [req.user.institutionId, cat, message.trim(), isAnonymous ? 1 : 0, isAnonymous ? null : req.user.id]
    );

    // The audit entry deliberately omits the author when the note is anonymous.
    await recordAudit(req, {
      action: 'CREATE', entityType: 'feedback', entityId: result.insertId,
      summary: isAnonymous ? `Anonymous feedback submitted (${cat})` : `${req.user.name} submitted feedback (${cat})`,
      actor: isAnonymous ? { id: null, name: null, role: null } : req.user,
      institutionId: req.user.institutionId
    });

    res.status(201).json({ message: 'Thank you, your feedback has been recorded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not submit the feedback' });
  }
};

/** GET /api/feedback (admin) */
exports.list = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.id, f.category, f.message, f.is_anonymous, f.status, f.created_at,
              CASE WHEN f.is_anonymous = 1 THEN NULL ELSE u.name END AS submitted_by_name
       FROM feedback f LEFT JOIN users u ON f.submitted_by = u.id
       WHERE f.institution_id = ? ORDER BY f.created_at DESC LIMIT 200`,
      [req.user.institutionId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load feedback' });
  }
};

/** PUT /api/feedback/:id/status (admin) */
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['New', 'Reviewed', 'Actioned'].includes(status)) {
      return res.status(400).json({ message: 'status must be New, Reviewed or Actioned' });
    }
    await pool.query('UPDATE feedback SET status = ? WHERE id = ? AND institution_id = ?',
      [status, req.params.id, req.user.institutionId]);
    await recordAudit(req, {
      action: 'UPDATE', entityType: 'feedback', entityId: req.params.id,
      summary: `${req.user.name} marked feedback #${req.params.id} as ${status}`, after: { status }
    });
    res.json({ message: 'Updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update the feedback' });
  }
};
