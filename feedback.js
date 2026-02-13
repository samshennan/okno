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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './feedback/screenshots';
    if (!fs.existsSync('./feedback')) {
      fs.mkdirSync('./feedback');
    }
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
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
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

// POST /api/feedback - Submit feedback
router.post('/', upload.single('screenshot'), async (req, res) => {
  try {
    const { type, description, reason, email } = req.body;

    if (!type || !['bug', 'feature'].includes(type)) {
      return res.status(400).json({ error: 'Invalid feedback type' });
    }

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const timestamp = new Date().toISOString();
    const dateStr = new Date().toISOString().split('T')[0];

    // Create feedback directory structure
    const feedbackDir = './feedback';
    if (!fs.existsSync(feedbackDir)) {
      fs.mkdirSync(feedbackDir);
    }

    // Determine filename and content based on type
    let filename, content;

    if (type === 'bug') {
      filename = path.join(feedbackDir, 'bugs.md');

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
      const bugsJsonFile = path.join(feedbackDir, 'bugs.json');
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
        id: `bug-${Date.now()}`,
        timestamp,
        email: email || null,
        description,
        screenshot: req.file ? `./screenshots/${req.file.filename}` : null,
        status: 'pending', // pending, in-progress, resolved
        priority: 'normal'
      });

      fs.writeFileSync(bugsJsonFile, JSON.stringify(bugsData, null, 2));
      logger.info(`Bug saved to JSON (ID: bug-${Date.now()})`);

    } else if (type === 'feature') {
      filename = path.join(feedbackDir, 'feature-requests.md');

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
      const csvFile = path.join(feedbackDir, 'features.csv');

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
      const emailListFile = path.join(feedbackDir, 'email-list.txt');
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
      error: 'Failed to submit feedback',
      details: error.message
    });
  }
});

// Error handler for this router
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error(`Multer error: ${err.message}`);
    return res.status(400).json({
      error: 'File upload error',
      details: err.message
    });
  }

  if (err) {
    logger.error(`Feedback error: ${err.message}`);
    return res.status(err.status || 500).json({
      error: err.message || 'Internal server error'
    });
  }

  next();
});

module.exports = router;
