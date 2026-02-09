const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
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

// Security headers
app.use(helmet());

// Request logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Session middleware with file store (1 year expiry for "forever" sessions)
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: new FileStore({
    path: './sessions',
    ttl: 86400 * 365  // 1 year
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

logger.info('Photo and health routes mounted');

// Basic root route
app.get('/', (req, res) => {
  res.send('<h1>Okno</h1><p>Google Photos digital photo frame backend</p><p><a href="/auth/login">Login with Google</a></p>');
});

// Start server
const PORT = process.env.PORT || 3100;
app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Session store: file (./sessions, ttl=1 year)`);
});

// Export app for testing
module.exports = app;
