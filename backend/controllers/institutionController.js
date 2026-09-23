const pool = require('../config/db');

/** Public: list institutions for the landing page */
exports.listInstitutions = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, slug, name, short_name, city, state, website, logo_url, accent_color
       FROM institutions WHERE is_active = 1 ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load institutions' });
  }
};

/** Public: one institution by slug (used to brand the login page) */
exports.getInstitutionBySlug = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, slug, name, short_name, city, state, website, logo_url, accent_color, email_domains
       FROM institutions WHERE slug = ? AND is_active = 1`,
      [req.params.slug]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Institution not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load institution' });
  }
};
