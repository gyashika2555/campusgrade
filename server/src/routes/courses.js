import { Router } from "express";
import { allowRoles } from "../middleware/auth.js";
import Course from "../models/Course.js";
import User from "../models/User.js";

const router = Router();
async function canManageCourse(req, res, next) {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (req.user.role !== "admin" && String(course.professor) !== req.user.id) return res.status(403).json({ message: "Only this course professor can change its roster" });
    req.course = course; next();
  } catch (error) { next(error); }
}

router.get("/:courseId/students", allowRoles("admin", "professor"), canManageCourse, async (req, res, next) => { try { await req.course.populate("students", "campusId name email department active"); res.json(req.course.students); } catch (error) { next(error); } });
router.post("/:courseId/students", allowRoles("admin", "professor"), canManageCourse, async (req, res, next) => {
  try {
    const key = String(req.body.studentId ?? req.body.campusId ?? req.body.email ?? "").trim();
    const identity = key.includes("@") ? { email: key.toLowerCase() } : /^[0-9a-fA-F]{24}$/.test(key) ? { _id: key } : { campusId: key.toUpperCase() };
    const student = await User.findOne({ ...identity, role: "student", active: true });
    if (!student) return res.status(404).json({ message: "Student not found" });
    req.course.students.addToSet(student.id);
    await req.course.save();
    res.status(201).json({ message: "Student added", student });
  } catch (error) { next(error); }
});
router.patch("/:courseId/students/:studentId", allowRoles("admin"), canManageCourse, async (req, res, next) => { try { const allowed = (({ name, email, department }) => ({ name, email, department }))(req.body); const student = await User.findOneAndUpdate({ _id: req.params.studentId, role: "student" }, allowed, { new: true, runValidators: true }); if (!student) return res.status(404).json({ message: "Student not found" }); res.json(student); } catch (error) { next(error); } });
router.delete("/:courseId/students/:studentId", allowRoles("admin", "professor"), canManageCourse, async (req, res, next) => { try { req.course.students.pull(req.params.studentId); await req.course.save(); res.status(204).end(); } catch (error) { next(error); } });

export default router;
