import { Router } from "express";
import { z } from "zod";
import { allowRoles } from "../middleware/auth.js";
import Course from "../models/Course.js";
import User from "../models/User.js";

const router = Router();
const courseSchema = z.object({
  code: z.string().trim().min(2).max(16),
  title: z.string().trim().min(2).max(120),
  term: z.string().trim().min(2).max(60),
  professorId: z.string().regex(/^[0-9a-fA-F]{24}$/),
});

router.get("/", async (req, res, next) => {
  try {
    const query = req.user.role === "admin"
      ? {}
      : req.user.role === "professor"
        ? { professor: req.user.id }
        : { students: req.user.id };
    const courses = await Course.find(query)
      .populate("professor", "campusId name email department")
      .populate("students", "campusId name email department active")
      .sort({ createdAt: -1 });
    res.json(courses);
  } catch (error) { next(error); }
});

router.post("/", allowRoles("admin"), async (req, res, next) => {
  try {
    const input = courseSchema.parse(req.body);
    const professor = await User.findOne({ _id: input.professorId, role: "professor", active: true });
    if (!professor) return res.status(404).json({ message: "Active professor not found" });
    const course = await Course.create({ code: input.code, title: input.title, term: input.term, professor: professor.id });
    await course.populate("professor", "campusId name email department");
    res.status(201).json(course);
  } catch (error) { next(error); }
});

router.patch("/:courseId", allowRoles("admin"), async (req, res, next) => {
  try {
    const input = courseSchema.partial().parse(req.body);
    const changes = { ...input };
    if (input.professorId) {
      const professor = await User.findOne({ _id: input.professorId, role: "professor", active: true });
      if (!professor) return res.status(404).json({ message: "Active professor not found" });
      changes.professor = professor.id;
      delete changes.professorId;
    }
    const course = await Course.findByIdAndUpdate(req.params.courseId, changes, { new: true, runValidators: true })
      .populate("professor", "campusId name email department")
      .populate("students", "campusId name email department active");
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (error) { next(error); }
});

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
