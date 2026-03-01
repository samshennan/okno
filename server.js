require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const db = require('./db/database');
const SqliteStore = require('better-sqlite3-session-store')(session);
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Configure Winston logger with verbose logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
      return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: './logs/combined.log' })
  ]
});

// Create logs directory if it doesn't exist
if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs');
}

// Create Express app
const app = express();

// Trust proxy - enables Express to see X-Forwarded-Proto from nginx
app.set('trust proxy', true);

// Security headers with CSP configured to allow inline scripts and event handlers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      "script-src-attr": ["'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "img-src": ["'self'", "data:", "blob:"],
      "connect-src": ["'self'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
    },
  },
}));

// Request logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Session middleware with SQLite store (1 year expiry for "forever" sessions)
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: new SqliteStore({
    client: db,
    expired: {
      clear: true,
      intervalMs: 900000  // Clean expired sessions every 15 minutes
    }
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // true in production (HTTPS)
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60 * 1000  // 1 year
  }
}));

// Parse JSON request bodies
app.use(express.json());

// --- Public routes (no auth required) ---

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Mount auth routes (handles its own auth flow)
const authRouter = require('./auth');
const { requireAuth } = require('./auth');
app.use('/auth', authRouter);

// Demo routes (fully isolated from auth/cache)
const demoRouter = require('./demo-photos');
app.use('/api/demo', demoRouter);

app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'demo.html'));
});

logger.info('Public routes mounted (login, auth, demo)');

// --- Auth-gated page routes (must come BEFORE express.static) ---

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/slideshow.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'slideshow.html'));
});

app.get('/settings.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

// Static assets (CSS, JS, icons, manifest, sw.js, logo.svg, demo directory)
// index: false prevents express.static from serving index.html for /
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// --- Auth-gated API routes ---

const pickerRouter = require('./picker');
app.use('/api/picker', requireAuth, pickerRouter);

const photoRouter = require('./photo-proxy');
app.use('/api/photo', requireAuth, photoRouter);

const healthRouter = require('./health');
app.use('/api/health', requireAuth, healthRouter);

const feedbackRouter = require('./feedback');
app.use('/api/feedback', requireAuth, feedbackRouter);

const config = require('./config');

app.get('/api/config', requireAuth, (req, res) => {
  res.json(config.getConfig(req.session.userId));
});

app.post('/api/config', requireAuth, (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }
  const updated = config.saveConfig(req.session.userId, updates);
  logger.info('Config updated:', updated);
  res.json(updated);
});

logger.info('Auth-gated routes mounted (picker, photo, health, feedback, config)');

// Start server
const PORT = process.env.PORT || 3100;
app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Session store: SQLite (data/okno.db)`);
});

// Export app for testing
module.exports = app;
