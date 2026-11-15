import { Router } from "express";
import { allowRoles } from "../middleware/auth.js";
import Assignment from "../models/Assignment.js";
import Course from "../models/Course.js";
import Submission from "../models/Submission.js";
import User from "../models/User.js";

const router = Router();
const idOf = (value) => String(value?._id ?? value ?? "");
const rounded = (value) => Math.round((Number.isFinite(value) ? value : 0) * 10) / 10;
const percent = (part, total) => total > 0 ? rounded((part / total) * 100) : 0;

function latestAttempts(submissions) {
  const latest = new Map();
  for (const submission of submissions) {
    const key = `${idOf(submission.assignment)}:${idOf(submission.student)}`;
    const current = latest.get(key);
    if (!current || submission.attemptNumber > current.attemptNumber) latest.set(key, submission);
  }
  return [...latest.values()];
}

function normalizedAverage(submissions, assignmentsById) {
  const graded = submissions.filter((submission) => Number.isFinite(submission.finalGrade));
  if (!graded.length) return 0;
  const total = graded.reduce((sum, submission) => {
    const assignment = assignmentsById.get(idOf(submission.assignment));
    return sum + (assignment?.totalPoints ? (submission.finalGrade / assignment.totalPoints) * 100 : 0);
  }, 0);
  return rounded(total / graded.length);
}

function professorGuidance(averageScore, submissionRate) {
  if (submissionRate < 70) return "Improve assignment instructions and add earlier reminders so more students submit on time.";
  if (averageScore < 70) return "Review the lowest-scoring concepts, add worked examples, and offer a short practice activity before the next assignment.";
  if (averageScore < 80) return "Add targeted practice and question-level feedback for the topics where students are losing the most marks.";
  return "Student outcomes are strong. Add one advanced challenge and continue the current feedback approach.";
}

router.get("/admin", allowRoles("admin"), async (_req, res, next) => {
  try {
    const [professors, students, courses, assignments, allSubmissions] = await Promise.all([
      User.find({ role: "professor", active: true }).select("campusId name department"),
      User.find({ role: "student", active: true }).select("campusId name department"),
      Course.find().populate("professor", "campusId name department").populate("students", "campusId name department"),
      Assignment.find(),
      Submission.find(),
    ]);

    const submissions = latestAttempts(allSubmissions);
    const assignmentsById = new Map(assignments.map((assignment) => [idOf(assignment), assignment]));
    const coursesById = new Map(courses.map((course) => [idOf(course), course]));

    const subjectAnalytics = courses.map((course) => {
      const courseAssignments = assignments.filter((assignment) => idOf(assignment.course) === idOf(course));
      const assignmentIds = new Set(courseAssignments.map(idOf));
      const courseSubmissions = submissions.filter((submission) => assignmentIds.has(idOf(submission.assignment)));
      const expected = courseAssignments.length * course.students.length;
      return {
        id: idOf(course), code: course.code, title: course.title, term: course.term,
        professor: course.professor?.name ?? "Unassigned", enrolledStudents: course.students.length,
        assignments: courseAssignments.length, submissions: courseSubmissions.length,
        averageScore: normalizedAverage(courseSubmissions, assignmentsById), submissionRate: percent(courseSubmissions.length, expected),
      };
    });

    const professorAnalytics = professors.map((professor) => {
      const professorCourses = courses.filter((course) => idOf(course.professor) === idOf(professor));
      const courseIds = new Set(professorCourses.map(idOf));
      const professorAssignments = assignments.filter((assignment) => idOf(assignment.createdBy) === idOf(professor) || courseIds.has(idOf(assignment.course)));
      const assignmentIds = new Set(professorAssignments.map(idOf));
      const professorSubmissions = submissions.filter((submission) => assignmentIds.has(idOf(submission.assignment)));
      const studentIds = new Set(professorCourses.flatMap((course) => course.students.map(idOf)));
      const expected = professorAssignments.reduce((sum, assignment) => sum + (coursesById.get(idOf(assignment.course))?.students.length ?? 0), 0);
      const averageScore = normalizedAverage(professorSubmissions, assignmentsById);
      const submissionRate = percent(professorSubmissions.length, expected);
      return {
        id: idOf(professor), campusId: professor.campusId, name: professor.name, department: professor.department,
        courses: professorCourses.length, assignmentsCreated: professorAssignments.length, studentsTaught: studentIds.size,
        submissionsReceived: professorSubmissions.length, averageScore, submissionRate,
        subjectAverages: subjectAnalytics.filter((subject) => courseIds.has(subject.id)).map(({ id, code, title, averageScore: score, submissionRate: rate }) => ({ courseId: id, code, title, averageScore: score, submissionRate: rate })),
        improvement: professorGuidance(averageScore, submissionRate),
      };
    });

    const studentAnalytics = students.map((student) => {
      const studentCourses = courses.filter((course) => course.students.some((member) => idOf(member) === idOf(student)));
      const courseIds = new Set(studentCourses.map(idOf));
      const availableAssignments = assignments.filter((assignment) => courseIds.has(idOf(assignment.course)) && assignment.status !== "draft");
      const assignmentIds = new Set(availableAssignments.map(idOf));
      const studentSubmissions = submissions.filter((submission) => idOf(submission.student) === idOf(student) && assignmentIds.has(idOf(submission.assignment)));
      const perSubject = studentCourses.map((course) => {
        const courseAssignmentIds = new Set(availableAssignments.filter((assignment) => idOf(assignment.course) === idOf(course)).map(idOf));
        const courseSubmissions = studentSubmissions.filter((submission) => courseAssignmentIds.has(idOf(submission.assignment)));
        return { title: course.title, average: normalizedAverage(courseSubmissions, assignmentsById) };
      }).filter((subject) => subject.average > 0).sort((a, b) => b.average - a.average);
      return {
        id: idOf(student), campusId: student.campusId, name: student.name, department: student.department,
        subjects: studentCourses.length, assignmentsAvailable: availableAssignments.length, assignmentsSubmitted: studentSubmissions.length,
        pendingAssignments: Math.max(availableAssignments.length - studentSubmissions.length, 0),
        averageScore: normalizedAverage(studentSubmissions, assignmentsById), submissionRate: percent(studentSubmissions.length, availableAssignments.length),
        strongestSubject: perSubject[0]?.title ?? "Not enough graded work", needsFocus: perSubject.at(-1)?.title ?? "Not enough graded work",
      };
    });

    const totalExpected = subjectAnalytics.reduce((sum, subject) => sum + subject.assignments * subject.enrolledStudents, 0);
    res.json({
      summary: {
        professors: professors.length, students: students.length, subjects: courses.length, assignments: assignments.length,
        submissions: submissions.length, averageScore: normalizedAverage(submissions, assignmentsById), submissionRate: percent(submissions.length, totalExpected),
      },
      professors: professorAnalytics, students: studentAnalytics, subjects: subjectAnalytics,
    });
  } catch (error) { next(error); }
});

export default router;
