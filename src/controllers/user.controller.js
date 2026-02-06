const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");

exports.updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { name, email } = req.body;

        // Basic validation
        if (!name || !email) {
            return res.status(400).json({ message: "Name and email are required" });
        }

        // Check if email is being changed and if it's already taken
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser && existingUser.id !== userId) {
            return res.status(409).json({ message: "Email already in use" });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { name, email }
        });

        // Return updated user info (excluding password)
        return res.status(200).json({
            message: "Profile updated successfully",
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.changePassword = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: "Old and new passwords are required" });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ message: "New password must be at least 8 characters" });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });

        // Verify old password
        const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect old password" });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: hashedPassword }
        });

        return res.status(200).json({ message: "Password changed successfully" });
    } catch (err) {
        next(err);
    }
};
