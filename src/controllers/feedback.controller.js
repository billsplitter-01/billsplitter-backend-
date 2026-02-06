const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Submit new feedback
exports.submitFeedback = async (req, res) => {
    try {
        const { type, title, description, roomId } = req.body;
        const userId = req.user.userId;

        if (!type || !title || !description) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const feedback = await prisma.feedback.create({
            data: {
                userId,
                roomId: roomId ? parseInt(roomId) : null,
                type,
                title,
                description,
                status: 'OPEN'
            }
        });

        // Send Feedback Confirmation Email
        try {
            const emailService = require("../services/email.service");
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (user && user.email) {
                await emailService.sendFeedbackConfirmationEmail(user.email, user.name, title);
            }
        } catch (emailErr) {
            console.error("Feedback email failed:", emailErr);
        }

        res.status(201).json({ message: "Feedback submitted successfully", feedback });
    } catch (error) {
        console.error("Submit Feedback Error:", error);
        res.status(500).json({ message: "Failed to submit feedback", error: error.message });
    }
};

// Get all feedback (Super Admin only)
exports.getAllFeedback = async (req, res) => {
    try {
        const feedbackList = await prisma.feedback.findMany({
            include: {
                user: {
                    select: { name: true, email: true }
                },
                room: {
                    select: { title: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(feedbackList);
    } catch (error) {
        console.error("Get All Feedback Error:", error);
        res.status(500).json({ message: "Failed to fetch feedback", error: error.message });
    }
};

// Update feedback status (Super Admin only)
exports.updateFeedbackStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const feedback = await prisma.feedback.update({
            where: { id: parseInt(id) },
            data: { status }
        });

        res.status(200).json({ message: "Feedback status updated", feedback });
    } catch (error) {
        console.error("Update Feedback Status Error:", error);
        res.status(500).json({ message: "Failed to update status", error: error.message });
    }
};
