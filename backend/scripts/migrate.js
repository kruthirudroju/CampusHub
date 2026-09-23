/**
 * Upgrades an existing single-institution CampusHub database to the
 * multi-institution schema WITHOUT losing data.
 *
 *   node scripts/migrate.js
 *
 * Safe to re-run: every step checks whether it has already been applied.
 */
const pool = require('../config/db');

const DEFAULT_INSTITUTION = {
  slug: 'vardhaman',
  name: 'Vardhaman College of Engineering',
  short_name: 'VCE',
  city: 'Shamshabad',
  state: 'Telangana',
  website: 'https://www.vardhaman.org',
  email_domains: 'vardhaman.org,student.vardhaman.org',
  accent_color: '#8C2F39'
};

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function tableExists(table) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows.length > 0;
}

async function addColumn(table, column, definition) {
  if (!(await tableExists(table))) { console.log(`- ${table}: table absent, skipped`); return; }
  if (await columnExists(table, column)) { console.log(`- ${table}.${column}: already present`); return; }
  await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`+ ${table}.${column}: added`);
}

async function main() {
  console.log('CampusHub migration starting...\n');

  // 1. institutions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS institutions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(60) NOT NULL UNIQUE,
      name VARCHAR(180) NOT NULL,
      short_name VARCHAR(60),
      city VARCHAR(100),
      state VARCHAR(100),
      website VARCHAR(255),
      logo_url VARCHAR(255),
      accent_color VARCHAR(9) DEFAULT '#8C2F39',
      email_domains VARCHAR(400) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
  console.log('+ institutions table ready');

  const [inst] = await pool.query('SELECT id FROM institutions WHERE slug = ?', [DEFAULT_INSTITUTION.slug]);
  let institutionId;
  if (inst.length > 0) {
    institutionId = inst[0].id;
    console.log(`- default institution already exists (id ${institutionId})`);
  } else {
    const [r] = await pool.query(
      `INSERT INTO institutions (slug, name, short_name, city, state, website, email_domains, accent_color)
       VALUES (?,?,?,?,?,?,?,?)`,
      [DEFAULT_INSTITUTION.slug, DEFAULT_INSTITUTION.name, DEFAULT_INSTITUTION.short_name,
       DEFAULT_INSTITUTION.city, DEFAULT_INSTITUTION.state, DEFAULT_INSTITUTION.website,
       DEFAULT_INSTITUTION.email_domains, DEFAULT_INSTITUTION.accent_color]
    );
    institutionId = r.insertId;
    console.log(`+ default institution created (id ${institutionId})`);
  }

  // 2. audit log
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      institution_id INT NULL,
      actor_id INT NULL,
      actor_name VARCHAR(120),
      actor_role VARCHAR(20),
      action VARCHAR(60) NOT NULL,
      entity_type VARCHAR(60) NOT NULL,
      entity_id VARCHAR(60),
      summary VARCHAR(400),
      before_data JSON NULL,
      after_data JSON NULL,
      ip_address VARCHAR(64),
      user_agent VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY ix_audit_inst_time (institution_id, created_at),
      KEY ix_audit_entity (entity_type, entity_id),
      KEY ix_audit_actor (actor_id)
    ) ENGINE=InnoDB`);
  console.log('+ audit_logs table ready');

  // 3. new columns on users
  await addColumn('users', 'institution_id', `INT NOT NULL DEFAULT ${institutionId}`);
  await addColumn('users', 'roll_number', 'VARCHAR(40) NULL');
  await addColumn('users', 'phone', 'VARCHAR(20) NULL');
  await addColumn('users', 'must_change_password', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumn('users', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');
  await addColumn('users', 'failed_login_attempts', 'INT NOT NULL DEFAULT 0');
  await addColumn('users', 'locked_until', 'DATETIME NULL');
  await addColumn('users', 'last_login_at', 'DATETIME NULL');
  await addColumn('users', 'last_checked_notifications', 'TIMESTAMP NULL DEFAULT NULL');

  // 4. institution_id on every scoped table
  for (const t of ['messages', 'maintenance_requests', 'bus_routes', 'clubs']) {
    await addColumn(t, 'institution_id', `INT NOT NULL DEFAULT ${institutionId}`);
  }
  await addColumn('faculty_availability', 'note', 'VARCHAR(160) NULL');
  await addColumn('messages', 'read_at', 'DATETIME NULL');
  await addColumn('maintenance_requests', 'admin_note', 'VARCHAR(400) NULL');
  await addColumn('maintenance_requests', 'resolved_at', 'DATETIME NULL');
  await addColumn('club_posts', 'venue', 'VARCHAR(160) NULL');
  await addColumn('rooms', 'institution_id', `INT NOT NULL DEFAULT ${institutionId}`);
  await addColumn('bookings', 'institution_id', `INT NOT NULL DEFAULT ${institutionId}`);
  await addColumn('bookings', 'decided_by', 'INT NULL');

  // 5. backfill existing rows onto the default institution
  for (const t of ['users', 'messages', 'maintenance_requests', 'bus_routes', 'clubs']) {
    if (await tableExists(t)) {
      const [r] = await pool.query(
        `UPDATE ${t} SET institution_id = ? WHERE institution_id IS NULL OR institution_id = 0`,
        [institutionId]
      );
      if (r.affectedRows) console.log(`~ ${t}: ${r.affectedRows} row(s) linked to the institution`);
    }
  }

  // 6. tables introduced by the new modules
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      institution_id INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      category ENUM('Fest','Guest Lecture','Placement','Workshop','Sports','Exam Notice','Other') DEFAULT 'Other',
      venue VARCHAR(160),
      event_date DATE NOT NULL,
      start_time TIME NULL,
      end_time TIME NULL,
      organizer VARCHAR(160),
      registration_open TINYINT(1) DEFAULT 1,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY ix_ev_inst_date (institution_id, event_date)
    ) ENGINE=InnoDB`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT NOT NULL,
      user_id INT NOT NULL,
      registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_reg (event_id, user_id)
    ) ENGINE=InnoDB`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lost_found_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      institution_id INT NOT NULL,
      kind ENUM('Lost','Found') NOT NULL,
      item_name VARCHAR(160) NOT NULL,
      category VARCHAR(80),
      location VARCHAR(160),
      occurred_on DATE NULL,
      description TEXT,
      contact_info VARCHAR(160),
      status ENUM('Open','Claimed','Closed') DEFAULT 'Open',
      reported_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY ix_lf_inst (institution_id, kind, status)
    ) ENGINE=InnoDB`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS club_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      club_id INT NOT NULL,
      user_id INT NOT NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_member (club_id, user_id)
    ) ENGINE=InnoDB`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      institution_id INT NOT NULL,
      category ENUM('Facilities','Academics','Transport','Canteen','Safety','Other') DEFAULT 'Other',
      message TEXT NOT NULL,
      is_anonymous TINYINT(1) DEFAULT 1,
      submitted_by INT NULL,
      status ENUM('New','Reviewed','Actioned') DEFAULT 'New',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      institution_id INT NOT NULL,
      room_number VARCHAR(60) NOT NULL,
      room_type ENUM('Classroom','Seminar Hall','Lab','Meeting Room','Auditorium') NOT NULL,
      capacity INT,
      building VARCHAR(120),
      UNIQUE KEY uq_room (institution_id, room_number)
    ) ENGINE=InnoDB`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      institution_id INT NOT NULL,
      room_id INT NOT NULL,
      requested_by INT NOT NULL,
      purpose VARCHAR(200),
      booking_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      status ENUM('Pending','Approved','Rejected','Cancelled') DEFAULT 'Pending',
      decided_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY ix_bk_room_date (room_id, booking_date)
    ) ENGINE=InnoDB`);

  console.log('+ events, registrations, lost & found, club members, feedback, rooms, bookings ready');
  console.log('\nMigration complete. Existing users, messages, requests, buses and clubs are intact.');
}

main().then(() => process.exit(0)).catch((e) => { console.error('Migration failed:', e); process.exit(1); });
