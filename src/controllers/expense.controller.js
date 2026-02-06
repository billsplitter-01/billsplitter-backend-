const prisma = require("../config/prisma");

exports.addExpense = async (req, res, next) => {
    try {
        const { roomId } = req.params;
        const { itemName, amount, category, date } = req.body; // date is optional? PRD 5.1 fields: Item name, Amount, Category, Date.
        const adminId = req.user.userId;

        const room = await prisma.room.findUnique({
            where: { id: parseInt(roomId) },
            include: { cycles: { where: { isClosed: false } } }
        });

        if (!room) return res.status(404).json({ message: "Room not found" });
        if (room.adminId !== adminId) return res.status(403).json({ message: "Only room admin can add expenses" });

        let activeCycle = room.cycles[0];

        const numericAmount = Number(amount);
        if (!itemName || !category || !numericAmount || numericAmount <= 0) {
            return res.status(400).json({ message: "Item name, category, and positive amount are required" });
        }

        // If no active cycle, allow only if all members are paid
        if (!activeCycle) {
            const unpaidMembers = await prisma.roomMember.count({
                where: { roomId: room.id, paymentStatus: "UNPAID" }
            });
            if (unpaidMembers > 0) {
                return res.status(400).json({ message: "All members must be paid before starting a new cycle." });
            }

            activeCycle = await prisma.expenseCycle.create({
                data: {
                    roomId: room.id,
                    totalAmount: 0,
                    isFrozen: false,
                    isClosed: false
                }
            });
        }

        // Check if frozen/crossed already
        if (activeCycle.isFrozen || activeCycle.totalAmount >= room.threshold) {
            return res.status(400).json({ message: "Cycle threshold crossed. Please close the cycle first." });
        }

        // Add expense in transaction
        const newAmount = activeCycle.totalAmount + numericAmount;

        // Logic: If newAmount >= threshold, we treat it as crossed.
        const crossed = newAmount >= room.threshold;

        const [expense] = await prisma.$transaction([
            prisma.expense.create({
                data: {
                    roomId: room.id,
                    cycleId: activeCycle.id,
                    itemName,
                    amount: numericAmount,
                    category,
                    addedById: adminId,
                    createdAt: date ? new Date(date) : undefined
                }
            }),
            prisma.expenseCycle.update({
                where: { id: activeCycle.id },
                data: { totalAmount: newAmount, isFrozen: crossed ? true : undefined }
            })
        ]);

        if (crossed) {


            // 1. Mark Members UNPAID
            await prisma.roomMember.updateMany({
                where: { roomId: room.id },
                data: { paymentStatus: "UNPAID" }
            });

            // 2. Fetch Members Emails
            const members = await prisma.roomMember.findMany({
                where: { roomId: room.id },
                include: { user: { select: { email: true } } }
            });

            const emailList = members.map(m => m.user.email);

            // 3. Send Email & Create Notifications
            // Get Admin Name for the signature
            const admin = await prisma.user.findUnique({ where: { id: adminId } });
            const adminName = admin ? admin.name : "Admin";

            const emailService = require("../services/email.service");

            // Create in-app notifications for all members
            const notificationPromises = members.map(m =>
                prisma.notification.create({
                    data: {
                        userId: m.user.id || m.userId, // handle structure variation if any
                        content: `🚨 Alert: Budget Threshold (₹${room.threshold}) crossed! Total: ₹${newAmount}. Please settle payments.`,
                        type: 'WARNING'
                    }
                })
            );
            await Promise.all(notificationPromises);

            // Send to each member
            for (const email of emailList) {
                await emailService.sendThresholdEmail(email, room.title, newAmount, room.threshold, adminName);
            }
        }

        return res.status(201).json({ message: "Expense added", expense });
    } catch (err) {
        next(err);
    }
};

exports.getExpenses = async (req, res, next) => {
    try {
        const { roomId } = req.params;
        const userId = req.user.userId;

        // Check membership
        const member = await prisma.roomMember.findUnique({
            where: { roomId_userId: { roomId: parseInt(roomId), userId: parseInt(userId) } }
        });

        // Also admin can view? Admin is created as member in my logic?
        // If Admin wasn't added as Member explicitly in CreateRoom (I did add them), check roomId too.
        const room = await prisma.room.findUnique({ where: { id: parseInt(roomId) } });
        if (!room) return res.status(404).json({ message: "Room not found" });

        if (!member && room.adminId !== userId && req.user.role !== "APP_ADMIN") {
            return res.status(403).json({ message: "Access denied" });
        }

        const { currentCycle } = req.query;

        let whereClause = { roomId: parseInt(roomId) };

        if (currentCycle === 'true') {
            const activeCycle = await prisma.expenseCycle.findFirst({
                where: { roomId: parseInt(roomId), isClosed: false }
            });
            if (activeCycle) {
                whereClause.cycleId = activeCycle.id;
            } else {
                // If no active cycle (e.g. all closed), return empty or handle gracefully
                // returning expenses linked to 0 matches nothing? Or we can just return nothing.
                whereClause.cycleId = -1; // Dummy ID to return nothing
            }
        }

        const expenses = await prisma.expense.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });

        return res.status(200).json(expenses);
    } catch (err) {
        next(err);
    }
};
