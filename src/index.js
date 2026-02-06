const cluster = require("cluster");
const os = require("os");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const authRoutes = require("./routes/auth.routes");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
    console.log(`Primary ${process.pid} is running`);

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
        console.log("Starting a new worker...");
        cluster.fork();
    });
} else {
    const app = express();
    const PORT = process.env.PORT || 3000;

    app.use(helmet());
    app.use(compression());
    const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

    app.use(
        cors({
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }
                return callback(new Error("Not allowed by CORS"));
            },
            credentials: true
        })
    );
    app.use(express.json());

    app.use((req, res, next) => {
        console.log(`[REQUEST] ${req.method} ${req.url} handled by worker ${process.pid}`);
        next();
    });

    // Health Check
    app.get("/health", (req, res) => {
        res.send(`OK from worker ${process.pid}`);
    });

    const authLimiter = rateLimit({
        windowMs: 10 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false
    });

    // Routes
    app.use("/api/auth", authLimiter, authRoutes);
    app.use("/api/rooms", require("./routes/room.routes"));
    app.use("/api/admin", require("./routes/admin.routes"));
    app.use("/api/users", require("./routes/user.routes"));
    app.use("/api/notifications", require("./routes/notification.routes"));
    app.use("/api/feedback", require("./routes/feedback.routes"));

    // Global Error Handler
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).json({ message: "Internal Server Error" });
    });

    app.listen(PORT, () => {
        console.log(`Worker ${process.pid} started on port ${PORT}`);
    });
}
