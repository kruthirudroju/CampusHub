const pool = require('../config/db');
const { recordAudit } = require('../utils/audit');

/** POST /api/messages  (student -> faculty) */
exports.sendMessage = async (req, res) => {
  try {
    const { facultyId, subject, content } = req.body;
    if (!facultyId || !content) return res.status(400).json({ message: 'facultyId and content are required' });

    const [faculty] = await pool.query(
      "SELECT id, name FROM users WHERE id = ? AND role = 'faculty' AND institution_id = ?",
      [facultyId, req.user.institutionId]
    );
    if (faculty.length === 0) return res.status(404).json({ message: 'Faculty member not found' });

    const [result] = await pool.query(
      `INSERT INTO messages (institution_id, student_id, faculty_id, subject, content, status)
       VALUES (?,?,?,?,?, 'Pending')`,
      [req.user.institutionId, req.user.id, facultyId, subject || null, content]
    );

    await recordAudit(req, {
      action: 'CREATE', entityType: 'message', entityId: result.insertId,
      summary: `${req.user.name} sent a query to ${faculty[0].name}`,
      after: { facultyId, subject: subject || null, content }
    });

    res.status(201).json({ message: 'Message sent', messageId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not send the message' });
  }
};

/** GET /api/messages/inbox?status= (faculty) */
exports.getMyMessages = async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT m.id, m.subject, m.content, m.status, m.reply, m.created_at, m.replied_at,
             u.name AS student_name, u.email AS student_email, u.roll_number
      FROM messages m JOIN users u ON m.student_id = u.id
      WHERE m.faculty_id = ?`;
    const params = [req.user.id];
    if (status) { sql += ' AND m.status = ?'; params.push(status); }
    sql += ' ORDER BY m.created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load messages' });
  }
};

/** GET /api/messages/sent (student) */
exports.getSentMessages = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.id, m.subject, m.content, m.status, m.reply, m.created_at, m.replied_at,
              u.name AS faculty_name, u.department
       FROM messages m JOIN users u ON m.faculty_id = u.id
       WHERE m.student_id = ? ORDER BY m.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load messages' });
  }
};

/** PUT /api/messages/:messageId/read */
exports.markAsRead = async (req, res) => {
  try {
    const [result] = await pool.query(
      "UPDATE messages SET status = 'Read', read_at = NOW() WHERE id = ? AND faculty_id = ? AND status = 'Pending'",
      [req.params.messageId, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Message not found, not yours, or already handled' });
    }
    await recordAudit(req, {
      action: 'UPDATE', entityType: 'message', entityId: req.params.messageId,
      summary: `${req.user.name} opened a student query`,
      before: { status: 'Pending' }, after: { status: 'Read' }
    });
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update the message' });
  }
};

/** PUT /api/messages/:messageId/reply */
exports.replyToMessage = async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ message: 'reply is required' });

    const [before] = await pool.query('SELECT status, reply FROM messages WHERE id = ? AND faculty_id = ?',
      [req.params.messageId, req.user.id]);
    if (before.length === 0) return res.status(404).json({ message: 'Message not found or not yours' });

    await pool.query(
      "UPDATE messages SET reply = ?, status = 'Answered', replied_at = NOW() WHERE id = ? AND faculty_id = ?",
      [reply, req.params.messageId, req.user.id]
    );

    await recordAudit(req, {
      action: 'UPDATE', entityType: 'message', entityId: req.params.messageId,
      summary: `${req.user.name} replied to a student query`,
      before: before[0], after: { status: 'Answered', reply }
    });

    res.json({ message: 'Reply sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not send the reply' });
  }
};
