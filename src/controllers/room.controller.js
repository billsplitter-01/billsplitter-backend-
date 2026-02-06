const prisma = require("../config/prisma");
const emailService = require("../services/email.service"); // Import email service

exports.createRoom = async (req, res, next) => {
    try {
        const { title, threshold } = req.body;
        const adminId = req.user.userId;

        // Regex validation: Alphanumeric, spaces, underscores
        const alphanumericRegex = /^[a-zA-Z0-9\s_]+$/;
        if (!alphanumericRegex.test(title)) {
            return res.status(400).json({ message: "Room title must be alphanumeric (letters and numbers only) with spaces or underscores." });
        }

        // Check for existing room with same title
        const existingRoomTitle = await prisma.room.findUnique({ where: { title } });
        if (existingRoomTitle) {
            return res.status(409).json({ message: "Room name already exists. Please choose a unique name." });
        }

        // Check if user is already associated with ANY room (One Room Per User)
        const existingAssociation = await prisma.roomMember.findFirst({
            where: { userId: adminId },
            include: { room: true }
        });

        if (existingAssociation) {
            return res.status(400).json({
                message: `You are already associated with room "${existingAssociation.room.title}". One account can only manage or join one room at a time.`
            });
        }

        // Double check admin ownership just in case (though members check should cover it)
        const existingAdminRoom = await prisma.room.findFirst({ where: { adminId: adminId } });
        if (existingAdminRoom) {
            return res.status(400).json({ message: "You are already an admin of a room." });
        }

        const room = await prisma.room.create({
            data: {
                title,
                threshold: threshold || 1000,
                adminId: adminId,
                members: {
                    create: {
                        userId: adminId,
                        paymentStatus: "UNPAID"
                    }
                }
            },
        });

        await prisma.expenseCycle.create({
            data: {
                roomId: room.id,
                totalAmount: 0,
                isClosed: false,
                isFrozen: false
            }
        });

        return res.status(201).json({ message: "Room created successfully", roomId: room.id });
    } catch (err) {
        next(err);
    }
};

exports.sendRoomNotification = async (req, res, next) => {
    try {
        const { roomId } = req.params;
        const { subject, content, recipientIds } = req.body; // Changed input to accept recipientIds
        const adminId = req.user.userId;

        const room = await prisma.room.findUnique({
            where: { id: parseInt(roomId) }
        });

        if (!room) return res.status(404).json({ message: "Room not found" });
        if (room.adminId !== adminId) return res.status(403).json({ message: "Only admin can send notifications" });

        // Determine who to send to
        let recipientFilter = { roomId: parseInt(roomId) };
        if (recipientIds && Array.isArray(recipientIds) && recipientIds.length > 0) {
            recipientFilter.userId = { in: recipientIds.map(id => parseInt(id)) };
        }

        // Fetch members
        const members = await prisma.roomMember.findMany({
            where: recipientFilter,
            include: { user: { select: { email: true } } }
        });

        const admin = await prisma.user.findUnique({ where: { id: adminId } });
        const adminName = admin ? admin.name : "Admin";

        // Send emails
        const emailPromises = members.map(member =>
            emailService.sendManualEmail(member.user.email, room.title, subject || "Reminder", content || "Please check the dashboard.", adminName)
        );

        await Promise.all(emailPromises);

        res.status(200).json({ message: `Notification sent to ${members.length} members.` });
    } catch (err) {
        next(err);
    }
};

