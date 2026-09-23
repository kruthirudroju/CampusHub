const pool = require('../config/db');
const { recordAudit } = require('../utils/audit');

/** Admin may post anywhere; a faculty coordinator only to their own club. */
async function canManageClub(user, clubId) {
  if (user.role === 'admin') return true;
  if (user.role !== 'faculty') return false;
  const [rows] = await pool.query('SELECT coordinator_id FROM clubs WHERE id = ? AND institution_id = ?',
    [clubId, user.institutionId]);
  return rows.length > 0 && rows[0].coordinator_id === user.id;
}

/** GET /api/clubs */
exports.getAllClubs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.club_name, c.club_type, c.description, c.coordinator_id,
              u.name AS coordinator_name,
              (SELECT COUNT(*) FROM club_members cm WHERE cm.club_id = c.id) AS member_count,
              (SELECT COUNT(*) FROM club_posts cp WHERE cp.club_id = c.id) AS post_count,
              EXISTS(SELECT 1 FROM club_members cm2 WHERE cm2.club_id = c.id AND cm2.user_id = ?) AS is_member
       FROM clubs c LEFT JOIN users u ON c.coordinator_id = u.id
       WHERE c.institution_id = ?
       ORDER BY c.club_type, c.club_name`,
      [req.user.id, req.user.institutionId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load clubs' });
  }
};

/** GET /api/clubs/:clubId */
exports.getClubById = async (req, res) => {
  try {
    const [clubs] = await pool.query(
      `SELECT c.id, c.club_name, c.club_type, c.description, c.coordinator_id,
              u.name AS coordinator_name, u.email AS coordinator_email,
              (SELECT COUNT(*) FROM club_members cm WHERE cm.club_id = c.id) AS member_count,
              EXISTS(SELECT 1 FROM club_members cm2 WHERE cm2.club_id = c.id AND cm2.user_id = ?) AS is_member
       FROM clubs c LEFT JOIN users u ON c.coordinator_id = u.id
       WHERE c.id = ? AND c.institution_id = ?`,
      [req.user.id, req.params.clubId, req.user.institutionId]
    );
    if (clubs.length === 0) return res.status(404).json({ message: 'Club not found' });

    const [posts] = await pool.query(
      `SELECT cp.*, u.name AS posted_by_name FROM club_posts cp
       JOIN users u ON cp.created_by = u.id
       WHERE cp.club_id = ? ORDER BY cp.created_at DESC`,
      [req.params.clubId]
    );

    res.json({ ...clubs[0], posts, canManage: await canManageClub(req.user, req.params.clubId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load the club' });
  }
};

/** POST /api/clubs/:clubId/join  and  DELETE .../leave */
exports.joinClub = async (req, res) => {
  try {
    await pool.query('INSERT IGNORE INTO club_members (club_id, user_id) VALUES (?,?)',
      [req.params.clubId, req.user.id]);
    await recordAudit(req, {
      action: 'CREATE', entityType: 'club_member', entityId: req.params.clubId,
      summary: `${req.user.name} joined club #${req.params.clubId}`
    });
    res.json({ message: 'Joined the club' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not join the club' });
  }
};

exports.leaveClub = async (req, res) => {
  try {
    await pool.query('DELETE FROM club_members WHERE club_id = ? AND user_id = ?',
      [req.params.clubId, req.user.id]);
    await recordAudit(req, {
      action: 'DELETE', entityType: 'club_member', entityId: req.params.clubId,
      summary: `${req.user.name} left club #${req.params.clubId}`
    });
    res.json({ message: 'Left the club' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not leave the club' });
  }
};

/** PUT /api/clubs/:clubId/coordinator (admin) */
exports.setCoordinator = async (req, res) => {
  try {
    const { facultyId } = req.body;
    if (facultyId) {
      const [f] = await pool.query("SELECT id FROM users WHERE id = ? AND role='faculty' AND institution_id = ?",
        [facultyId, req.user.institutionId]);
      if (f.length === 0) return res.status(404).json({ message: 'Faculty member not found' });
    }

    const [before] = await pool.query('SELECT coordinator_id FROM clubs WHERE id = ? AND institution_id = ?',
      [req.params.clubId, req.user.institutionId]);
    if (before.length === 0) return res.status(404).json({ message: 'Club not found' });

    await pool.query('UPDATE clubs SET coordinator_id = ? WHERE id = ? AND institution_id = ?',
      [facultyId || null, req.params.clubId, req.user.institutionId]);

    await recordAudit(req, {
      action: 'UPDATE', entityType: 'club', entityId: req.params.clubId,
      summary: `${req.user.name} changed the coordinator of club #${req.params.clubId}`,
      before: before[0], after: { coordinator_id: facultyId || null }
    });

    res.json({ message: 'Coordinator updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update the coordinator' });
  }
};

/** PUT /api/clubs/:clubId/description (admin or coordinator) */
exports.updateClubDescription = async (req, res) => {
  try {
    if (!(await canManageClub(req.user, req.params.clubId))) {
      return res.status(403).json({ message: 'You cannot edit this club' });
    }
    const [before] = await pool.query('SELECT description FROM clubs WHERE id = ?', [req.params.clubId]);
    await pool.query('UPDATE clubs SET description = ? WHERE id = ? AND institution_id = ?',
      [req.body.description || null, req.params.clubId, req.user.institutionId]);

    await recordAudit(req, {
      action: 'UPDATE', entityType: 'club', entityId: req.params.clubId,
      summary: `${req.user.name} updated the description of club #${req.params.clubId}`,
      before: before[0] || null, after: { description: req.body.description || null }
    });

    res.json({ message: 'Description updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update the description' });
  }
};

/** POST /api/clubs/:clubId/posts */
exports.createPost = async (req, res) => {
  try {
    if (!(await canManageClub(req.user, req.params.clubId))) {
      return res.status(403).json({ message: 'You cannot post to this club' });
    }
    const { type, title, description, event_date, venue } = req.body;
    if (!['Event', 'Contest', 'Announcement'].includes(type)) {
      return res.status(400).json({ message: 'type must be Event, Contest or Announcement' });
    }
    if (!title) return res.status(400).json({ message: 'title is required' });

    const [result] = await pool.query(
      `INSERT INTO club_posts (club_id, type, title, description, event_date, venue, created_by)
       VALUES (?,?,?,?,?,?,?)`,
      [req.params.clubId, type, title, description || null, event_date || null, venue || null, req.user.id]
    );

    await recordAudit(req, {
      action: 'CREATE', entityType: 'club_post', entityId: result.insertId,
      summary: `${req.user.name} posted "${title}" (${type}) to club #${req.params.clubId}`,
      after: { type, title, description: description || null, event_date: event_date || null, venue: venue || null }
    });

    res.status(201).json({ message: 'Posted', postId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not create the post' });
  }
};

/** DELETE /api/clubs/posts/:postId */
exports.deletePost = async (req, res) => {
  try {
    const [posts] = await pool.query('SELECT * FROM club_posts WHERE id = ?', [req.params.postId]);
    if (posts.length === 0) return res.status(404).json({ message: 'Post not found' });

    if (!(await canManageClub(req.user, posts[0].club_id))) {
      return res.status(403).json({ message: 'You cannot delete this post' });
    }

    await pool.query('DELETE FROM club_posts WHERE id = ?', [req.params.postId]);

    await recordAudit(req, {
      action: 'DELETE', entityType: 'club_post', entityId: req.params.postId,
      summary: `${req.user.name} deleted post "${posts[0].title}"`,
      before: posts[0]
    });

    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not delete the post' });
  }
};
