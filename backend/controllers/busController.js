const pool = require('../config/db');

/** GET /api/buses?search=  -- buses with nested stops */
exports.getAllBuses = async (req, res) => {
  try {
    const [buses] = await pool.query(
      'SELECT * FROM bus_routes WHERE institution_id = ? ORDER BY LENGTH(bus_number), bus_number',
      [req.user.institutionId]
    );
    if (buses.length === 0) return res.json([]);

    const ids = buses.map((b) => b.id);
    const [stops] = await pool.query(
      `SELECT * FROM bus_stops WHERE bus_id IN (${ids.map(() => '?').join(',')}) ORDER BY bus_id, stop_order`,
      ids
    );

    const byBus = {};
    for (const s of stops) (byBus[s.bus_id] ||= []).push(s);

    let result = buses.map((b) => ({ ...b, stops: byBus[b.id] || [] }));

    // Search matches the bus number, route name, or any stop on that route.
    const search = (req.query.search || '').trim().toLowerCase();
    if (search) {
      result = result.filter((b) =>
        String(b.bus_number).toLowerCase().includes(search) ||
        (b.route_name || '').toLowerCase().includes(search) ||
        b.stops.some((s) => s.stop_name.toLowerCase().includes(search))
      );
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load bus routes' });
  }
};

/** GET /api/buses/:busId */
exports.getBusById = async (req, res) => {
  try {
    const [buses] = await pool.query('SELECT * FROM bus_routes WHERE id = ? AND institution_id = ?',
      [req.params.busId, req.user.institutionId]);
    if (buses.length === 0) return res.status(404).json({ message: 'Bus not found' });

    const [stops] = await pool.query('SELECT * FROM bus_stops WHERE bus_id = ? ORDER BY stop_order', [req.params.busId]);
    res.json({ ...buses[0], stops });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load the bus' });
  }
};
