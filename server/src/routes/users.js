import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { allowRoles } from "../middleware/auth.js";
import User from "../models/User.js";

const router = Router();
const userSchema = z.object({ name: z.string().min(2), email: z.email(), role: z.enum(["professor", "student"]), department: z.string().min(2), courses: z.array(z.string().min(2)).default([]), password: z.string().min(8).optional() });

async function generateCampusId(role) {
  const prefix = role === "professor" ? "P" : "S";
  let campusId;
  do campusId = `${prefix}${Math.floor(10000 + Math.random() * 90000)}`;
  while (await User.exists({ campusId }));
  return campusId;
}

router.get("/student-directory", allowRoles("admin", "professor"), async (req, res, next) => {
  try {
    const query = String(req.query.query ?? "").trim();
    if (!query) return res.json([]);
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const students = await User.find({ role: "student", active: true, $or: [{ campusId: { $regex: escaped, $options: "i" } }, { email: { $regex: escaped, $options: "i" } }] }).select("campusId name email role department active").limit(8);
    res.json(students);
  } catch (error) { next(error); }
});

router.get("/", allowRoles("admin"), async (_req, res, next) => { try { res.json(await User.find().select("-passwordHash").sort({ createdAt: -1 })); } catch (error) { next(error); } });
router.post("/", allowRoles("admin"), async (req, res, next) => {
  try {
    const input = userSchema.parse(req.body);
    const { password, ...profile } = input;
    const temporaryPassword = password ?? randomBytes(18).toString("base64url");
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const campusId = await generateCampusId(input.role);
    const user = await User.create({ ...profile, campusId, email: input.email.toLowerCase(), courses: input.role === "professor" ? input.courses : [], passwordHash });
    res.status(201).json({ id: user.id, campusId: user.campusId, name: user.name, email: user.email, role: user.role, department: user.department, courses: user.courses, active: user.active, ...(!password ? { temporaryPassword } : {}) });
  } catch (error) { next(error); }
});
router.patch("/:id", allowRoles("admin"), async (req, res, next) => { try { const { password, ...changes } = userSchema.partial().parse(req.body); if (password) changes.passwordHash = await bcrypt.hash(password, 12); const user = await User.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true }).select("-passwordHash"); if (!user) return res.status(404).json({ message: "User not found" }); res.json(user); } catch (error) { next(error); } });
router.delete("/:id", allowRoles("admin"), async (req, res, next) => { try { const user = await User.findByIdAndUpdate(req.params.id, { active: false }, { new: true }); if (!user) return res.status(404).json({ message: "User not found" }); res.status(204).end(); } catch (error) { next(error); } });

export default router;
