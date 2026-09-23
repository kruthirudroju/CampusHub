/**
 * Seeds bus routes + stops from data/bus_routes.csv.
 * Handles the "fill-down" export style where bus details appear only on
 * the first row of each bus and the following rows carry just the stop.
 *
 *   node scripts/seedBuses.js [institution-slug]
 */
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const SLUG = process.argv[2] || 'vardhaman';

function parseCSV(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return raw.split(/\r?\n/).filter((l) => l.trim() !== '')
    .slice(1).map((l) => l.split(',').map((c) => c.trim()));
}

async function main() {
  const [insts] = await pool.query('SELECT id FROM institutions WHERE slug = ?', [SLUG]);
  if (insts.length === 0) throw new Error(`No institution with slug "${SLUG}"`);
  const institutionId = insts[0].id;

  const file = path.join(__dirname, '../data/bus_routes.csv');
  if (!fs.existsSync(file)) throw new Error('data/bus_routes.csv not found');

  const rows = parseCSV(file);
  let currentBusNumber = null, busId = null, order = 0;

  for (const cols of rows) {
    const [busNumber, routeName, stopName, stopTime, gpsLink,
           driverName, driverPhone, inc1, inc1Phone, inc2, inc2Phone] = cols;

    if (busNumber) {
      currentBusNumber = busNumber;
      order = 0;

      const [ex] = await pool.query('SELECT id FROM bus_routes WHERE institution_id = ? AND bus_number = ?',
        [institutionId, busNumber]);
      if (ex.length) {
        busId = ex[0].id;
        await pool.query(
          `UPDATE bus_routes SET route_name=?, gps_link=?, driver_name=?, driver_phone=?,
             incharge1_name=?, incharge1_phone=?, incharge2_name=?, incharge2_phone=? WHERE id=?`,
          [routeName || null, gpsLink || null, driverName || null, driverPhone || null,
           inc1 || null, inc1Phone || null, inc2 || null, inc2Phone || null, busId]
        );
        console.log(`~ bus ${busNumber} updated`);
      } else {
        const [r] = await pool.query(
          `INSERT INTO bus_routes (institution_id, bus_number, route_name, gps_link, driver_name,
             driver_phone, incharge1_name, incharge1_phone, incharge2_name, incharge2_phone)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [institutionId, busNumber, routeName || null, gpsLink || null, driverName || null,
           driverPhone || null, inc1 || null, inc1Phone || null, inc2 || null, inc2Phone || null]
        );
        busId = r.insertId;
        console.log(`+ bus ${busNumber} (${routeName || 'no route name'})`);
      }
    }

    if (busId && stopName) {
      order++;
      await pool.query(
        `INSERT INTO bus_stops (bus_id, stop_order, stop_name, stop_time) VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE stop_name = VALUES(stop_name), stop_time = VALUES(stop_time)`,
        [busId, order, stopName, stopTime || null]
      );
    }
  }

  const [[{ b }]] = await pool.query('SELECT COUNT(*) AS b FROM bus_routes WHERE institution_id = ?', [institutionId]);
  const [[{ s }]] = await pool.query(
    'SELECT COUNT(*) AS s FROM bus_stops WHERE bus_id IN (SELECT id FROM bus_routes WHERE institution_id = ?)',
    [institutionId]);
  console.log(`\nDone. ${b} buses, ${s} stops.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
