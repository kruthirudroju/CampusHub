/**
 * Writes the full activity log to an Excel file on disk.
 *   node scripts/exportAudit.js [institution-slug] [output.xlsx]
 */
const path = require('path');
const ExcelJS = require('exceljs');
const pool = require('../config/db');

async function main() {
  const slug = process.argv[2] || 'vardhaman';
  const out = process.argv[3] || path.join(__dirname, `../exports/activity-${new Date().toISOString().slice(0,10)}.xlsx`);
  require('fs').mkdirSync(path.dirname(out), { recursive: true });

  const [insts] = await pool.query('SELECT id, name FROM institutions WHERE slug = ?', [slug]);
  if (insts.length === 0) throw new Error(`No institution with slug "${slug}"`);

  const [rows] = await pool.query(
    `SELECT id, created_at, actor_name, actor_role, action, entity_type, entity_id,
            summary, before_data, after_data, ip_address
     FROM audit_logs WHERE institution_id = ? ORDER BY created_at DESC`,
    [insts[0].id]);

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

  rows.forEach((r) => ws.addRow({
    ...r,
    created_at: r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '',
    before_data: r.before_data ? JSON.stringify(r.before_data) : '',
    after_data: r.after_data ? JSON.stringify(r.after_data) : ''
  }));
  ws.autoFilter = { from: 'A1', to: 'K1' };

  await wb.xlsx.writeFile(out);
  console.log(`Wrote ${rows.length} entries to ${out}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
