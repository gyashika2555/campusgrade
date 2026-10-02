import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../models/User.js";

const router = Router();
const loginSchema = z.object({ email: z.email(), password: z.string().min(8) });

router.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await User.findOne({ email: input.email.toLowerCase(), active: true }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ message: "Invalid email or password" });
    const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } });
  } catch (error) { next(error); }
});

export default router;
