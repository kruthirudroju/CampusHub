const pool = require('../config/db');

/**
 * Records a change in audit_logs. Never throws -- an audit failure must not
 * break the user's actual request, so errors are logged and swallowed.
 */
async function recordAudit(req, {
  action,
  entityType,
  entityId = null,
  summary = null,
  before = null,
  after = null,
  institutionId = null,
  actor = null
}) {
  try {
    const user = actor || req.user || null;
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().slice(0, 64);
    const ua = (req.headers['user-agent'] || '').toString().slice(0, 255);

    await pool.query(
      `INSERT INTO audit_logs
        (institution_id, actor_id, actor_name, actor_role, action, entity_type,
         entity_id, summary, before_data, after_data, ip_address, user_agent)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        institutionId ?? user?.institutionId ?? null,
        user?.id ?? null,
        user?.name ?? null,
        user?.role ?? null,
        action,
        entityType,
        entityId === null ? null : String(entityId),
        summary ? String(summary).slice(0, 400) : null,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        ip || null,
        ua || null
      ]
    );
  } catch (err) {
    console.error('[audit] failed to record entry:', err.message);
  }
}

module.exports = { recordAudit };