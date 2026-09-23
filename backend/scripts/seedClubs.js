/**
 * Seeds the club list. Reads data/clubs.csv when present
 * (columns: club_name, club_type, coordinator_name, description),
 * otherwise falls back to the built-in Vardhaman list.
 *
 *   node scripts/seedClubs.js [institution-slug]
 */
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const SLUG = process.argv[2] || 'vardhaman';

const FALLBACK = [
  ['Elecsol Club','Technical'], ['Civista Club','Technical'], ['Cybersync Club','Technical'],
  ['Machines Club','Technical'], ['Rosnes Club','Technical'], ['Student Developers Club','Technical'],
  ['Gaming Club','Technical'], ['Literature and Books Club','Technical'], ['Robotics Club','Technical'],
  ['Connect Club','Technical'], ['MUN Soc','Technical'], ['Science and Spirituality','Technical'],
  ['Crew Capella','Cultural'], ['Nrutya','Cultural'], ['Fine Arts','Cultural'], ['Abhinaya','Cultural'],
  ['Capture Cliq','Cultural'], ['Sports Club','Cultural'], ['Otaku Club','Cultural'], ['V-Chef','Cultural'],
  ['Jouneyzia','Cultural'], ['Eco-Star','Cultural'], ['Vardhaman Unplugged','Cultural'], ['Cine Club','Cultural']
].map(([club_name, club_type]) => ({ club_name, club_type }));

function readCSV(file) {
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((l) => {
    const cols = l.split(',');
    const o = {};
    header.forEach((h, i) => { o[h] = (cols[i] || '').trim(); });
    return o;
  });
}

async function main() {
  const [insts] = await pool.query('SELECT id FROM institutions WHERE slug = ?', [SLUG]);
  if (insts.length === 0) throw new Error(`No institution with slug "${SLUG}"`);
  const institutionId = insts[0].id;

  const fromCsv = readCSV(path.join(__dirname, '../data/clubs.csv'));
  const clubs = fromCsv || FALLBACK;
  console.log(fromCsv ? 'Using data/clubs.csv' : 'Using the built-in club list');

  for (const c of clubs) {
    const name = c.club_name;
    const type = c.club_type === 'Cultural' ? 'Cultural' : 'Technical';
    if (!name) continue;

    let coordinatorId = null;
    if (c.coordinator_name) {
      const [f] = await pool.query(
        "SELECT id FROM users WHERE institution_id = ? AND role='faculty' AND name LIKE ? LIMIT 1",
        [institutionId, `%${c.coordinator_name.replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s*/i, '').trim()}%`]
      );
      if (f.length) coordinatorId = f[0].id;
      else console.log(`  ! coordinator "${c.coordinator_name}" not found for ${name}`);
    }

    const [ex] = await pool.query('SELECT id FROM clubs WHERE institution_id = ? AND club_name = ?',
      [institutionId, name]);
    if (ex.length) {
      await pool.query('UPDATE clubs SET club_type = ?, description = COALESCE(?, description), coordinator_id = COALESCE(?, coordinator_id) WHERE id = ?',
        [type, c.description || null, coordinatorId, ex[0].id]);
      console.log(`~ ${name} updated`);
    } else {
      await pool.query(
        'INSERT INTO clubs (institution_id, club_name, club_type, coordinator_id, description) VALUES (?,?,?,?,?)',
        [institutionId, name, type, coordinatorId, c.description || null]);
      console.log(`+ ${name} (${type})`);
    }
  }
  console.log('\nDone.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
