const pool = require('../config/db');
const { recordAudit } = require('../utils/audit');

/** GET /api/lostfound?kind=Lost|Found&search= */
exports.listItems = async (req, res) => {
  try {
    const { kind, search, status } = req.query;
    let sql = `
      SELECT lf.*, u.name AS reported_by_name
      FROM lost_found_items lf JOIN users u ON lf.reported_by = u.id
      WHERE lf.institution_id = ?`;
    const params = [req.user.institutionId];

    if (kind === 'Lost' || kind === 'Found') { sql += ' AND lf.kind = ?'; params.push(kind); }
    if (status) { sql += ' AND lf.status = ?'; params.push(status); }
    else { sql += " AND lf.status <> 'Closed'"; }
    if (search) {
      sql += ' AND (lf.item_name LIKE ? OR lf.description LIKE ? OR lf.location LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY lf.created_at DESC LIMIT 200';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load items' });
  }
};

/** POST /api/lostfound */
exports.createItem = async (req, res) => {
  try {
    const { kind, item_name, category, location, occurred_on, description, contact_info } = req.body;
    if (!['Lost', 'Found'].includes(kind)) return res.status(400).json({ message: 'kind must be Lost or Found' });
    if (!item_name) return res.status(400).json({ message: 'item_name is required' });

    const [result] = await pool.query(
      `INSERT INTO lost_found_items
        (institution_id, kind, item_name, category, location, occurred_on, description, contact_info, reported_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [req.user.institutionId, kind, item_name, category || null, location || null,
       occurred_on || null, description || null, contact_info || null, req.user.id]
    );

    await recordAudit(req, {
      action: 'CREATE', entityType: 'lost_found_item', entityId: result.insertId,
      summary: `${req.user.name} posted a ${kind.toLowerCase()} item: ${item_name}`,
      after: { kind, item_name, location: location || null }
    });

    res.status(201).json({ message: 'Posted', itemId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not post the item' });
  }
};

/** PUT /api/lostfound/:itemId/status  (owner or admin) */
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Open', 'Claimed', 'Closed'].includes(status)) {
      return res.status(400).json({ message: 'status must be Open, Claimed or Closed' });
    }

    const [rows] = await pool.query('SELECT * FROM lost_found_items WHERE id = ? AND institution_id = ?',
      [req.params.itemId, req.user.institutionId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Item not found' });
    if (req.user.role !== 'admin' && rows[0].reported_by !== req.user.id) {
      return res.status(403).json({ message: 'You cannot update this listing' });
    }

    await pool.query('UPDATE lost_found_items SET status = ? WHERE id = ?', [status, req.params.itemId]);

    await recordAudit(req, {
      action: 'UPDATE', entityType: 'lost_found_item', entityId: req.params.itemId,
      summary: `${req.user.name} marked "${rows[0].item_name}" as ${status}`,
      before: { status: rows[0].status }, after: { status }
    });

    res.json({ message: 'Updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update the listing' });
  }
};
