const pool = require('../config/db');
const { recordAudit } = require('../utils/audit');

const CATEGORIES = ['Electrical', 'Furniture', 'Internet', 'Cleaning', 'Water', 'Other'];
const STATUSES = ['Pending', 'In Progress', 'Completed', 'Rejected'];

/** POST /api/maintenance */
exports.createRequest = async (req, res) => {
  try {
    const { category, location, room_number, description, priority } = req.body;
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ message: `category must be one of: ${CATEGORIES.join(', ')}` });
    }
    if (!location || !description) return res.status(400).json({ message: 'location and description are required' });

    const finalPriority = ['Low', 'Medium', 'High'].includes(priority) ? priority : 'Medium';

    const [result] = await pool.query(
      `INSERT INTO maintenance_requests
        (institution_id, reported_by, category, location, room_number, description, priority, status)
       VALUES (?,?,?,?,?,?,?, 'Pending')`,
      [req.user.institutionId, req.user.id, category, location, room_number || null, description, finalPriority]
    );

    await recordAudit(req, {
      action: 'CREATE', entityType: 'maintenance_request', entityId: result.insertId,
      summary: `${req.user.name} reported a ${category} issue at ${location}`,
      after: { category, location, room_number: room_number || null, description, priority: finalPriority }
    });

    res.status(201).json({ message: 'Request submitted', requestId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not submit the request' });
  }
};

/** GET /api/maintenance/mine */
exports.getMyRequests = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM maintenance_requests WHERE reported_by = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load your requests' });
  }
};

/** GET /api/maintenance?status=  (admin) */
exports.getAllRequests = async (req, res) => {
  try {
    const { status, category } = req.query;
    let sql = `
      SELECT mr.*, u.name AS reported_by_name, u.email AS reported_by_email, u.role AS reporter_role
      FROM maintenance_requests mr JOIN users u ON mr.reported_by = u.id
      WHERE mr.institution_id = ?`;
    const params = [req.user.institutionId];
    if (status) { sql += ' AND mr.status = ?'; params.push(status); }
    if (category) { sql += ' AND mr.category = ?'; params.push(category); }
    sql += " ORDER BY FIELD(mr.priority,'High','Medium','Low'), mr.created_at DESC";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load requests' });
  }
};

/** PUT /api/maintenance/:requestId/status (admin) */
exports.updateRequestStatus = async (req, res) => {
  try {
    const { status, admin_note } = req.body;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${STATUSES.join(', ')}` });
    }

    const [before] = await pool.query(
      'SELECT status, admin_note FROM maintenance_requests WHERE id = ? AND institution_id = ?',
      [req.params.requestId, req.user.institutionId]
    );
    if (before.length === 0) return res.status(404).json({ message: 'Request not found' });

    const resolvedAt = status === 'Completed' ? new Date() : null;
    await pool.query(
      'UPDATE maintenance_requests SET status = ?, admin_note = ?, resolved_at = ? WHERE id = ? AND institution_id = ?',
      [status, admin_note || null, resolvedAt, req.params.requestId, req.user.institutionId]
    );

    await recordAudit(req, {
      action: 'UPDATE', entityType: 'maintenance_request', entityId: req.params.requestId,
      summary: `${req.user.name} moved request #${req.params.requestId} to ${status}`,
      before: before[0], after: { status, admin_note: admin_note || null }
    });

    res.json({ message: 'Status updated', status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update the status' });
  }
};
