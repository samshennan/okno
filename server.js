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

// Serve static files from public directory (for Phase 2 frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Mount auth routes
const authRouter = require('./auth');
app.use('/auth', authRouter);

// Mount picker routes
const pickerRouter = require('./picker');
app.use('/api/picker', pickerRouter);
logger.info('Picker routes mounted');

// Mount photo routes
const photoRouter = require('./photo-proxy');
app.use('/api/photo', photoRouter);

// Mount health routes
const healthRouter = require('./health');
app.use('/api/health', healthRouter);

// Mount feedback routes
const feedbackRouter = require('./feedback');
app.use('/api/feedback', feedbackRouter);

// Mount config module and API routes
const config = require('./config');
config.loadConfig();
logger.info('Config loaded:', config.getConfig());

app.get('/api/config', (req, res) => {
  res.json(config.getConfig());
});

app.post('/api/config', (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }
  const updated = config.saveConfig(updates);
  logger.info('Config updated:', updated);
  res.json(updated);
});

logger.info('Photo, health, feedback, and config routes mounted');

// Mount demo routes (fully isolated from auth/cache)
const demoRouter = require('./demo-photos');
app.use('/api/demo', demoRouter);

// Serve demo.html at /demo route
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'demo.html'));
});

logger.info('Demo routes mounted');

// Root route now served by static index.html in public/
// (removed inline HTML, using public/index.html instead)

// Start server
const PORT = process.env.PORT || 3100;
app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Session store: SQLite (data/okno.db)`);
});

// Export app for testing
module.exports = app;