exports.getRooms = async (req, res, next) => {
    try {
        const { title, threshold } = req.body;
        const adminId = req.user.userId;

        // Check if user is a valid Room Admin (or App Admin who wants to create a room? PRD says Room Admin creates room)
        // Actually PRD says "Room Admin" role creates room.
        // The user registration logic assigns "MEMBER" unless email is specific.
        // Wait, if a user registers as MEMBER, how do they become ROOM_ADMIN?
        // PRD say: "Room Admin (One per room)".
        // Maybe creating a room PROMOTES them to Room Admin for that room?
        // OR they must already be ROOM_ADMIN?
        // Registration logic: specific email -> APP_ADMIN, else MEMBER.
        // So normal users are MEMBER.
        // PRD Section 4.1: "One room admin".
        // PRD Section 2.2: "Room Admin... Permissions: Create room".
        // This implies you need the role first? Or creating it gives you the role?
        // Let's assume for now that creating a room effectively makes you the admin of that room.
        // But the User model has a `role` field.
        // If I am a MEMBER and I create a room, do I become ROOM_ADMIN globally? Or just for that room?
        // The schema has `Role` enum. It seems to be a global role.
        // Interpretation: Any MEMBER can create a room, and they become the admin of that room.
        // However, strict reading of 2.2: "Room Admin ... Permissions: Create room".
        // If I restrict `createRoom` to `ROOM_ADMIN` role only, then a `MEMBER` cannot create a room.
        // This creates a chicken-egg problem unless an APP_ADMIN promotes them.
        // BUT, usually in these apps, anyone can create a room.
        // I will allow MEMBER to create a room, and maybe user role upgrade isn't strictly necessary if `Room` model has `adminId`.
        // However, the PRD says "Room Admin... Permissions: Create room".
        // Let's stick to: "You must be authenticated".
        // If they create a room, they are the admin of that room.
        // I won't change their global role to ROOM_ADMIN unless necessary, but the schema has a global role.
        // Let's check `User` model again. `role Role`.
        // If I create a room, I should probably be upgraded to ROOM_ADMIN if I am just a MEMBER?
        // Or maybe the role is intended to be static?
        // Let's just allow authenticated users to create rooms for now, or check if they are NOT App Admin (App Admin shouldn't create rooms? PRD says "Cannot add expenses to rooms unless also a room admin").
        // Let's allow creation.

        // Regex validation: Alphanumeric only (letters and numbers)
        const alphanumericRegex = /^[a-zA-Z0-9]+$/;
        if (!alphanumericRegex.test(title)) {
            return res.status(400).json({ message: "Room title must be alphanumeric (letters and numbers only) with no spaces or special characters." });
        }

        // Check for existing room with same title
        const existingRoom = await prisma.room.findUnique({ where: { title } });
        if (existingRoom) {
            return res.status(409).json({ message: "Room name already exists. Please choose a unique name." });
        }


        const room = await prisma.room.create({
            data: {
                title,
                threshold: threshold || 1000,
                adminId: adminId,
                members: {
                    create: {
                        userId: adminId,
                        paymentStatus: "UNPAID"
                    }
                }
            },
        });


        return res.status(201).json({ message: "Room created successfully", roomId: room.id });
    } catch (err) {
        next(err);
    }
};



exports.getUserRooms = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const rooms = await prisma.room.findMany({
            where: {
                OR: [
                    { adminId: userId },
                    { members: { some: { userId: userId } } }
                ]
            },
            include: {
                _count: { select: { members: true } }
            }
        });
        return res.status(200).json(rooms);
    } catch (err) {
        next(err);
    }
};

exports.getRoomDetails = async (req, res, next) => {
    try {
        const { roomId } = req.params;
        const room = await prisma.room.findUnique({
            where: { id: parseInt(roomId) },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, name: true, email: true } }
                    }
                },
                admin: { select: { id: true, name: true, email: true } }
            }
        });

        if (!room) return res.status(404).json({ message: "Room not found" });

        // Basic Access Check (User must be member or admin)
        const userId = req.user.userId;
        const isMember = room.members.some(m => m.userId === userId);
        const isAdmin = room.adminId === userId;

        if (!isMember && !isAdmin && req.user.role !== 'APP_ADMIN') {
            return res.status(403).json({ message: "Access denied" });
        }

        return res.status(200).json(room);
    } catch (err) {
        next(err);
    }
};

exports.getAllRooms = async (req, res, next) => {
    try {
        // Only APP_ADMIN
        const rooms = await prisma.room.findMany({
            include: {
                admin: {
                    select: {
                        name: true,
                        email: true
                    }
                },
                _count: {
                    select: { members: true }
                }
            }
        });
        return res.status(200).json(rooms);
    } catch (err) {
        next(err);
    }
};

