const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: './logs/feedback.log' })
  ]
});

const FEEDBACK_DIR = './feedback';
const SCREENSHOT_DIR = path.join(FEEDBACK_DIR, 'screenshots');
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_REASON_LENGTH = 2000;
const MAX_EMAIL_LENGTH = 254;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif']);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function normalizeText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir(SCREENSHOT_DIR);
    cb(null, SCREENSHOT_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'screenshot-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    const hasAllowedExtension = /\.(jpg|jpeg|png|gif)$/i.test(file.originalname);
    const hasAllowedMime = ALLOWED_IMAGE_TYPES.has(file.mimetype);
    if (!hasAllowedExtension || !hasAllowedMime) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

// POST /api/feedback - Submit feedback
router.post('/', upload.single('screenshot'), async (req, res) => {
  try {
    const type = normalizeText(req.body?.type, 20);
    const description = normalizeText(req.body?.description, MAX_DESCRIPTION_LENGTH);
    const reason = normalizeText(req.body?.reason, MAX_REASON_LENGTH);
    const email = normalizeText(req.body?.email, MAX_EMAIL_LENGTH);

    if (!type || !['bug', 'feature'].includes(type)) {
      return res.status(400).json({ error: 'Invalid feedback type' });
    }

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const timestamp = new Date().toISOString();
    const dateStr = new Date().toISOString().split('T')[0];
    const bugId = `bug-${Date.now()}`;

    // Create feedback directory structure
    ensureDir(FEEDBACK_DIR);

    // Determine filename and content based on type
    let filename, content;

    if (type === 'bug') {
      filename = path.join(FEEDBACK_DIR, 'bugs.md');

      content = `
## Bug Report - ${dateStr}

**Submitted:** ${timestamp}
**Email:** ${email || 'Not provided'}

### Description
${description}

${req.file ? `### Screenshot
![Screenshot](./screenshots/${req.file.filename})
` : ''}

---

`;

      logger.info(`Bug report received: ${description.substring(0, 50)}...`);

      // ALSO save to bugs.json for GSD integration
      const bugsJsonFile = path.join(FEEDBACK_DIR, 'bugs.json');
      let bugsData = [];

      if (fs.existsSync(bugsJsonFile)) {
        try {
          bugsData = JSON.parse(fs.readFileSync(bugsJsonFile, 'utf-8'));
        } catch (parseError) {
          logger.error(`Error parsing bugs.json: ${parseError.message}`);
          bugsData = [];
        }
      }

      bugsData.push({
        id: bugId,
        timestamp,
        email: email || null,
        description,
        screenshot: req.file ? `./screenshots/${req.file.filename}` : null,
        status: 'pending', // pending, in-progress, resolved
        priority: 'normal'
      });

      fs.writeFileSync(bugsJsonFile, JSON.stringify(bugsData, null, 2));
      logger.info(`Bug saved to JSON (ID: ${bugId})`);

    } else if (type === 'feature') {
      filename = path.join(FEEDBACK_DIR, 'feature-requests.md');

      content = `
## Feature Request - ${dateStr}

**Submitted:** ${timestamp}
**Email:** ${email || 'Not provided'}

### Feature Description
${description}

${reason ? `### Why It's Useful
${reason}
` : ''}

---

`;

      logger.info(`Feature request received: ${description.substring(0, 50)}...`);

      // ALSO save to features.csv for spreadsheet review
      const csvFile = path.join(FEEDBACK_DIR, 'features.csv');

      // Create CSV header if file doesn't exist
      if (!fs.existsSync(csvFile)) {
        fs.writeFileSync(csvFile, 'Timestamp,Email,Description,Reason\n');
      }

      // Escape CSV values (handle quotes and commas)
      const escapeCsv = (str) => {
        if (!str) return '';
        return `"${str.replace(/"/g, '""')}"`;
      };

      const csvRow = `${escapeCsv(timestamp)},${escapeCsv(email || 'Not provided')},${escapeCsv(description)},${escapeCsv(reason || 'Not provided')}\n`;

      fs.appendFileSync(csvFile, csvRow);
      logger.info('Feature request saved to CSV');
    }

    // Append to markdown file
    if (!fs.existsSync(filename)) {
      fs.writeFileSync(filename, `# ${type === 'bug' ? 'Bug Reports' : 'Feature Requests'}\n\n`);
    }
    fs.appendFileSync(filename, content);

    // If email provided, also append to email list
    if (email) {
      const emailListFile = path.join(FEEDBACK_DIR, 'email-list.txt');
      const emailEntry = `${email} - ${timestamp} - ${type}\n`;

      // Check if email already exists to avoid duplicates
      let emailExists = false;
      if (fs.existsSync(emailListFile)) {
        const existingEmails = fs.readFileSync(emailListFile, 'utf-8');
        emailExists = existingEmails.includes(email);
      }

      if (!emailExists) {
        fs.appendFileSync(emailListFile, emailEntry);
        logger.info(`Added email to list: ${email}`);
      }
    }

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      type
    });

  } catch (error) {
    logger.error(`Error submitting feedback: ${error.message}`);

    // Clean up uploaded file if there was an error
    if (req.file) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (unlinkError) {
        logger.error(`Error cleaning up file: ${unlinkError.message}`);
      }
    }

    return res.status(500).json({
      error: 'Failed to submit feedback'
    });
  }
});

// Error handler for this router
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error(`Multer error: ${err.message}`);
    return res.status(400).json({
      error: 'File upload error'
    });
  }

  if (err) {
    logger.error(`Feedback error: ${err.message}`);
    return res.status(err.status || 500).json({
      error: 'Internal server error'
    });
  }

  next();
});

module.exports = router;
