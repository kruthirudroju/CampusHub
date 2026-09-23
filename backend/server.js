const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const pool = require('./config/db');
const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: origins, credentials: true }));

// Broad limiter; the auth routes add a stricter one of their own.
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'unreachable', error: err.message });
  }
});

app.use('/api/institutions', require('./routes/institutionRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/faculty', require('./routes/facultyRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/maintenance', require('./routes/maintenanceRoutes'));
app.use('/api/buses', require('./routes/busRoutes'));
app.use('/api/clubs', require('./routes/clubRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/lostfound', require('./routes/lostFoundRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));

app.use((req, res) => res.status(404).json({ message: 'Endpoint not found' }));

app.use((err, req, res, next) => {
  console.error('[unhandled]', err);
  const dev = process.env.NODE_ENV !== 'production';
  res.status(500).json({ message: 'Something went wrong', ...(dev && { error: err.message }) });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CampusHub API running on http://localhost:${PORT}`));
