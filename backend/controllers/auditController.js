const pool = require('../config/db');

/** GET /api/audit?entityType=&action=&actorId=&from=&to=&page= (admin) */
exports.list = async (req, res) => {
  try {
    const { entityType, action, actorId, from, to } = req.query;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const perPage = Math.min(100, parseInt(req.query.perPage || '50', 10));

    let where = 'WHERE institution_id = ?';
    const params = [req.user.institutionId];
    if (entityType) { where += ' AND entity_type = ?'; params.push(entityType); }
    if (action)     { where += ' AND action = ?';      params.push(action); }
    if (actorId)    { where += ' AND actor_id = ?';    params.push(actorId); }
    if (from)       { where += ' AND created_at >= ?'; params.push(from); }
    if (to)         { where += ' AND created_at <= ?'; params.push(to); }

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs ${where}`, params);
    const [rows] = await pool.query(
      `SELECT id, actor_id, actor_name, actor_role, action, entity_type, entity_id,
              summary, ip_address, created_at
       FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, perPage, (page - 1) * perPage]
    );

    res.json({ total: countRows[0].total, page, perPage, entries: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load the activity log' });
  }
};

/** GET /api/audit/export.xlsx (admin) -- streams a real Excel workbook */
exports.exportExcel = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { from, to } = req.query;

    let where = 'WHERE institution_id = ?';
    const params = [req.user.institutionId];
    if (from) { where += ' AND created_at >= ?'; params.push(from); }
    if (to)   { where += ' AND created_at <= ?'; params.push(to); }

    const [rows] = await pool.query(
      `SELECT id, created_at, actor_name, actor_role, action, entity_type, entity_id,
              summary, before_data, after_data, ip_address
       FROM audit_logs ${where} ORDER BY created_at DESC LIMIT 50000`, params);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'CampusHub';
    const ws = wb.addWorksheet('Activity log');

    ws.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'When', key: 'created_at', width: 22 },
      { header: 'User', key: 'actor_name', width: 26 },
      { header: 'Role', key: 'actor_role', width: 12 },
      { header: 'Action', key: 'action', width: 16 },
      { header: 'Entity', key: 'entity_type', width: 22 },
      { header: 'Entity ID', key: 'entity_id', width: 12 },
      { header: 'Summary', key: 'summary', width: 60 },
      { header: 'Before', key: 'before_data', width: 40 },
      { header: 'After', key: 'after_data', width: 40 },
      { header: 'IP', key: 'ip_address', width: 18 }
    ];
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    for (const r of rows) {
      ws.addRow({
        ...r,
        created_at: r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '',
        before_data: r.before_data ? JSON.stringify(r.before_data) : '',
        after_data: r.after_data ? JSON.stringify(r.after_data) : ''
      });
    }
    ws.autoFilter = { from: 'A1', to: 'K1' };

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="campushub-activity-${stamp}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not build the export' });
  }
};

/** GET /api/audit/analytics (admin) -- descriptive stats for the dashboard */
exports.analytics = async (req, res) => {
  try {
    const inst = req.user.institutionId;
    const q = (sql, p = [inst]) => pool.query(sql, p).then(([r]) => r);

    const [byCategory, byStatus, avgResolution, topFaculty, eventPopularity, activityByDay, totals] =
      await Promise.all([
        q(`SELECT category, COUNT(*) AS count FROM maintenance_requests
           WHERE institution_id = ? GROUP BY category ORDER BY count DESC`),
        q(`SELECT status, COUNT(*) AS count FROM maintenance_requests
           WHERE institution_id = ? GROUP BY status`),
        q(`SELECT ROUND(AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)),1) AS avg_hours
           FROM maintenance_requests WHERE institution_id = ? AND resolved_at IS NOT NULL`),
        q(`SELECT f.name, COUNT(m.id) AS messages,
                  ROUND(AVG(TIMESTAMPDIFF(HOUR, m.created_at, m.replied_at)),1) AS avg_reply_hours
           FROM messages m JOIN users f ON m.faculty_id = f.id
           WHERE m.institution_id = ? GROUP BY f.id, f.name
           ORDER BY messages DESC LIMIT 10`),
        q(`SELECT e.title, e.event_date, COUNT(r.id) AS registrations
           FROM events e LEFT JOIN event_registrations r ON r.event_id = e.id
           WHERE e.institution_id = ? GROUP BY e.id ORDER BY registrations DESC LIMIT 10`),
        q(`SELECT DATE(created_at) AS day, COUNT(*) AS actions FROM audit_logs
           WHERE institution_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
           GROUP BY day ORDER BY day`),
        q(`SELECT
             (SELECT COUNT(*) FROM users WHERE institution_id = ? AND role='student') AS students,
             (SELECT COUNT(*) FROM users WHERE institution_id = ? AND role='faculty') AS faculty,
             (SELECT COUNT(*) FROM maintenance_requests WHERE institution_id = ?) AS maintenance_total,
             (SELECT COUNT(*) FROM messages WHERE institution_id = ?) AS messages_total,
             (SELECT COUNT(*) FROM events WHERE institution_id = ?) AS events_total,
             (SELECT COUNT(*) FROM lost_found_items WHERE institution_id = ?) AS lostfound_total`,
          [inst, inst, inst, inst, inst, inst])
      ]);

    res.json({
      totals: totals[0],
      maintenanceByCategory: byCategory,
      maintenanceByStatus: byStatus,
      avgResolutionHours: avgResolution[0]?.avg_hours ?? null,
      facultyResponse: topFaculty,
      eventPopularity,
      activityByDay
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not build analytics' });
  }
};
