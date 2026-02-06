const prisma = require("../config/prisma");

exports.closeCycle = async (req, res, next) => {
    try {
        const { roomId } = req.params;
        const { type } = req.body; // 'EXPENSE' or 'MONTHLY'
        const adminId = req.user.userId;

        const room = await prisma.room.findUnique({
            where: { id: parseInt(roomId) },
            include: { cycles: { where: { isClosed: false } } }
        });

        if (!room) return res.status(404).json({ message: "Room not found" });
        if (room.adminId !== adminId) return res.status(403).json({ message: "Only room admin can close cycle" });

        const activeCycle = room.cycles[0];
        if (!activeCycle) {
            return res.status(400).json({ message: "No active cycle to close" });
        }

        if (!activeCycle.isFrozen && activeCycle.totalAmount < room.threshold) {
            return res.status(400).json({ message: "Threshold not reached. You can close only after the cycle is frozen." });
        }

        // Transaction to close cycle (new cycle starts only after all paid)
        const updates = [
            prisma.expenseCycle.update({
                where: { id: activeCycle.id },
                data: {
                    isClosed: true,
                    isFrozen: true,
                    closedAt: new Date()
                }
            })
        ];

        if (type === 'MONTHLY') {
            updates.push(
                prisma.roomMember.updateMany({
                    where: { roomId: parseInt(roomId) },
                    data: { paymentStatus: "UNPAID" }
                })
            );
        }

        await prisma.$transaction(updates);

        return res.status(200).json({
            message: "Cycle closed. Waiting for payments."
        });
    } catch (err) {
        next(err);
    }
};
