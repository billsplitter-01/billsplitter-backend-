const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedback.controller');
const authMiddleware = require('../middlewares/auth.middleware');
// Assuming existing auth middleware attaches user to req.user
// We might need a specific check for Super Admin or reuse existing logic if available.
// For now, I'll assume the controller handles permission checks or we just require generic auth for submission
// and I'll add a placeholder middleware for admin checks if not present.

const roleMiddleware = require('../middlewares/role.middleware');

// Routes
router.post('/', authMiddleware, feedbackController.submitFeedback);
router.get('/admin', authMiddleware, roleMiddleware(['APP_ADMIN']), feedbackController.getAllFeedback);
router.patch('/admin/:id', authMiddleware, roleMiddleware(['APP_ADMIN']), feedbackController.updateFeedbackStatus);

module.exports = router;
