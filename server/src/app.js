import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { ZodError } from "zod";
import { connectDatabase } from "./config/db.js";
import { authenticate } from "./middleware/auth.js";
import assignmentRoutes from "./routes/assignments.js";
import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import notificationRoutes from "./routes/notifications.js";
import submissionRoutes from "./routes/submissions.js";
import userRoutes from "./routes/users.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.get("/api/health", (_req, res) => res.json({ service: "campusgrade-api", status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/users", authenticate, userRoutes);
app.use("/api/courses", authenticate, courseRoutes);
app.use("/api/assignments", authenticate, assignmentRoutes);
app.use("/api/submissions", authenticate, submissionRoutes);
app.use("/api/notifications", authenticate, notificationRoutes);
app.use((error, _req, res, _next) => {
  void _next;
  if (error instanceof ZodError) return res.status(400).json({ message: "Validation failed", issues: error.issues });
  if (error?.code === 11000) return res.status(409).json({ message: "A record with that value already exists" });
  console.error(error);
  res.status(error.status ?? 500).json({ message: error.message ?? "Unexpected server error" });
});

const port = Number(process.env.PORT ?? 5000);
connectDatabase().then(() => app.listen(port, () => console.log(`CampusGrade API listening on ${port}`))).catch((error) => { console.error(error); process.exit(1); });
