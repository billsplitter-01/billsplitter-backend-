const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { registerSchema, loginSchema } = require("../validators/auth.validator");

exports.register = async (req, res, next) => {
    try {
        const { error } = registerSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const { name, email, password, roomName } = req.body;

        const existingUser = await prisma.user.findUnique({
            where: { email },
            include: {
                roomsCreated: { select: { id: true } },
                memberships: { select: { id: true } }
            }
        });

        if (existingUser) {
            // Check if they are already associated with any room
            if (existingUser.roomsCreated.length > 0 || existingUser.memberships.length > 0) {
                return res.status(409).json({
                    message: "User is already associated with a room. One account can only manage or join one room at a time."
                });
            }
            return res.status(409).json({ message: "Email already registered" });
        }

        // Check Room Name uniqueness if provided
        if (roomName) {
            const existingRoomName = await prisma.room.findUnique({ where: { title: roomName } });
            if (existingRoomName) {
                return res.status(409).json({ message: "Room name already taken. Please choose another." });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let role =
            email === "vamshipotharaveni123@gmail.com" ? "APP_ADMIN" : "MEMBER";

        if (roomName && role === "MEMBER") {
            role = "ROOM_ADMIN";
        }

        const user = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash: hashedPassword,
                role,
            },
        });

        // Create Room if roomName provided
        if (roomName) {
            const room = await prisma.room.create({
                data: {
                    title: roomName,
                    threshold: 1000, // Default
                    adminId: user.id,
                    members: {
                        create: {
                            userId: user.id,
                            paymentStatus: "UNPAID"
                        }
                    }
                }
            });

            await prisma.expenseCycle.create({
                data: {
                    roomId: room.id,
                    totalAmount: 0,
                    isClosed: false,
                    isFrozen: false
                }
            });

        }

        return res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        next(err);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { error } = loginSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive)
            return res.status(403).json({ message: "User not registered or inactive" });

        if (!user.passwordHash)
            return res.status(403).json({ message: "Account not activated. Please accept the invite via email." });

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch)
            return res.status(401).json({ message: "Invalid credentials" });

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        return res.status(200).json({
            token,
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
            },
        });
    } catch (err) {
        next(err);
    }
};

exports.loginRoommate = async (req, res, next) => {
    try {
        const { error } = require("../validators/auth.validator").roommateLoginSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const { email, password } = req.body;

        // 1. Find the User
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive)
            return res.status(403).json({ message: "User not registered or inactive" });

        if (!user.passwordHash)
            return res.status(403).json({ message: "Account not activated. Please accept the invite via email." });

        // 2. Verify Password
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch)
            return res.status(401).json({ message: "Invalid credentials" });

        // 3. Find Room Membership
        // We find the first room they are a member of.
        const membership = await prisma.roomMember.findFirst({
            where: { userId: user.id },
            include: { room: true }
        });

        if (!membership) {
            return res.status(403).json({ message: "You are not a member of any room" });
        }

        const room = membership.room;

        if (room.isBanned) {
            return res.status(403).json({ message: "This room has been banned by the Super Admin. Please contact support." });
        }

        // 4. Generate Token
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        return res.status(200).json({
            token,
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
            },
            room: {
                id: room.id,
                title: room.title
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.acceptInvite = async (req, res, next) => {
    try {
        const { token, password, name } = req.body;
        if (!token || !password) return res.status(400).json({ message: "Token and password required" });
        if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

        const user = await prisma.user.findUnique({ where: { inviteToken: token } });
        if (!user) return res.status(404).json({ message: "Invalid or expired invite token" });

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: hashedPassword,
                name: name || user.name,
                inviteToken: null,
                isActive: true
            }
        });

        // Auto login? Or require login. Let's return success and make them login or return token.
        // Return token so they are logged in immediately.
        const jwtToken = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        // Send Welcome Email
        try {
            const emailService = require("../services/email.service");
            // We need roomName. Let's fetch the room they belong to.
            const membership = await prisma.roomMember.findFirst({
                where: { userId: user.id },
                include: { room: true }
            });

            if (membership) {
                // Find Admin name for the room
                const roomAdmin = await prisma.user.findUnique({ where: { id: membership.room.adminId } });
                await emailService.sendWelcomeEmail(
                    user.email,
                    membership.room.title,
                    roomAdmin ? roomAdmin.name : "Admin",
                    user.email,
                    null // Password not needed as they just set it
                );
            }
        } catch (emailErr) {
            console.error("Welcome email failed:", emailErr);
            // Don't block registration if email fails
        }

        return res.status(200).json({
            message: "Account activated successfully",
            token: jwtToken,
            user: { id: user.id, name: user.name, role: user.role }
        });

    } catch (err) {
        next(err);
    }
};


exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(200).json({ message: "If the email exists, a reset link was sent." });
        }

        // Invalidate previous tokens
        await prisma.passwordResetToken.deleteMany({
            where: { userId: user.id }
        });

        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                token,
                expiresAt
            }
        });

        const emailService = require("../services/email.service");
        await emailService.sendPasswordResetEmail(email, token, user.name);

        return res.status(200).json({ message: "If the email exists, a reset link was sent." });
    } catch (err) {
        next(err);
    }
};

exports.resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ message: "Token and new password are required" });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters" });
        }

        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token }
        });

        if (!resetToken || resetToken.expiresAt < new Date()) {
            return res.status(400).json({ message: "Invalid or expired reset token" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.$transaction([
            prisma.user.update({
                where: { id: resetToken.userId },
                data: { passwordHash: hashedPassword }
            }),
            prisma.passwordResetToken.deleteMany({
                where: { userId: resetToken.userId }
            })
        ]);

        return res.status(200).json({ message: "Password updated successfully" });
    } catch (err) {
        next(err);
    }
};
