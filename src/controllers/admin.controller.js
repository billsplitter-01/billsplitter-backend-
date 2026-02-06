const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const emailService = require('../services/email.service');

const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

exports.broadcastEmail = async (req, res) => {
    const { subject, message } = req.body;
    try {
        // Fetch all room admins (unique users who own a room)
        const rooms = await prisma.room.findMany({
            select: { adminId: true, admin: { select: { email: true, name: true } } },
            distinct: ['adminId']
        });

        const sendPromises = rooms.map(room => {
            if (room.admin && room.admin.email) {
                return emailService.sendManualEmail(room.admin.email, "System Broadcast", subject, message, "Super Admin");
            }
        });

        await Promise.all(sendPromises);

        res.status(200).json({ message: `Broadcast sent to ${rooms.length} admins` });
    } catch (error) {
        res.status(500).json({ message: 'Broadcast failed', error: error.message });
    }
};

const jwt = require('jsonwebtoken');

exports.superAdminLogin = async (req, res) => {
    const { email, password } = req.body;

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        return res.status(500).json({ message: 'Super Admin credentials not configured' });
    }

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        // Generate a real JWT for the super admin
        // Payload matches what authMiddleware expects (though it just sets req.user = decoded)
        // We'll give it a special role APP_ADMIN
        const token = jwt.sign(
            {
                userId: 'super-admin-id',
                email: ADMIN_EMAIL,
                role: 'APP_ADMIN',
                name: 'Super Admin'
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.status(200).json({
            message: 'Super Admin Login Successful',
            token: token,
            user: { name: 'Super Admin', email: ADMIN_EMAIL, role: 'APP_ADMIN' }
        });
    }

    return res.status(401).json({ message: 'Invalid Super Admin Credentials' });
};

exports.getStats = async (req, res) => {
    try {
        const roomCount = await prisma.room.count();
        const activeRoommates = await prisma.roomMember.count(); // Approximate active users

        res.status(200).json({
            roomCount,
            activeRoommates
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stats', error: error.message });
    }
};

exports.getAllRooms = async (req, res) => {
    try {
        const rooms = await prisma.room.findMany({
            include: {
                admin: {
                    select: { name: true, email: true }
                },
                members: {
                    include: {
                        user: { select: { id: true, name: true, email: true } }
                    }
                },
                _count: {
                    select: { members: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(rooms);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching rooms', error: error.message });
    }
};

exports.banRoom = async (req, res) => {
    const { roomId } = req.params;
    const { isBanned } = req.body; // Expect boolean

    try {
        const room = await prisma.room.update({
            where: { id: parseInt(roomId) },
            data: { isBanned }
        });
        res.status(200).json({ message: `Room ${isBanned ? 'banned' : 'unbanned'} successfully`, room });
    } catch (error) {
        res.status(500).json({ message: 'Error updating room status', error: error.message });
    }
};

exports.deleteRoom = async (req, res) => {
    const { roomId } = req.params;

    try {
        // Transaction to delete all related data first or use cascade if configured (Prisma handles cascade if schema set, but safe to be explicit here if needed)
        // For now, assuming cascade delete is NOT set up in DB, we rely on Prisman or manual. 
        // Let's rely on Prisma cascade if relation exists, else manual.
        // Prisma schema usually doesn't cascade by default unless specified.

        // Delete dependencies first manually to be safe
        const rId = parseInt(roomId);

        // Fetch room to get adminId
        const room = await prisma.room.findUnique({ where: { id: rId } });
        if (!room) return res.status(404).json({ message: 'Room not found' });

        // Transactional Deep Delete
        await prisma.$transaction([
            prisma.roomMember.deleteMany({ where: { roomId: rId } }),
            prisma.expense.deleteMany({ where: { roomId: rId } }),
            prisma.expenseCycle.deleteMany({ where: { roomId: rId } }),
            prisma.message.deleteMany({ where: { roomId: rId } }),
            prisma.feedback.deleteMany({ where: { roomId: rId } }), // Delete Feedbacks
            prisma.notification.deleteMany({ where: { userId: room.adminId } }), // Clean notifications for admin
            prisma.room.delete({ where: { id: rId } }),
            prisma.user.delete({ where: { id: room.adminId } }) // Delete Admin Account
        ]);

        res.status(200).json({ message: 'Room and all associated data (including Admin Account) deleted successfully' });
    } catch (error) {
        // If user already deleted or other error, handle gracefully
        console.error("Delete failed:", error);
        res.status(500).json({ message: 'Error deleting room', error: error.message });
    }
};

exports.removeMemberFromRoom = async (req, res) => {
    const { roomId, userId } = req.params;
    try {
        const rId = parseInt(roomId);
        const uId = parseInt(userId);

        // Check if user is the admin of the room
        const room = await prisma.room.findUnique({ where: { id: rId } });
        if (room && room.adminId === uId) {
            return res.status(400).json({ message: 'Cannot remove the Room Admin. Change admin first or delete the room.' });
        }

        const deleteResult = await prisma.roomMember.deleteMany({
            where: {
                roomId: rId,
                userId: uId
            }
        });

        if (deleteResult.count === 0) {
            return res.status(404).json({ message: 'Member not found in this room' });
        }

        res.status(200).json({ message: 'Member removed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error removing member', error: error.message });
    }
};
