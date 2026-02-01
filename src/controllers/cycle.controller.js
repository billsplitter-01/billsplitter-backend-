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

        // Transaction to close cycle and start a new one
        const updates = [
            prisma.expenseCycle.update({
                where: { id: activeCycle.id },
                data: {
                    isClosed: true,
                    closedAt: new Date()
                }
            }),
            prisma.expenseCycle.create({
                data: {
                    roomId: parseInt(roomId),
                    totalAmount: 0,
                    isClosed: false
                }
            })
        ];

        // Only reset payments if it's a MONTHLY closure
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
            message: type === 'MONTHLY'
                ? "Month closed. All payments reset."
                : "Expense cycle closed. Payments maintained."
        });

        // Notify members? (Phase 9)


        return res.status(200).json({ message: "Cycle closed. Waiting for payments." });
    } catch (err) {
        next(err);
    }
};
