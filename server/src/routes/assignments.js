import { Router } from "express";
import { z } from "zod";
import { allowRoles } from "../middleware/auth.js";
import Assignment from "../models/Assignment.js";
import Course from "../models/Course.js";
import Notification from "../models/Notification.js";
import { generateAssignment } from "../services/aiService.js";

const router = Router();

async function generateAssignmentCode(createdBy) {
  let assignmentCode;
  do assignmentCode = `A${Math.floor(10000 + Math.random() * 90000)}`;
  while (await Assignment.exists({ createdBy, assignmentCode }));
  return assignmentCode;
}

router.get("/", async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === "student") { const courses = await Course.find({ students: req.user.id }).select("_id"); query = { course: { $in: courses.map((course) => course.id) }, status: { $ne: "draft" } }; }
    if (req.user.role === "professor") { const courses = await Course.find({ professor: req.user.id }).select("_id"); query = { course: { $in: courses.map((course) => course.id) } }; }
    res.json(await Assignment.find(query).populate("course", "code title").sort({ dueAt: 1 }));
  } catch (error) { next(error); }
});
router.post("/generate", allowRoles("admin", "professor"), async (req, res, next) => { try { const input = z.object({ topic: z.string().min(3), outcomes: z.array(z.string()).min(1), difficulty: z.enum(["beginner", "intermediate", "advanced"]), totalPoints: z.number().positive().default(100) }).parse(req.body); res.json(await generateAssignment(input)); } catch (error) { next(error); } });
router.post("/", allowRoles("admin", "professor"), async (req, res, next) => { try { const assignmentCode = await generateAssignmentCode(req.user.id); const assignment = await Assignment.create({ ...req.body, assignmentCode, createdBy: req.user.id }); res.status(201).json(assignment); } catch (error) { next(error); } });
router.patch("/:id", allowRoles("admin", "professor"), async (req, res, next) => {
  try {
    const assignment = await Assignment.findOne({ _id: req.params.id, ...(req.user.role === "professor" ? { createdBy: req.user.id } : {}) });
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    const wasPublished = assignment.status === "published";
    Object.assign(assignment, req.body);
    await assignment.save();

    if (!wasPublished && assignment.status === "published") {
      const course = await Course.findById(assignment.course).select("students");
      if (course?.students.length) {
        await Notification.insertMany(course.students.map((student) => ({
          recipient: student,
          actor: req.user.id,
          type: "assignment_published",
          title: "New assignment published",
          message: `${assignment.title} is now available and due ${assignment.dueAt.toLocaleString()}.`,
          assignment: assignment.id,
        })));
      }
    }

    res.json(assignment);
  } catch (error) { next(error); }
});

export default router;