exports.deleteRoom = async (req, res, next) => {
    try {
        const { roomId } = req.params;
        // APP_ADMIN only
        // Cascade delete is not set in Prisma, so we might need to delete related data or use onDelete: Cascade in schema.
        // I didn't add onDelete: Cascade in schema. I should probably handle it or update schema.
        // For now, let's try to delete. If it fails, I'll update schema.
        // Actually, manual cleanup is safer.

        // Deleting room requires deleting: RoomMember, Expense, ExpenseCycle, Message.
        // Transactional delete.

        await prisma.$transaction([
            prisma.roomMember.deleteMany({ where: { roomId: parseInt(roomId) } }),
            prisma.expense.deleteMany({ where: { roomId: parseInt(roomId) } }),
            prisma.expenseCycle.deleteMany({ where: { roomId: parseInt(roomId) } }),
            prisma.message.deleteMany({ where: { roomId: parseInt(roomId) } }),
            prisma.room.delete({ where: { id: parseInt(roomId) } })
        ]);

        return res.status(200).json({ message: "Room deleted successfully" });
    } catch (err) {
        next(err);
    }
};

exports.updateRoom = async (req, res, next) => {
    try {
        const { roomId } = req.params;
        const { threshold } = req.body;
        const adminId = req.user.userId;

        // Find Room
        const room = await prisma.room.findUnique({ where: { id: parseInt(roomId) } });
        if (!room) return res.status(404).json({ message: "Room not found" });

        // Check Authorization (Only Admin)
        if (room.adminId !== adminId) {
            return res.status(403).json({ message: "Only the room admin can update settings." });
        }

        // Update
        const updatedRoom = await prisma.room.update({
            where: { id: parseInt(roomId) },
            data: {
                threshold: threshold ? parseInt(threshold) : undefined
            }
        });

        return res.status(200).json({ message: "Room updated successfully", room: updatedRoom });
    } catch (err) {
        next(err);
    }
};

exports.notifyMembers = async (req, res, next) => {
    try {
        const { roomId } = req.params;
        const { subject, content } = req.body;
        const adminId = req.user.userId;

        const room = await prisma.room.findUnique({ where: { id: parseInt(roomId) } });
        if (!room) return res.status(404).json({ message: "Room not found" });
        if (room.adminId !== adminId) return res.status(403).json({ message: "Only room admin can notify members" });

        // Fetch Members Emails
        const members = await prisma.roomMember.findMany({
            where: { roomId: room.id },
            include: { user: { select: { email: true } } }
        });

        const emailList = members.map(m => m.user.email);

        // Get Admin Name
        const admin = await prisma.user.findUnique({ where: { id: adminId } });
        const adminName = admin ? admin.name : "Admin";

        const emailService = require("../services/email.service");
        for (const email of emailList) {
            await emailService.sendManualEmail(email, room.title, subject, content, adminName);
        }

        return res.status(200).json({ message: "Emails sent to all members" });
    } catch (err) {
        next(err);
    }
};

exports.deleteRoomByAdmin = async (req, res, next) => {
    try {
        const { roomId } = req.params;
        const { password } = req.body;
        const adminId = req.user.userId;

        if (!password) {
            return res.status(400).json({ message: "Password is required to delete the room." });
        }

        // 1. Fetch Room and Admin
        const room = await prisma.room.findUnique({
            where: { id: parseInt(roomId) },
            include: { admin: true }
        });

        if (!room) return res.status(404).json({ message: "Room not found" });

        // 2. Verify Authorization (Only the specific admin can delete)
        if (room.adminId !== adminId) {
            return res.status(403).json({ message: "Only the room admin can delete this room." });
        }

        // 3. Verify Password
        const bcrypt = require("bcryptjs");
        const isMatch = await bcrypt.compare(password, room.admin.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect password. Room deletion aborted." });
        }

        // 4. Perform Transactional Cleanup
        await prisma.$transaction([
            prisma.roomMember.deleteMany({ where: { roomId: room.id } }),
            prisma.expense.deleteMany({ where: { roomId: room.id } }),
            prisma.expenseCycle.deleteMany({ where: { roomId: room.id } }),
            prisma.message.deleteMany({ where: { roomId: room.id } }),
            prisma.feedback.deleteMany({ where: { roomId: room.id } }), // Delete Feedbacks
            prisma.notification.deleteMany({ where: { userId: room.adminId } }), // Clean notifications for admin
            prisma.room.delete({ where: { id: room.id } }),
            prisma.user.delete({ where: { id: room.adminId } }) // Delete Admin Account
        ]);

        return res.status(200).json({ message: "Room and Admin Account permanently deleted." });
    } catch (err) {
        next(err);
    }
};
