const express = require("express");
const router = express.Router();
const roomController = require("../controllers/room.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const roleGuard = require("../middlewares/role.middleware");

// Create Room - Any authenticated user
router.post("/", authMiddleware, roomController.createRoom);

// Get My Rooms - Any authenticated user
router.get("/my", authMiddleware, roomController.getUserRooms);


// Get Room Details - Member or Admin
router.get("/:roomId", authMiddleware, roomController.getRoomDetails);

// Update Room - Room Admin only
router.patch("/:roomId", authMiddleware, roomController.updateRoom);

// Get All Rooms - App Admin only
router.get("/", authMiddleware, roleGuard(["APP_ADMIN"]), roomController.getAllRooms);

// Delete Room - App Admin only
router.delete("/:roomId", authMiddleware, roleGuard(["APP_ADMIN"]), roomController.deleteRoom);

// Secure Delete Room - Room Admin only (requires password)
router.post("/:roomId/delete-secure", authMiddleware, roomController.deleteRoomByAdmin);

// Member Routes
const memberController = require("../controllers/member.controller");
router.post("/:roomId/members", authMiddleware, memberController.addMember);
router.delete("/:roomId/members/:userId", authMiddleware, memberController.removeMember);
router.patch("/:roomId/members/:userId/payment", authMiddleware, memberController.markPaid);

// Expense Routes
const expenseController = require("../controllers/expense.controller");
router.post("/:roomId/expenses", authMiddleware, expenseController.addExpense);
router.get("/:roomId/expenses", authMiddleware, expenseController.getExpenses);

// Cycle Routes
const cycleController = require("../controllers/cycle.controller");
router.post("/:roomId/cycles/close", authMiddleware, cycleController.closeCycle);

// Message Routes
const messageController = require("../controllers/message.controller");
router.post("/:roomId/messages", authMiddleware, messageController.sendMessage);
router.get("/:roomId/messages", authMiddleware, messageController.getMessages);
router.patch("/:roomId/messages/read", authMiddleware, messageController.markAsRead);

// Analytics Routes
const analyticsController = require("../controllers/analytics.controller");
router.get("/:roomId/analytics/category", authMiddleware, analyticsController.getCategorySummary);
router.get("/:roomId/analytics/summary", authMiddleware, analyticsController.getCycleSummary);
router.get("/:roomId/analytics/monthly", authMiddleware, analyticsController.getMonthlyAnalytics);

// Notification Route
router.post("/:roomId/notify", authMiddleware, roomController.sendRoomNotification);

module.exports = router;
