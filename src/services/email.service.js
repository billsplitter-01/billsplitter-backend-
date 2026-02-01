const nodemailer = require("nodemailer");

// Transport Configuration
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER || "billspliting@gmail.com",
        pass: process.env.EMAIL_PASSWORD
    }
});

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
    const link = `https://billssplitter-vivasvan.netlify.app/accept-invite?token=${inviteToken}`;

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
            <a href="https://billssplitter-vivasvan.netlify.app/login" class="button">Login to Dashboard</a>
        </div>

        <p>Best Regards,<br><strong>SplitApp Team</strong></p>
    `;

    const html = getHtmlTemplate("Welcome", body, "#8b5cf6"); // Violet accent
    await this.sendEmail(to, subject, null, html);
};

exports.sendPasswordRecoveryEmail = async (to, password, userName) => {
    const subject = "SplitApp - Password Recovery";

    const body = `
        <h2>Secure Password Recovery 🔐</h2>
        <p>Hello ${userName || 'User'},</p>
        <p>You recently requested to recover your password for your SplitApp account.</p>
        
        <div class="info-box">
            <h3 style="margin-top:0; margin-bottom:10px; font-size: 16px;">New Temporary Password</h3>
            <p style="margin:0;"><strong>Temporary Password:</strong> <span style="font-family: monospace; font-size: 18px; color: #1e293b; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${password}</span></p>
        </div>
        
        <p>For your security, please log in using this password and **change it immediately** in your profile settings.</p>
        
        <div style="text-align: center;">
            <a href="https://billssplitter-vivasvan.netlify.app/login" class="button">Login to Dashboard</a>
        </div>

        <p>If you did not request this, please ignore this email or contact support if you have concerns.</p>
        
        <p>Best Regards,<br><strong>SplitApp Team</strong></p>
    `;

    const html = getHtmlTemplate("Password Recovery", body, "#3B82F6"); // Blue accent
    await this.sendEmail(to, subject, null, html);
};

exports.sendEmail = async (to, subject, text, html) => {
    try {
        const mailOptions = {
            from: `"SplitApp Notifications" <${process.env.EMAIL_USER || "billspliting@gmail.com"}>`,
            to,
            subject,
            text, // Fallback for clients incapable of rendering HTML
            html
        };

        // In dev, if no password, we check for mock env but since we have credentials now, 
        // we might want strict sending. However, let's keep the safety check just in case env didn't load.
        if (!process.env.EMAIL_PASSWORD && !process.env.MockEmail) {
            console.log("No Email Password configured and MockEmail not set. Skipping email.");
            return;
        }

        await transporter.sendMail(mailOptions);
        // console.log(`Email sent to ${to}`); // Kept commented out as requested to remove logs
    } catch (err) {
        console.error("Email sending failed:", err);
    }
};
