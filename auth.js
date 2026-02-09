const express = require('express');
const router = express.Router();

// Placeholder routes - will be fully implemented in Task 3
router.get('/login', (req, res) => {
  res.send('Auth login route - will implement OAuth in Task 3');
});

router.get('/callback', (req, res) => {
  res.send('Auth callback route - will implement OAuth in Task 3');
});

router.get('/status', (req, res) => {
  res.json({ authenticated: false, hasTokens: false });
});

module.exports = router;
