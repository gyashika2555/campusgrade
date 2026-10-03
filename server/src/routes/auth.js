import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import User from "../models/User.js";

const router = Router();
const loginSchema = z.object({ email: z.email(), password: z.string().min(8) });
const setupSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email(),
  password: z.string().min(12),
  department: z.string().trim().min(2).default("Academic Administration"),
});

function createSession(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error("JWT_SECRET must be set to a random value of at least 32 characters");
    error.status = 500;
    throw error;
  }
  const token = jwt.sign({ sub: user.id, role: user.role }, secret, { expiresIn: "8h" });
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department },
  };
}

router.get("/setup-status", async (_req, res, next) => {
  try {
    res.json({ needsSetup: !(await User.exists({})) });
  } catch (error) { next(error); }
});

router.post("/setup", async (req, res, next) => {
  try {
    if (await User.exists({})) return res.status(409).json({ message: "Initial setup is already complete" });
    const input = setupSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await User.create({
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role: "admin",
      department: input.department,
    });
    res.status(201).json(createSession(user));
  } catch (error) { next(error); }
});

router.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await User.findOne({ email: input.email.toLowerCase(), active: true }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ message: "Invalid email or password" });
    res.json(createSession(user));
  } catch (error) { next(error); }
});

router.get("/me", authenticate, (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, department: req.user.department });
});

export default router;
