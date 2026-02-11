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
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        logger.error(`Error cleaning up file: ${unlinkError.message}`);
      }
    }

    res.status(500).json({
      error: 'Failed to submit feedback',
      details: error.message
    });
  }
});

module.exports = router;
