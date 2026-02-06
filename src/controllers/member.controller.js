const prisma = require("../config/prisma");
const emailService = require("../services/email.service");
const crypto = require("crypto");

exports.addMember = async (req, res, next) => {
    try {
        const { roomId } = req.params;
        const { email } = req.body;
        const adminId = req.user.userId;

        // Check if requester is Room Admin
        const room = await prisma.room.findUnique({ where: { id: parseInt(roomId) } });
        if (!room) return res.status(404).json({ message: "Room not found" });

        if (room.adminId !== adminId) {
            return res.status(403).json({ message: "Only room admin can add members" });
        }

        // Find user to add
        // Check if user exists
        let user = await prisma.user.findUnique({ where: { email } });

        // Get Admin Name
        const admin = await prisma.user.findUnique({ where: { id: adminId } });
        const adminName = admin ? admin.name : "Admin";

        // Check if user is already associated with ANY room (One Room Per User)
        if (user) {
            const [membership, adminRoom] = await Promise.all([
                prisma.roomMember.findFirst({
                    where: { userId: user.id },
                    include: { room: true }
                }),
                prisma.room.findFirst({
                    where: { adminId: user.id }
                })
            ]);

            if (membership || adminRoom) {
                const roomTitle = membership ? membership.room.title : adminRoom.title;
                return res.status(409).json({
                    message: `This user is already associated with room "${roomTitle}". Every user can only manage or belong to one room at a time.`
                });
            }
        }

        if (user) {
            // Check if already member
            const existingMember = await prisma.roomMember.findUnique({
                where: {
                    roomId_userId: {
                        roomId: parseInt(roomId),
                        userId: user.id
                    }
                }
            });

            if (existingMember) {
                return res.status(409).json({ message: "User is already a member" });
            }
        }

        const inviteToken = crypto.randomBytes(32).toString("hex");

        if (!user) {
            user = await prisma.user.create({
                data: {
                    name: req.body.name || "Roommate",
                    email,
                    passwordHash: null,
                    role: "MEMBER",
                    inviteToken,
                    isActive: false
                }
            });
        } else {
            await prisma.user.update({
                where: { id: user.id },
                data: { inviteToken }
            });
        }

        await prisma.roomMember.create({
            data: {
                roomId: parseInt(roomId),
                userId: user.id,
                paymentStatus: "UNPAID"
            }
        });

        // Send Invite Email
        await emailService.sendInviteEmail(email, room.title, adminName, inviteToken);

        return res.status(201).json({ message: "Member added. Invite email sent." });
    } catch (err) {
        next(err);
    }
};

exports.removeMember = async (req, res, next) => {
    try {
        const { roomId, userId } = req.params;
        const adminId = req.user.userId;

        // Check if requester is Room Admin
        const room = await prisma.room.findUnique({ where: { id: parseInt(roomId) } });
        if (!room) return res.status(404).json({ message: "Room not found" });

        if (room.adminId !== adminId) {
            return res.status(403).json({ message: "Only room admin can remove members" });
        }

        // Cannot remove self (Admin) ? PRD doesn't strict forbid, but usually bad.
        if (parseInt(userId) === adminId) {
            return res.status(400).json({ message: "Admin cannot remove themselves" });
        }

        await prisma.roomMember.delete({
            where: {
                roomId_userId: {
                    roomId: parseInt(roomId),
                    userId: parseInt(userId)
                }
            }
        });

        return res.status(200).json({ message: "Member removed" });
    } catch (err) {
        next(err);
    }
};

exports.markPaid = async (req, res, next) => {
    try {
        const { roomId, userId } = req.params;
        const { status } = req.body;
        const adminId = req.user.userId;

        const room = await prisma.room.findUnique({ where: { id: parseInt(roomId) } });
        if (!room) return res.status(404).json({ message: "Room not found" });
        if (room.adminId !== adminId) return res.status(403).json({ message: "Only room admin can mark payment" });

        if (status !== "PAID") return res.status(400).json({ message: "Invalid status" });

        await prisma.roomMember.update({
            where: { roomId_userId: { roomId: parseInt(roomId), userId: parseInt(userId) } },
            data: { paymentStatus: "PAID" }
        });

        // Check if ALL are PAID
        const unpaidMembers = await prisma.roomMember.count({
            where: {
                roomId: parseInt(roomId),
                paymentStatus: "UNPAID"
            }
        });

        if (unpaidMembers === 0) {
            const existingActive = await prisma.expenseCycle.findFirst({
                where: { roomId: parseInt(roomId), isClosed: false }
            });

            const tx = [];

            if (!existingActive) {
                tx.push(
                    prisma.expenseCycle.create({
                        data: {
                            roomId: parseInt(roomId),
                            totalAmount: 0,
                            isClosed: false,
                            isFrozen: false
                        }
                    })
                );
            }

            tx.push(
                prisma.roomMember.updateMany({
                    where: { roomId: parseInt(roomId) },
                    data: { paymentStatus: "UNPAID" }
                })
            );

            await prisma.$transaction(tx);

            return res.status(200).json({ message: "Payment updated. All paid -> New cycle started!" });
        }

        return res.status(200).json({ message: "Payment status updated" });
    } catch (err) {
        next(err);
    }
};
