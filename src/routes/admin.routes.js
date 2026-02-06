const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleGuard = require('../middlewares/role.middleware');

// Middleware to verify if user is Super Admin in actual implementation
// For now, superAdminLogin returns a token, and other routes should verify it.
// We'll create a simple middleware here or just trust for prototype.
// Actually, let's just make the routes public for the frontend to hit easily OR assume frontend sends the token.

router.post('/login', adminController.superAdminLogin);
router.use(authMiddleware, roleGuard(['APP_ADMIN']));
router.post('/broadcast', adminController.broadcastEmail);
router.get('/stats', adminController.getStats);
router.get('/rooms', adminController.getAllRooms);
router.patch('/rooms/:roomId/ban', adminController.banRoom);
router.delete('/rooms/:roomId', adminController.deleteRoom);
router.delete('/rooms/:roomId/members/:userId', adminController.removeMemberFromRoom);

module.exports = router;
