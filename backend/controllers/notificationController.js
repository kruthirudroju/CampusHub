const pool = require('../config/db');

/** GET /api/notifications -- computed live from the other tables */
exports.getNotifications = async (req, res) => {
  try {
    const { id: userId, role, institutionId } = req.user;
    const [u] = await pool.query('SELECT last_checked_notifications FROM users WHERE id = ?', [userId]);
    const since = u[0]?.last_checked_notifications || '1970-01-01 00:00:00';

    let items = [];

    if (role === 'student') {
      const [answered] = await pool.query(
        `SELECT m.id, m.subject, m.replied_at AS at, f.name AS faculty_name
         FROM messages m JOIN users f ON m.faculty_id = f.id
         WHERE m.student_id = ? AND m.status='Answered' AND m.replied_at > ?`, [userId, since]);

      const [maint] = await pool.query(
        `SELECT id, category, location, status, updated_at AS at
         FROM maintenance_requests
         WHERE reported_by = ? AND updated_at > ? AND status <> 'Pending'`, [userId, since]);

      const [posts] = await pool.query(
        `SELECT cp.id, cp.title, cp.type, c.club_name, cp.created_at AS at
         FROM club_posts cp JOIN clubs c ON cp.club_id = c.id
         WHERE c.institution_id = ? AND cp.created_at > ?
         ORDER BY cp.created_at DESC LIMIT 20`, [institutionId, since]);

      const [events] = await pool.query(
        `SELECT id, title, event_date, created_at AS at FROM events
         WHERE institution_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 10`,
        [institutionId, since]);

      items = [
        ...answered.map((m) => ({ type: 'message', link: 'messages',
          text: `${m.faculty_name} replied to "${m.subject || 'your query'}"`, at: m.at })),
        ...maint.map((m) => ({ type: 'maintenance', link: 'maintenance',
          text: `Your ${m.category} report at ${m.location} is now ${m.status}`, at: m.at })),
        ...posts.map((p) => ({ type: 'club', link: 'clubs',
          text: `${p.club_name} posted a ${p.type.toLowerCase()}: ${p.title}`, at: p.at })),
        ...events.map((e) => ({ type: 'event', link: 'events',
          text: `New campus event: ${e.title}`, at: e.at }))
      ];
    }

    if (role === 'faculty') {
      const [pending] = await pool.query(
        `SELECT m.id, m.subject, s.name AS student_name, m.created_at AS at
         FROM messages m JOIN users s ON m.student_id = s.id
         WHERE m.faculty_id = ? AND m.status='Pending' AND m.created_at > ?`, [userId, since]);

      const [events] = await pool.query(
        `SELECT id, title, created_at AS at FROM events
         WHERE institution_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 10`,
        [institutionId, since]);

      items = [
        ...pending.map((m) => ({ type: 'message', link: 'inbox',
          text: `New query from ${m.student_name}: ${m.subject || '(no subject)'}`, at: m.at })),
        ...events.map((e) => ({ type: 'event', link: 'events', text: `New campus event: ${e.title}`, at: e.at }))
      ];
    }

    if (role === 'admin') {
      const [reqs] = await pool.query(
        `SELECT mr.id, mr.category, mr.location, mr.priority, u.name, mr.created_at AS at
         FROM maintenance_requests mr JOIN users u ON mr.reported_by = u.id
         WHERE mr.institution_id = ? AND mr.created_at > ?`, [institutionId, since]);

      const [fb] = await pool.query(
        `SELECT id, category, created_at AS at FROM feedback
         WHERE institution_id = ? AND created_at > ?`, [institutionId, since]);

      const [lf] = await pool.query(
        `SELECT id, kind, item_name, created_at AS at FROM lost_found_items
         WHERE institution_id = ? AND created_at > ?`, [institutionId, since]);

      items = [
        ...reqs.map((m) => ({ type: 'maintenance', link: 'maintenance',
          text: `${m.priority} priority ${m.category} report from ${m.name} at ${m.location}`, at: m.at })),
        ...fb.map((f) => ({ type: 'feedback', link: 'feedback',
          text: `New ${f.category} feedback submitted`, at: f.at })),
        ...lf.map((i) => ({ type: 'lostfound', link: 'lostfound',
          text: `${i.kind} item posted: ${i.item_name}`, at: i.at }))
      ];
    }

    items.sort((a, b) => new Date(b.at) - new Date(a.at));
    res.json({ count: items.length, notifications: items.slice(0, 40) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load notifications' });
  }
};

/** PUT /api/notifications/checked */
exports.markChecked = async (req, res) => {
  try {
    await pool.query('UPDATE users SET last_checked_notifications = NOW() WHERE id = ?', [req.user.id]);
    res.json({ message: 'Marked as seen' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update' });
  }
};
