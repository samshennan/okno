require('dotenv').config();

const path = require('path');
const fs = require('fs');

// Create logs directory before logger initialises (logger writes to logs/)
if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs', { recursive: true });
}

// Fail fast if critical environment variables are missing
const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'SESSION_SECRET'];
const missing = required.filter(v => !process.env[v]);
if (missing.length > 0) {
  // Use console.error here — logger not yet initialised
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const logger = require('./logger');

// Global error handlers — log and exit so PM2/Docker can restart cleanly
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  logger.error('Unhandled promise rejection', { error: message, stack });
  process.exit(1);
});

const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const db = require('./db/database');
const SqliteStore = require('better-sqlite3-session-store')(session);
const rateLimit = require('express-rate-limit');

// Create Express app
const app = express();

// Trust proxy - enables Express to see X-Forwarded-Proto from nginx
app.set('trust proxy', true);

// Security headers with CSP configured to allow inline scripts and event handlers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"],
      "script-src-attr": ["'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "font-src": ["'self'"],
      "img-src": ["'self'", "data:", "blob:"],
      "connect-src": ["'self'"],
    },
  },
}));

// Request logging middleware (replaces morgan)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// Session middleware with SQLite store (1 year expiry for "forever" sessions)
app.use(session({
  secret: process.env.SESSION_SECRET,
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
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000  // 1 year
  }
}));

// Parse JSON request bodies
app.use(express.json());

// Rate limiting -- auth endpoints (10 req/15min per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Too many attempts, please try again later' }
});

// --- Public routes (no auth required) ---

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Mount auth routes (handles its own auth flow)
const authRouter = require('./auth');
const { requireAuth } = require('./auth');
app.use('/auth/login', authLimiter);
app.use('/auth/callback', authLimiter);
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

logger.info('Auth-gated routes mounted (picker, photo, health, config)');

// Start server
const PORT = process.env.PORT || 3100;
const server = app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Session store: SQLite (data/okno.db)`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`FATAL: Port ${PORT} is already in use. Stop the existing process and try again.`);
  } else {
    logger.error('FATAL: Server error', { error: err.message, code: err.code });
  }
  process.exit(1);
});

// Export app for testing
module.exports = app;
