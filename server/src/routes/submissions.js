import { Router } from "express";
import { z } from "zod";
import { allowRoles } from "../middleware/auth.js";
import Assignment from "../models/Assignment.js";
import Course from "../models/Course.js";
import Notification from "../models/Notification.js";
import Submission from "../models/Submission.js";
import { evaluateSubmission } from "../services/aiService.js";

const router = Router();
const scoreSchema = z.object({
  questionId: z.string().min(1),
  criterion: z.string().optional(),
  score: z.number().nonnegative(),
  maxPoints: z.number().nonnegative(),
  note: z.string().optional(),
});
const finalizeSchema = z.object({
  finalGrade: z.number().nonnegative(),
  facultyFeedback: z.string().trim().max(5000).default(""),
  scores: z.array(scoreSchema).default([]),
});
router.get("/mine", allowRoles("student"), async (req, res, next) => { try { res.json(await Submission.find({ student: req.user.id }).populate("assignment", "assignmentCode title dueAt totalPoints questions course").sort({ submittedAt: -1 })); } catch (error) { next(error); } });
router.get("/assignment/:assignmentId", allowRoles("admin", "professor"), async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId).populate("course", "professor");
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    if (req.user.role === "professor" && String(assignment.course.professor) !== req.user.id) return res.status(403).json({ message: "This assignment belongs to another professor" });
    res.json(await Submission.find({ assignment: assignment.id }).populate("student", "campusId name email department").sort({ submittedAt: -1 }));
  } catch (error) { next(error); }
});
router.post("/", allowRoles("student"), async (req, res, next) => {
  try {
    const assignment = await Assignment.findOne({ _id: req.body.assignmentId, status: "published" });
    if (!assignment) return res.status(404).json({ message: "Published assignment not found" });
    const lastAttempt = await Submission.findOne({ assignment: assignment.id, student: req.user.id }).sort({ attemptNumber: -1 });
    if (lastAttempt && lastAttempt.status !== "returned") return res.status(409).json({ message: "A new attempt must be approved by the professor first" });
    const submission = await Submission.create({ assignment: assignment.id, student: req.user.id, answers: req.body.answers, note: req.body.note, attemptNumber: (lastAttempt?.attemptNumber ?? 0) + 1 });
    if (assignment.aiEvaluationEnabled) {
      const comparisonSubmissions = assignment.plagiarismCheckEnabled
        ? await Submission.find({ assignment: assignment.id, _id: { $ne: submission.id }, student: { $ne: req.user.id } }).populate("student", "campusId").select("answers student attemptNumber").limit(25)
        : [];
      const comparisons = comparisonSubmissions.map((item) => ({ source: `Course submission · ${item.student?.campusId ?? "another student"}`, attemptNumber: item.attemptNumber, answers: item.answers }));
      const evaluation = await evaluateSubmission({ assignment, submission: { answers: submission.answers }, comparisons });
      if (!assignment.plagiarismCheckEnabled) {
        delete evaluation.plagiarismLevel;
        delete evaluation.plagiarismEvidence;
      }
      submission.aiEvaluation = { ...evaluation, evaluatedAt: new Date() };
      submission.status = "ai_reviewed";
      await submission.save();
    }
    const course = await Course.findById(assignment.course).select("professor");
    if (course?.professor) {
      await Notification.create({
        recipient: course.professor,
        actor: req.user.id,
        type: "submission_received",
        title: "New assignment submission",
        message: `${req.user.name} submitted ${assignment.title}.`,
        assignment: assignment.id,
        submission: submission.id,
      });
    }
    res.status(201).json(submission);
  } catch (error) { next(error); }
});
router.post("/:id/ai-evaluate", allowRoles("admin", "professor"), async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id).populate("assignment");
    if (!submission) return res.status(404).json({ message: "Submission not found" });
    if (req.user.role === "professor") {
      const course = await Course.findOne({ _id: submission.assignment.course, professor: req.user.id });
      if (!course) return res.status(403).json({ message: "This submission belongs to another professor" });
    }
    const comparisonSubmissions = submission.assignment.plagiarismCheckEnabled
      ? await Submission.find({ assignment: submission.assignment.id, _id: { $ne: submission.id }, student: { $ne: submission.student } }).populate("student", "campusId").select("answers student attemptNumber").limit(25)
      : [];
    const comparisons = comparisonSubmissions.map((item) => ({ source: `Course submission · ${item.student?.campusId ?? "another student"}`, attemptNumber: item.attemptNumber, answers: item.answers }));
    const evaluation = await evaluateSubmission({ assignment: submission.assignment, submission: { answers: submission.answers }, comparisons });
    if (!submission.assignment.plagiarismCheckEnabled) {
      delete evaluation.plagiarismLevel;
      delete evaluation.plagiarismEvidence;
    }
    submission.aiEvaluation = { ...evaluation, evaluatedAt: new Date() };
    submission.status = "ai_reviewed";
    await submission.save();
    res.json(submission);
  } catch (error) { next(error); }
});

