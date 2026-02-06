const sgMail = require("@sendgrid/mail");

// Configure SendGrid with API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const getFrontendUrl = () =>
    (process.env.FRONTEND_URL || "https://billsplitter-one.vercel.app").replace(/\/+$/, "");

/**
 * Generates a professional HTML email template.
 * @param {string} title - The main heading of the email.
 * @param {string} bodyContent - The HTML content of the email body.
 * @param {string} accentColor - Hex code for the accent color (default: blue).
 */
const getHtmlTemplate = (title, bodyContent, accentColor = "#3B82F6") => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f6f8; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-top: 20px; margin-bottom: 20px; }
        .header { background-color: ${accentColor}; padding: 30px 20px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .content { padding: 40px 30px; }
        .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        .button { display: inline-block; padding: 12px 24px; background-color: ${accentColor}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
        .info-box { background-color: #f0f9ff; border-left: 4px solid ${accentColor}; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .alert-box { background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; color: #b91c1c; }
        h2 { color: #1e293b; font-size: 20px; margin-top: 0; }
        p { margin-bottom: 15px; color: #475569; }
        strong { color: #0f172a; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>SplitApp</h1>
        </div>
        <div class="content">
            ${bodyContent}
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} SplitApp. All rights reserved.</p>
            <p>This is an automated message, please do not reply directly.</p>
        </div>
    </div>
</body>
</html>
    `;
};

exports.sendThresholdEmail = async (to, roomName, amount, threshold, adminName) => {
    const subject = `⚠️ Alert: Budget Threshold Reached for ${roomName}`;
    const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    const formattedThreshold = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(threshold);

    const body = `
        <h2>Budget Alert! 🚨</h2>
        <p>Hello Roommate,</p>
        <p>This is to inform you that the expenses for the room <strong>${roomName}</strong> have exceeded the set budget.</p>
        
        <div class="alert-box">
            <p style="margin:0;"><strong>Current Total:</strong> ${formattedAmount}</p>
            <p style="margin:5px 0 0;"><strong>Threshold:</strong> ${formattedThreshold}</p>
        </div>

        <p>Please log in to your dashboard to review the expenses and clear any outstanding dues.</p>
        
        <p>Best Regards,<br><strong>${adminName}</strong> (Room Admin)</p>
    `;

    const html = getHtmlTemplate("Threshold Alert", body, "#ef4444"); // Red accent for danger
    await this.sendEmail(to, subject, null, html);
};

exports.sendManualEmail = async (to, roomName, subject, content, adminName) => {
    const fullSubject = `📢 ${roomName}: ${subject}`;

    const body = `
        <h2>New Notification</h2>
        <p>Hello Roommate,</p>
        <div class="info-box">
            <p style="margin:0;">${content}</p>
        </div>
        <p>Best Regards,<br><strong>${adminName}</strong> (Room Admin)</p>
    `;

    const html = getHtmlTemplate("Notification", body, "#3B82F6"); // Blue accent
    await this.sendEmail(to, fullSubject, null, html);
};

exports.sendInviteEmail = async (to, roomName, adminName, inviteToken) => {
    const subject = `You're invited to join ${roomName} on SplitApp`;
    const link = `${getFrontendUrl()}/accept-invite?token=${inviteToken}`;

    const body = `
        <h2>Join Your Roommates! 👋</h2>
        <p>Hello,</p>
        <p><strong>${adminName}</strong> has invited you to join the room <strong>"${roomName}"</strong> on SplitApp.</p>
        <p>Click the button below to accept the invite, set your password, and start tracking shared expenses.</p>
        
        <div style="text-align: center;">
            <a href="${link}" class="button">Accept Invitation</a>
        </div>
        
        <p style="font-size: 12px; margin-top: 20px; color: #94a3b8;">If the button doesn't work, copy and paste this link: <br> ${link}</p>
        
        <p>Welcome aboard,<br><strong>SplitApp Team</strong></p>
    `;

    const html = getHtmlTemplate("Welcome Invite", body, "#10b981"); // Emerald accent
    await this.sendEmail(to, subject, null, html);
};

exports.sendWelcomeEmail = async (to, roomName, adminName, email, password) => {
    const subject = `Welcome to ${roomName} - Your Account Details`;

    let credentialsHtml = '';
    if (password) {
        credentialsHtml = `
        <div class="info-box">
            <h3 style="margin-top:0; margin-bottom:10px; font-size: 16px;">Your Login Credentials</h3>
            <p style="margin:0;"><strong>Email:</strong> ${email}</p>
            <p style="margin:5px 0 0;"><strong>Temporary Password:</strong> ${password}</p>
        </div>
        <p><em>Please change your password immediately after logging in for security.</em></p>
        `;
    }

    const body = `
        <h2>Welcome to the Room! 🎉</h2>
        <p>Hello,</p>
        <p>Admin <strong>${adminName}</strong> has successfully added you to <strong>${roomName}</strong>.</p>
        
        ${credentialsHtml}
        
        <p>You can now log in to view expenses and settle up.</p>
        
        <div style="text-align: center;">
            <a href="${getFrontendUrl()}/login" class="button">Login to Dashboard</a>
        </div>

        <p>Best Regards,<br><strong>SplitApp Team</strong></p>
    `;

    const html = getHtmlTemplate("Welcome", body, "#8b5cf6"); // Violet accent
    await this.sendEmail(to, subject, null, html);
};

exports.sendPasswordResetEmail = async (to, resetToken, userName) => {
    const subject = "SplitApp - Reset Your Password";
    const resetLink = `${getFrontendUrl()}/reset-password?token=${resetToken}`;

    const body = `
        <h2>Reset Your Password 🔐</h2>
        <p>Hello ${userName || 'User'},</p>
        <p>We received a request to reset your SplitApp password. Click the button below to set a new password.</p>
        
        <div style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
        </div>

        <p style="font-size: 12px; margin-top: 20px; color: #94a3b8;">If the button doesn't work, copy and paste this link: <br> ${resetLink}</p>
        
        <p>If you did not request this, you can safely ignore this email.</p>
        
        <p>Best Regards,<br><strong>SplitApp Team</strong></p>
    `;

    const html = getHtmlTemplate("Password Reset", body, "#3B82F6");
    await this.sendEmail(to, subject, null, html);
};

exports.sendFeedbackConfirmationEmail = async (to, userName, feedbackTitle) => {
    const subject = `Feedback Received: ${feedbackTitle}`;

    const body = `
        <h2>Feedback Received! 🛡️</h2>
        <p>Hello ${userName || 'User'},</p>
        <p>Thank you for your feedback regarding <strong>"${feedbackTitle}"</strong>.</p>
        <p>Our team has received your submission and will look into it shortly. We appreciate your contribution to making SplitApp better!</p>
        
        <div class="info-box">
            <p style="margin:0;">We aim to resolve or respond to all feedback as quickly as possible.</p>
        </div>

        <p>Best Regards,<br><strong>SplitApp Team</strong></p>
    `;

    const html = getHtmlTemplate("Feedback Received", body, "#3B82F6");
    await this.sendEmail(to, subject, null, html);
};


exports.sendEmail = async (to, subject, text, html) => {
    try {
        const msg = {
            to: to,
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "billspliting@gmail.com",
            subject: subject,
            text: text || "Please view this email in an HTML-compatible client.", // Fallback for clients incapable of rendering HTML
            html: html
        };

        if (process.env.MockEmail) {
            console.log("--- Mock Email Sent ---");
            console.log("To:", to);
            console.log("Subject:", subject);
            console.log("-----------------------");
            return;
        }

        console.log("SENDGRID KEY EXISTS:", !!process.env.SENDGRID_API_KEY);

        if (!process.env.SENDGRID_API_KEY) {
            console.log("No SendGrid API Key configured. Skipping email.");
            return;
        }

        await sgMail.send(msg);
        console.log("EMAIL SENT SUCCESSFULLY");
    } catch (err) {
        console.error("SENDGRID ERROR:", err.response?.body || err);
    }
};
