/**
 * Seeds users from CSV files in ./data
 *   data/faculty.csv   -> columns incl. "Faculty Names", "Department"
 *   data/students.csv  -> columns incl. "Student Name", "Email Id", "Branch"
 *
 *   node scripts/seedUsers.js [institution-slug]
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
require('dotenv').config();

const SLUG = process.argv[2] || 'vardhaman';
const DEFAULT_PASSWORD = process.env.DEFAULT_SEED_PASSWORD || 'Campus@2026';

function parseCSV(file) {
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const o = {};
    header.forEach((h, i) => { o[h] = (cols[i] || '').trim(); });
    return o;
  });
}

const stripTitle = (n) => n.replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?)\s*/i, '').trim();

function emailFor(name, domain, used) {
  const base = stripTitle(name).toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).join('.');
  let email = `${base}@${domain}`, n = 1;
  while (used.has(email)) email = `${base}${n++}@${domain}`;
  used.add(email);
  return email;
}

async function main() {
  const [insts] = await pool.query('SELECT id, email_domains FROM institutions WHERE slug = ?', [SLUG]);
  if (insts.length === 0) throw new Error(`No institution with slug "${SLUG}". Run scripts/migrate.js first.`);
  const institutionId = insts[0].id;
  const domains = insts[0].email_domains.split(',').map((d) => d.trim());
  const facultyDomain = domains[0];

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const [existing] = await pool.query('SELECT email FROM users WHERE institution_id = ?', [institutionId]);
  const used = new Set(existing.map((r) => r.email));

  let inserted = 0, skipped = 0;

  const faculty = parseCSV(path.join(__dirname, '../data/faculty.csv'));
  if (faculty) {
    for (const row of faculty) {
      const name = row['Faculty Names'] || row['Name'] || row['name'];
      if (!name) continue;
      const dept = row['Department'] || row['department'] || null;
      const email = emailFor(name, facultyDomain, used);

      const [dupe] = await pool.query('SELECT id FROM users WHERE institution_id = ? AND email = ?', [institutionId, email]);
      if (dupe.length) { skipped++; continue; }

      const [r] = await pool.query(
        `INSERT INTO users (institution_id, name, email, password_hash, role, department, must_change_password)
         VALUES (?,?,?,?, 'faculty', ?, 1)`,
        [institutionId, stripTitle(name), email, hash, dept]
      );
      await pool.query('INSERT IGNORE INTO faculty_availability (faculty_id, status) VALUES (?, ?)',
        [r.insertId, 'Out of Office']);
      inserted++;
      console.log(`+ faculty  ${stripTitle(name)} <${email}>`);
    }
  } else console.log('- data/faculty.csv not found, skipping faculty');

  const students = parseCSV(path.join(__dirname, '../data/students.csv'));
  if (students) {
    for (const row of students) {
      const name = row['Student Name'] || row['Name'] || row['name'];
      const email = (row['Email Id'] || row['Email'] || row['email'] || '').toLowerCase();
      if (!name || !email) continue;
      const dept = row['Branch'] || row['Department'] || null;
      const roll = row['Roll No'] || row['Roll Number'] || row['roll_number'] || null;

      const [dupe] = await pool.query('SELECT id FROM users WHERE institution_id = ? AND email = ?', [institutionId, email]);
      if (dupe.length) { skipped++; continue; }

      await pool.query(
        `INSERT INTO users (institution_id, name, email, password_hash, role, department, roll_number, must_change_password)
         VALUES (?,?,?,?, 'student', ?,?, 1)`,
        [institutionId, name, email, hash, dept, roll]
      );
      inserted++;
      console.log(`+ student  ${name} <${email}>`);
    }
  } else console.log('- data/students.csv not found, skipping students');

  console.log(`\nDone. Inserted ${inserted}, skipped ${skipped} existing.`);
  console.log(`Default password for new accounts: ${DEFAULT_PASSWORD}`);
  console.log('Everyone is flagged to change it on first sign-in.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