router.patch("/:id/finalize", allowRoles("admin", "professor"), async (req, res, next) => {
  try {
    const input = finalizeSchema.parse(req.body);
    const submission = await Submission.findById(req.params.id).populate("assignment", "title assignmentCode course");
    if (!submission) return res.status(404).json({ message: "Submission not found" });
    if (req.user.role === "professor") {
      const course = await Course.findOne({ _id: submission.assignment.course, professor: req.user.id });
      if (!course) return res.status(403).json({ message: "This submission belongs to another professor" });
    }
    submission.finalGrade = input.finalGrade;
    submission.facultyFeedback = input.facultyFeedback;
    if (input.scores.length) {
      submission.aiEvaluation = submission.aiEvaluation ?? {};
      submission.aiEvaluation.scores = input.scores;
    }
    submission.finalizedBy = req.user.id;
    submission.scoreReleasedAt = new Date();
    submission.status = "graded";
    await submission.save();
    await Notification.create({
      recipient: submission.student,
      actor: req.user.id,
      type: "score_released",
      title: "Score is now available",
      message: `Your score for ${submission.assignment.title} has been released.`,
      assignment: submission.assignment.id,
      submission: submission.id,
    });
    res.json(submission);
  } catch (error) { next(error); }
});

router.patch("/:id/request-improvement", allowRoles("student"), async (req, res, next) => {
  try {
    const input = z.object({ message: z.string().trim().min(3).max(2000) }).parse(req.body);
    const submission = await Submission.findOne({ _id: req.params.id, student: req.user.id }).populate("assignment", "title course");
    if (!submission) return res.status(404).json({ message: "Submission not found" });
    if (submission.status !== "graded") return res.status(400).json({ message: "Improvement can be requested after a grade is released" });
    submission.improvementRequestedAt = new Date();
    submission.improvementRequestMessage = input.message;
    await submission.save();
    const course = await Course.findById(submission.assignment.course).select("professor");
    if (course?.professor) {
      await Notification.create({
        recipient: course.professor,
        actor: req.user.id,
        type: "system",
        title: "Improvement requested",
        message: `${req.user.name} requested another attempt for ${submission.assignment.title}.`,
        assignment: submission.assignment.id,
        submission: submission.id,
      });
    }
    res.json(submission);
  } catch (error) { next(error); }
});

router.patch("/:id/return-for-improvement", allowRoles("admin", "professor"), async (req, res, next) => {
  try {
    const input = z.object({ facultyFeedback: z.string().trim().min(3).max(5000), resubmissionDueAt: z.coerce.date() }).parse(req.body);
    const submission = await Submission.findById(req.params.id).populate("assignment", "title course");
    if (!submission) return res.status(404).json({ message: "Submission not found" });
    if (req.user.role === "professor") {
      const course = await Course.findOne({ _id: submission.assignment.course, professor: req.user.id });
      if (!course) return res.status(403).json({ message: "This submission belongs to another professor" });
    }
    submission.status = "returned";
    submission.facultyFeedback = input.facultyFeedback;
    submission.returnedAt = new Date();
    submission.resubmissionDueAt = input.resubmissionDueAt;
    await submission.save();
    await Notification.create({
      recipient: submission.student,
      actor: req.user.id,
      type: "system",
      title: "Homework returned for improvement",
      message: `${submission.assignment.title} is available for another attempt. Review the professor's feedback before resubmitting.`,
      assignment: submission.assignment.id,
      submission: submission.id,
    });
    res.json(submission);
  } catch (error) { next(error); }
});

router.patch("/assignment/:assignmentId/finalize-all", allowRoles("admin", "professor"), async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId).select("title course");
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    if (req.user.role === "professor") {
      const course = await Course.findOne({ _id: assignment.course, professor: req.user.id });
      if (!course) return res.status(403).json({ message: "This assignment belongs to another professor" });
    }
    const submissions = await Submission.find({ assignment: assignment.id, status: "ai_reviewed" }).select("student");
    const releasedAt = new Date();
    const result = await Submission.updateMany(
      { assignment: assignment.id, status: "ai_reviewed" },
      [{ $set: { finalGrade: "$aiEvaluation.suggestedGrade", facultyFeedback: "$aiEvaluation.summary", finalizedBy: req.user.id, scoreReleasedAt: releasedAt, status: "graded" } }],
    );
    if (submissions.length) {
      await Notification.insertMany(submissions.map((submission) => ({
        recipient: submission.student,
        actor: req.user.id,
        type: "score_released",
        title: "Assignment scores released",
        message: `Your score and feedback for ${assignment.title} are now available.`,
        assignment: assignment.id,
        submission: submission.id,
      })));
    }
    res.json({ released: result.modifiedCount });
  } catch (error) { next(error); }
});

export default router;
