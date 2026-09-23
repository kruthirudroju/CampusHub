const pool = require('../config/db');
const { recordAudit } = require('../utils/audit');

const CATEGORIES = ['Fest','Guest Lecture','Placement','Workshop','Sports','Exam Notice','Other'];

/** GET /api/events?scope=upcoming|past */
exports.listEvents = async (req, res) => {
  try {
    const scope = req.query.scope === 'past' ? 'past' : 'upcoming';
    const comparator = scope === 'past' ? '<' : '>=';
    const order = scope === 'past' ? 'DESC' : 'ASC';

    const [rows] = await pool.query(
      `SELECT e.*, u.name AS created_by_name,
              (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id) AS registration_count,
              EXISTS(SELECT 1 FROM event_registrations r2 WHERE r2.event_id = e.id AND r2.user_id = ?) AS is_registered
       FROM events e JOIN users u ON e.created_by = u.id
       WHERE e.institution_id = ? AND e.event_date ${comparator} CURDATE()
       ORDER BY e.event_date ${order} LIMIT 100`,
      [req.user.id, req.user.institutionId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load events' });
  }
};

/** POST /api/events (admin, faculty) */
exports.createEvent = async (req, res) => {
  try {
    const { title, description, category, venue, event_date, start_time, end_time, organizer } = req.body;
    if (!title || !event_date) return res.status(400).json({ message: 'title and event_date are required' });
    const cat = CATEGORIES.includes(category) ? category : 'Other';

    const [result] = await pool.query(
      `INSERT INTO events (institution_id, title, description, category, venue, event_date,
                           start_time, end_time, organizer, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [req.user.institutionId, title, description || null, cat, venue || null, event_date,
       start_time || null, end_time || null, organizer || req.user.name, req.user.id]
    );

    await recordAudit(req, {
      action: 'CREATE', entityType: 'event', entityId: result.insertId,
      summary: `${req.user.name} created the event "${title}" on ${event_date}`,
      after: { title, category: cat, venue: venue || null, event_date }
    });

    res.status(201).json({ message: 'Event created', eventId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not create the event' });
  }
};

/** DELETE /api/events/:eventId (admin, or the faculty who created it) */
exports.deleteEvent = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM events WHERE id = ? AND institution_id = ?',
      [req.params.eventId, req.user.institutionId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Event not found' });
    if (req.user.role !== 'admin' && rows[0].created_by !== req.user.id) {
      return res.status(403).json({ message: 'You cannot delete this event' });
    }

    await pool.query('DELETE FROM events WHERE id = ?', [req.params.eventId]);
    await recordAudit(req, {
      action: 'DELETE', entityType: 'event', entityId: req.params.eventId,
      summary: `${req.user.name} deleted the event "${rows[0].title}"`, before: rows[0]
    });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not delete the event' });
  }
};

/** POST /api/events/:eventId/register  |  DELETE to cancel */
exports.register = async (req, res) => {
  try {
    const [ev] = await pool.query('SELECT title, registration_open FROM events WHERE id = ? AND institution_id = ?',
      [req.params.eventId, req.user.institutionId]);
    if (ev.length === 0) return res.status(404).json({ message: 'Event not found' });
    if (!ev[0].registration_open) return res.status(400).json({ message: 'Registration is closed for this event' });

    await pool.query('INSERT IGNORE INTO event_registrations (event_id, user_id) VALUES (?,?)',
      [req.params.eventId, req.user.id]);

    await recordAudit(req, {
      action: 'CREATE', entityType: 'event_registration', entityId: req.params.eventId,
      summary: `${req.user.name} registered for "${ev[0].title}"`
    });

    res.json({ message: 'Registered' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not register' });
  }
};

exports.unregister = async (req, res) => {
  try {
    await pool.query('DELETE FROM event_registrations WHERE event_id = ? AND user_id = ?',
      [req.params.eventId, req.user.id]);
    await recordAudit(req, {
      action: 'DELETE', entityType: 'event_registration', entityId: req.params.eventId,
      summary: `${req.user.name} cancelled their registration`
    });
    res.json({ message: 'Registration cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not cancel the registration' });
  }
};
