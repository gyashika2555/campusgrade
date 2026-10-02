import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDatabase } from "./config/db.js";
import Assignment from "./models/Assignment.js";
import Course from "./models/Course.js";
import Notification from "./models/Notification.js";
import Submission from "./models/Submission.js";
import User from "./models/User.js";

await connectDatabase();
const seedPassword = process.env.SEED_PASSWORD;
if (!seedPassword || seedPassword.length < 12) {
  throw new Error("SEED_PASSWORD must be set to at least 12 characters before running the seed script.");
}

await Promise.all([Assignment.deleteMany({}), Course.deleteMany({}), Notification.deleteMany({}), Submission.deleteMany({}), User.deleteMany({})]);
const passwordHash = await bcrypt.hash(seedPassword, 12);
const [admin, professor, maya, noah] = await User.create([
  { name: "Jordan Lee", email: "admin@campusgrade.edu", passwordHash, role: "admin", department: "Academic Technology" },
  { campusId: "P43817", name: "Dr. Aisha Patel", email: "professor@campusgrade.edu", passwordHash, role: "professor", department: "Computer Science", courses: ["CS 412 · Web Engineering", "CS 308 · Algorithms"] },
  { campusId: "S18426", name: "Maya Chen", email: "student@campusgrade.edu", passwordHash, role: "student", department: "Computer Science" },
  { campusId: "S27519", name: "Noah Williams", email: "noah@campusgrade.edu", passwordHash, role: "student", department: "Computer Science" },
]);
const course = await Course.create({ code: "CS412", title: "Web Engineering", term: "Fall 2026", professor: professor.id, students: [maya.id, noah.id] });
const assignment = await Assignment.create({ assignmentCode: "A18426", course: course.id, createdBy: professor.id, title: "REST API with Authentication", description: "Build a secure REST API with Node.js, JWT authentication, validation, and automated tests.", learningOutcomes: ["Design RESTful resources", "Apply authentication and authorization", "Write integration tests"], difficulty: "intermediate", totalPoints: 100, dueAt: new Date("2026-10-03T23:59:00-04:00"), status: "published", aiEvaluationEnabled: true, plagiarismCheckEnabled: true, plagiarismThreshold: 30, questions: [{ prompt: "Explain access and refresh tokens.", type: "text", points: 25 }, { prompt: "Write Express middleware that verifies a JWT.", type: "code", language: "JavaScript", points: 45 }, { prompt: "Describe three authentication tests.", type: "text", points: 30 }], rubric: [{ criterion: "Functionality", maxPoints: 40 }, { criterion: "Code quality", maxPoints: 25 }, { criterion: "Testing", maxPoints: 20 }, { criterion: "Documentation", maxPoints: 15 }] });
await Notification.create([
  { recipient: maya.id, actor: professor.id, type: "assignment_published", title: "New assignment published", message: "REST API with Authentication is now available.", assignment: assignment.id },
  { recipient: professor.id, actor: noah.id, type: "submission_received", title: "New assignment submission", message: "Noah Williams submitted REST API with Authentication.", assignment: assignment.id },
]);
console.log("Seed complete. Demo accounts use the password supplied through SEED_PASSWORD.");
console.log({ admin: admin.email, professor: professor.email, student: maya.email });
process.exit(0);
