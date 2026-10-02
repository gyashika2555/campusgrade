import { Router } from "express";
import { allowRoles } from "../middleware/auth.js";
import Assignment from "../models/Assignment.js";
import Course from "../models/Course.js";
import Notification from "../models/Notification.js";
import Submission from "../models/Submission.js";
import { evaluateSubmission } from "../services/aiService.js";

const router = Router();
router.get("/mine", allowRoles("student"), async (req, res, next) => { try { res.json(await Submission.find({ student: req.user.id }).populate("assignment", "assignmentCode title dueAt totalPoints").sort({ submittedAt: -1 })); } catch (error) { next(error); } });
router.get("/assignment/:assignmentId", allowRoles("admin", "professor"), async (req, res, next) => { try { res.json(await Submission.find({ assignment: req.params.assignmentId }).populate("student", "campusId name email").sort({ submittedAt: -1 })); } catch (error) { next(error); } });
router.post("/", allowRoles("student"), async (req, res, next) => {
  try {
    const assignment = await Assignment.findOne({ _id: req.body.assignmentId, status: "published" });
    if (!assignment) return res.status(404).json({ message: "Published assignment not found" });
    const lastAttempt = await Submission.findOne({ assignment: assignment.id, student: req.user.id }).sort({ attemptNumber: -1 });
    const submission = await Submission.create({ assignment: assignment.id, student: req.user.id, answers: req.body.answers, note: req.body.note, attemptNumber: (lastAttempt?.attemptNumber ?? 0) + 1 });
    if (assignment.aiEvaluationEnabled) {
      const evaluation = await evaluateSubmission({ assignment, submission: { answers: submission.answers } });
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
    const evaluation = await evaluateSubmission({ assignment: submission.assignment, submission: { answers: submission.answers } });
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
    const submission = await Submission.findById(req.params.id).populate("assignment", "title assignmentCode");
    if (!submission) return res.status(404).json({ message: "Submission not found" });
    submission.finalGrade = req.body.finalGrade;
    submission.facultyFeedback = req.body.facultyFeedback;
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

router.patch("/assignment/:assignmentId/finalize-all", allowRoles("admin", "professor"), async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId).select("title");
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
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
