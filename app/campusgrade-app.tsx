"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity, Bell, BookOpen, Bot, Check, CheckCircle2, ChevronRight,
  CircleUserRound, ClipboardCheck, Clock3, FileCode2, GitBranch,
  GraduationCap, LayoutDashboard, Menu, Pencil, Plus,
  RefreshCw, Search, ShieldCheck, Sparkles, Trash2, TrendingUp,
  UploadCloud, UserRoundPlus, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";

type Role = "admin" | "professor" | "student";
type UserRole = "Student" | "Professor" | "Admin";
type AssignmentStatus = "new" | "submitted" | "completed";
type HomeworkMode = "edit" | "view" | "preview";

type Question = {
  id: string;
  prompt: string;
  type: "text" | "code";
  points: number;
  language?: string;
};

type Person = {
  id: number;
  campusId: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  course?: string;
  courses?: string[];
  status: "Active" | "Invited";
};

type StudentEvaluation = {
  id: number;
  student: string;
  submittedAt: string;
  score: number;
  plagiarism: number;
  status: "AI evaluated" | "Score released";
};

type QuestionAiAssessment = {
  awardedPoints: number | null;
  justification: string;
};

type PlagiarismEvidence = {
  id: string;
  source: string;
  location: string;
  similarity: number;
  studentExcerpt: string;
  matchedExcerpt: string;
  explanation: string;
};

type NotificationKind = "assignment" | "submission" | "score" | "system";

type CampusNotification = {
  id: number;
  audience: Role;
  recipient?: string;
  title: string;
  message: string;
  time: string;
  kind: NotificationKind;
  assignmentId?: number;
  read: boolean;
};

type Assignment = {
  id: number;
  assignmentCode: string;
  title: string;
  course: string;
  due: string;
  dueAt: string;
  points: number;
  status: AssignmentStatus;
  grade?: number;
  feedback?: string;
  repo?: string;
  attempts: number;
  questions: Question[];
  aiEvaluationEnabled: boolean;
  plagiarismCheckEnabled: boolean;
  plagiarismThreshold: number;
  submittedAnswers?: Record<string, string>;
  hasUnreadFeedback?: boolean;
};

const initialPeople: Person[] = [
  { id: 1, campusId: "S18426", name: "Maya Chen", email: "maya.chen@campus.edu", role: "Student", department: "Computer Science", course: "CS 412 · Web Engineering", status: "Active" },
  { id: 2, campusId: "S27519", name: "Noah Williams", email: "noah.w@campus.edu", role: "Student", department: "Computer Science", course: "CS 412 · Web Engineering", status: "Active" },
  { id: 3, campusId: "P43817", name: "Aisha Patel", email: "aisha.patel@campus.edu", role: "Professor", department: "Computer Science", courses: ["CS 412 · Web Engineering", "CS 308 · Algorithms"], status: "Active" },
  { id: 4, campusId: "S39274", name: "Luis Hernandez", email: "luis.h@campus.edu", role: "Student", department: "Information Systems", course: "CS 412 · Web Engineering", status: "Invited" },
  { id: 5, campusId: "P50628", name: "Emma Brooks", email: "emma.b@campus.edu", role: "Professor", department: "Data Science", courses: ["DS 220 · Data Analytics"], status: "Active" },
  { id: 6, campusId: "S61483", name: "Sofia Kim", email: "sofia.kim@campus.edu", role: "Student", department: "Computer Science", status: "Active" },
  { id: 7, campusId: "S72045", name: "Ethan Brown", email: "ethan.brown@campus.edu", role: "Student", department: "Information Systems", status: "Active" },
];

const evaluationNames = ["Maya Chen", "Noah Williams", "Luis Hernandez", "Sofia Kim", "Ethan Brown", "Amara Okafor"];

const initialNotifications: CampusNotification[] = [
  { id: 1, audience: "student", recipient: "Maya Chen", title: "New feedback is available", message: "Dr. Patel graded React State Management. View your score and feedback.", time: "10 minutes ago", kind: "score", assignmentId: 4, read: false },
  { id: 2, audience: "student", title: "Assignment due soon", message: "REST API with Authentication is due tomorrow at 9:00 AM.", time: "1 hour ago", kind: "assignment", assignmentId: 1, read: false },
  { id: 3, audience: "student", recipient: "Maya Chen", title: "Submission received", message: "MongoDB Schema Design was submitted successfully and is awaiting review.", time: "4 days ago", kind: "system", assignmentId: 3, read: true },
  { id: 4, audience: "professor", title: "New assignment submission", message: "Noah Williams submitted REST API with Authentication. AI evaluation is ready for review.", time: "18 minutes ago", kind: "submission", assignmentId: 1, read: false },
  { id: 5, audience: "admin", title: "Course roster updated", message: "A student was added to CS 412 · Web Engineering.", time: "Yesterday", kind: "system", read: false },
];

function evaluationsFor(assignment: Assignment): StudentEvaluation[] {
  const count = assignment.status === "new" ? 3 : assignment.status === "submitted" ? 5 : 6;
  return evaluationNames.slice(0, count).map((student, index) => ({
    id: assignment.id * 100 + index,
    student,
    submittedAt: index === 0 ? "Today, 10:42 AM" : `${index + 1} day${index === 0 ? "" : "s"} ago`,
    score: Math.max(72, (assignment.grade ?? 92) - index * 2),
    plagiarism: [4, 7, 12, 3, 18, 6][index],
    status: assignment.status === "completed" ? "Score released" : "AI evaluated",
  }));
}

function questionAssessmentFor(assignment: Assignment, evaluation: StudentEvaluation, question: Question, index: number): QuestionAiAssessment {
  if (!assignment.aiEvaluationEnabled) {
    return {
      awardedPoints: null,
      justification: "AI evaluation is disabled for this assignment. This answer is waiting for the professor's manual review.",
    };
  }

  const scoreAdjustments = question.type === "code" ? [-5, -2, 1] : [2, -4, 0];
  const percentage = Math.max(55, Math.min(100, evaluation.score + scoreAdjustments[index % scoreAdjustments.length]));
  const awardedPoints = Math.max(0, Math.min(question.points, Math.round((question.points * percentage) / 100)));
  const deductedPoints = question.points - awardedPoints;

  if (deductedPoints === 0) {
    return {
      awardedPoints,
      justification: question.type === "code"
        ? `The solution satisfies the requested behavior, uses a clear implementation, and includes the expected validation. No points were deducted, so the AI awarded ${awardedPoints} of ${question.points} points.`
        : `The response directly answers the question, uses accurate terminology, and provides enough supporting detail. No points were deducted, so the AI awarded ${awardedPoints} of ${question.points} points.`,
    };
  }

  return {
    awardedPoints,
    justification: question.type === "code"
      ? `The core logic is correct and addresses the main requirement. The AI deducted ${deductedPoints} point${deductedPoints === 1 ? "" : "s"} because error handling, edge-case validation, or explanatory comments are incomplete. This results in ${awardedPoints} of ${question.points} points.`
      : `The answer demonstrates the correct main concept, but one supporting example or part of the requested explanation is incomplete. The AI deducted ${deductedPoints} point${deductedPoints === 1 ? "" : "s"}, resulting in ${awardedPoints} of ${question.points} points.`,
  };
}

function plagiarismEvidenceFor(assignment: Assignment, evaluation: StudentEvaluation): PlagiarismEvidence[] {
  if (!assignment.plagiarismCheckEnabled || evaluation.plagiarism === 0) return [];

  const codeQuestionIndex = assignment.questions.findIndex((question) => question.type === "code");
  const questionNumber = (codeQuestionIndex >= 0 ? codeQuestionIndex : 0) + 1;
  const primarySimilarity = Math.max(1, Math.round(evaluation.plagiarism * 0.65));
  const secondarySimilarity = Math.max(1, evaluation.plagiarism - primarySimilarity);

  return [
    {
      id: `${evaluation.id}-student-match`,
      source: "Previous course submission · S72045",
      location: `Question ${questionNumber} · lines 4–9`,
      similarity: primarySimilarity,
      studentExcerpt: "if (!token) return res.status(401).json({ message: 'Unauthorized' });\nconst decoded = jwt.verify(token, process.env.JWT_SECRET);",
      matchedExcerpt: "if (!token) return res.status(401).json({ message: 'Unauthorized' });\nconst decoded = jwt.verify(token, process.env.JWT_SECRET);",
      explanation: "The control flow, response text, and variable sequence match another submission. Common framework syntax is excluded where possible, but this block should still be reviewed by the professor.",
    },
    {
      id: `${evaluation.id}-reference-match`,
      source: "Course reference material · Authentication example",
      location: `Question ${questionNumber} · explanation after code`,
      similarity: secondarySimilarity,
      studentExcerpt: "The middleware verifies the signature and attaches the decoded user to req.user before calling next().",
      matchedExcerpt: "Verify the signature, attach the decoded user to req.user, and then call next().",
      explanation: "The wording and sequence are similar to the course example. Because this is approved course material, the professor may treat it as attribution guidance rather than student-to-student copying.",
    },
  ];
}

const initialAssignments: Assignment[] = [
  { id: 1, assignmentCode: "A18426", title: "REST API with Authentication", course: "CS 412 · Web Engineering", due: "Oct 01, 9:00 AM", dueAt: "2026-10-01T09:00:00-04:00", points: 100, status: "new", attempts: 0, aiEvaluationEnabled: true, plagiarismCheckEnabled: true, plagiarismThreshold: 30, questions: [
    { id: "1a", prompt: "Explain how access tokens and refresh tokens work together in a secure authentication flow.", type: "text", points: 25 },
    { id: "1b", prompt: "Write an Express middleware function that verifies a JWT and attaches the authenticated user to the request.", type: "code", points: 45, language: "JavaScript" },
    { id: "1c", prompt: "Describe three tests you would write for the authentication middleware.", type: "text", points: 30 },
  ] },
  { id: 2, assignmentCode: "A27519", title: "Graph Traversal Visualizer", course: "CS 308 · Algorithms", due: "Oct 07, 11:59 PM", dueAt: "2026-10-07T23:59:00-04:00", points: 80, status: "new", attempts: 0, aiEvaluationEnabled: true, plagiarismCheckEnabled: true, plagiarismThreshold: 30, questions: [
    { id: "2a", prompt: "Compare breadth-first search and depth-first search, including their time complexity.", type: "text", points: 30 },
    { id: "2b", prompt: "Implement breadth-first search for an adjacency-list graph and return the visit order.", type: "code", points: 50, language: "JavaScript" },
  ] },
  { id: 3, assignmentCode: "A39274", title: "MongoDB Schema Design", course: "CS 412 · Web Engineering", due: "Sep 26, 11:59 PM", dueAt: "2026-09-26T23:59:00-04:00", points: 75, status: "submitted", repo: "github.com/maya/campus-db", attempts: 1, aiEvaluationEnabled: true, plagiarismCheckEnabled: true, plagiarismThreshold: 30, questions: [
    { id: "3a", prompt: "When should related data be embedded rather than referenced in MongoDB?", type: "text", points: 30 },
    { id: "3b", prompt: "Create a Mongoose schema for an assignment with a weighted rubric.", type: "code", points: 45, language: "JavaScript" },
  ], submittedAnswers: { "3a": "Embed data that is read together and has bounded growth. Reference data that changes independently or can grow without a practical limit.", "3b": "const assignmentSchema = new Schema({\n  title: { type: String, required: true },\n  rubric: [{ criterion: String, weight: Number }]\n});" } },
  { id: 4, assignmentCode: "A43817", title: "React State Management", course: "CS 412 · Web Engineering", due: "Sep 18, 11:59 PM", dueAt: "2026-09-18T23:59:00-04:00", points: 100, status: "completed", grade: 88, attempts: 1, aiEvaluationEnabled: true, plagiarismCheckEnabled: true, plagiarismThreshold: 30, feedback: "Strong component structure and clear naming. Add loading and error states around the API calls, and split the dashboard reducer into smaller domain actions before resubmitting.", hasUnreadFeedback: true, questions: [
    { id: "4a", prompt: "Explain when useReducer is preferable to multiple useState calls.", type: "text", points: 35 },
    { id: "4b", prompt: "Create a reducer that supports loading, success, and error actions.", type: "code", points: 65, language: "TypeScript" },
  ], submittedAnswers: { "4a": "useReducer is useful when state transitions are related, complex, or benefit from one predictable action model.", "4b": "type State = { loading: boolean; data?: string; error?: string };\nfunction reducer(state: State, action: Action): State {\n  switch (action.type) {\n    case 'loading': return { loading: true };\n    case 'success': return { loading: false, data: action.data };\n    case 'error': return { loading: false, error: action.error };\n  }\n}" } },
  { id: 5, assignmentCode: "A50628", title: "Unit Testing Fundamentals", course: "CS 308 · Algorithms", due: "Sep 12, 11:59 PM", dueAt: "2026-09-12T23:59:00-04:00", points: 60, status: "completed", grade: 94, attempts: 2, aiEvaluationEnabled: true, plagiarismCheckEnabled: true, plagiarismThreshold: 30, feedback: "Excellent edge-case coverage. Your final version improved branch coverage from 76% to 93%. Keep the parameterized test pattern for future assignments.", hasUnreadFeedback: false, questions: [
    { id: "5a", prompt: "Explain the difference between a unit test and an integration test.", type: "text", points: 20 },
    { id: "5b", prompt: "Write parameterized tests for a function that validates student grades.", type: "code", points: 40, language: "JavaScript" },
  ], submittedAnswers: { "5a": "A unit test isolates one function or module; an integration test verifies multiple components working together.", "5b": "test.each([[90, true], [0, true], [-1, false], [101, false]])('grade %i', (grade, valid) => { expect(isValidGrade(grade)).toBe(valid); });" } },
];

const roleMeta = {
  admin: { label: "Admin", name: "Jordan Lee", initials: "JL", subtitle: "Institution workspace" },
  professor: { label: "Professor", name: "Dr. Aisha Patel", initials: "AP", subtitle: "CS 412 · Fall 2026" },
  student: { label: "Student", name: "Maya Chen", initials: "MC", subtitle: "Computer Science" },
} as const;

const courseOptions = ["CS 412 · Web Engineering", "CS 308 · Algorithms", "DS 220 · Data Analytics", "CS 250 · Database Systems"];

const navByRole = {
  admin: [
    { label: "Overview", icon: LayoutDashboard }, { label: "People", icon: Users },
    { label: "Courses", icon: BookOpen }, { label: "System activity", icon: Activity },
  ],
  professor: [
    { label: "Overview", icon: LayoutDashboard }, { label: "Assignments", icon: ClipboardCheck },
    { label: "Class roster", icon: Users }, { label: "Analytics", icon: TrendingUp },
  ],
  student: [
    { label: "Overview", icon: LayoutDashboard }, { label: "My homework", icon: BookOpen },
    { label: "Submissions", icon: GitBranch }, { label: "Progress", icon: TrendingUp },
  ],
};

function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div>{eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-[#5d6b84]">{eyebrow}</p>}<h2 className="text-[1.35rem] font-bold tracking-[-0.02em] text-[#12213f]">{title}</h2></div>{action}</div>;
}

function StatCard({ icon: Icon, label, value, note, tone = "blue" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; note: string; tone?: "blue" | "green" | "purple" | "orange" }) {
  const tones = { blue: "bg-[#e9efff] text-[#2457e6]", green: "bg-[#e5f7f1] text-[#13866a]", purple: "bg-[#efeaff] text-[#7151c8]", orange: "bg-[#fff1df] text-[#c36a13]" };
  return <div className="rounded-2xl border bg-white p-5 shadow-[0_6px_24px_rgba(20,33,61,0.04)]"><span className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-[1.15rem]" /></span><p className="mt-5 text-sm font-semibold text-[#69758a]">{label}</p><p className="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-[#12213f]">{value}</p><p className="mt-2 text-xs font-medium text-[#7e899b]">{note}</p></div>;
}

function CompactStatCard({ icon: Icon, label, value, tone = "blue" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: "blue" | "green" | "purple" | "orange" }) {
  const tones = { blue: "bg-[#e9efff] text-[#2457e6]", green: "bg-[#e5f7f1] text-[#13866a]", purple: "bg-[#efeaff] text-[#7151c8]", orange: "bg-[#fff1df] text-[#c36a13]" };
  return <div className="flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-[0_6px_24px_rgba(20,33,61,0.04)]"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-[1.15rem]" /></span><div><p className="text-xs font-bold uppercase tracking-[0.08em] text-[#78849a]">{label}</p><p className="mt-0.5 text-2xl font-extrabold tracking-[-0.03em] text-[#12213f]">{value}</p></div></div>;
}

function ReadOnlyDetail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#7b8799]">{label}</p><p className="mt-1 text-sm font-semibold text-[#1b2b4b]">{value}</p></div>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: "border-[#bce7da] bg-[#eaf9f4] text-[#11765f]", Invited: "border-[#f5d7a7] bg-[#fff7e9] text-[#a25b16]",
    Published: "border-[#bfd0ff] bg-[#edf2ff] text-[#2852c1]", Draft: "border-[#d7dce5] bg-[#f4f6f8] text-[#69758a]",
    "Needs review": "border-[#eed3b2] bg-[#fff6e8] text-[#9a5b18]",
  };
  return <Badge variant="outline" className={styles[status] ?? "bg-muted"}>{status}</Badge>;
}

function getDeadlineInfo(assignment: Assignment) {
  const difference = new Date(assignment.dueAt).getTime() - Date.now();
  if (difference <= 0) return { label: "Deadline passed", className: "border-[#f1bbb7] bg-[#fff0ef] text-[#c93832]" };
  const hours = Math.ceil(difference / 3_600_000);
  if (hours < 24) return { label: `${hours} hour${hours === 1 ? "" : "s"} remaining`, className: "border-[#efcf9f] bg-[#fff4e5] text-[#a75b12]" };
  const days = Math.ceil(hours / 24);
  return { label: `${days} day${days === 1 ? "" : "s"} remaining`, className: "border-[#c9d6fa] bg-[#eef3ff] text-[#315fe3]" };
}

function formatDueAt(dueAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dueAt));
}

function generatePrefixedCode(prefix: "S" | "P" | "A", usedCodes: string[]) {
  let code = "";
  do code = `${prefix}${Math.floor(10000 + Math.random() * 90000)}`;
  while (usedCodes.includes(code));
  return code;
}

export function CampusGradeApp() {
  const [role, setRole] = useState<Role>("student");
  const [mobileNav, setMobileNav] = useState(false);
  const [people, setPeople] = useState(initialPeople);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [personDialog, setPersonDialog] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [personForm, setPersonForm] = useState({ name: "", email: "", role: "Student" as UserRole, department: "Computer Science", courses: [] as string[] });
  const [coursePicker, setCoursePicker] = useState("");
  const [studentLookup, setStudentLookup] = useState("");
  const [selectedRosterStudent, setSelectedRosterStudent] = useState<Person | null>(null);
  const [assignmentDialog, setAssignmentDialog] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({ topic: "", outcome: "", difficulty: "Intermediate", dueDate: "", dueTime: "23:59", aiEvaluationEnabled: true, plagiarismCheckEnabled: true, plagiarismThreshold: "30" });
  const [feedbackDialog, setFeedbackDialog] = useState<Assignment | null>(null);
  const [feedbackHistoryDialog, setFeedbackHistoryDialog] = useState(false);
  const [notificationDialog, setNotificationDialog] = useState(false);
  const [homeworkDialog, setHomeworkDialog] = useState<Assignment | null>(null);
  const [homeworkMode, setHomeworkMode] = useState<HomeworkMode>("edit");
  const [answers, setAnswers] = useState<Record<number, Record<string, string>>>(() => Object.fromEntries(initialAssignments.map((assignment) => [assignment.id, assignment.submittedAnswers ?? {}])));
  const [activeSection, setActiveSection] = useState("Overview");
  const [search, setSearch] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<Person | null>(null);
  const [assignmentDetail, setAssignmentDetail] = useState<Assignment | null>(null);
  const [evaluationDetail, setEvaluationDetail] = useState<{ assignment: Assignment; evaluation: StudentEvaluation } | null>(null);
  const [plagiarismDetail, setPlagiarismDetail] = useState<{ assignment: Assignment; evaluation: StudentEvaluation } | null>(null);
  const [manualScore, setManualScore] = useState("");
  const [evaluationScores, setEvaluationScores] = useState<Record<number, number>>({});
  const [notifications, setNotifications] = useState<CampusNotification[]>(initialNotifications);
  const meta = roleMeta[role];
  const visibleNotifications = notifications.filter((notification) => notification.audience === role && (!notification.recipient || notification.recipient === meta.name));
  const unreadNotificationCount = visibleNotifications.filter((notification) => !notification.read).length;
  const rosterSuggestions = useMemo(() => {
    const query = studentLookup.trim().toLowerCase();
    if (!query) return [];
    return people.filter((person) => person.role === "Student" && person.course !== "CS 412 · Web Engineering" && `${person.campusId} ${person.email}`.toLowerCase().includes(query)).slice(0, 5);
  }, [people, studentLookup]);

  const updateStudentLookup = (value: string) => {
    setStudentLookup(value);
    const query = value.trim().toLowerCase();
    const exactStudent = people.find((person) => person.role === "Student" && person.course !== "CS 412 · Web Engineering" && (person.campusId.toLowerCase() === query || person.email.toLowerCase() === query));
    setSelectedRosterStudent(exactStudent ?? null);
  };

  const switchRole = (nextRole: Role) => { setRole(nextRole); setActiveSection("Overview"); setMobileNav(false); toast.success(`${roleMeta[nextRole].label} portal opened`); };
  const pushNotification = (notification: Omit<CampusNotification, "id" | "time" | "read">) => {
    setNotifications((current) => [{ ...notification, id: Date.now() + current.length, time: "Just now", read: false }, ...current]);
  };
  const openPerson = (person?: Person) => {
    if (role === "professor") {
      setEditingPerson(null); setStudentLookup(""); setSelectedRosterStudent(null);
    } else if (person) {
      setEditingPerson(person); setPersonForm({ name: person.name, email: person.email, role: person.role, department: person.department, courses: person.courses ?? [] });
    } else {
      setEditingPerson(null); setPersonForm({ name: "", email: "", role: "Student", department: "Computer Science", courses: [] }); setCoursePicker("");
    }
    setPersonDialog(true);
  };
  const savePerson = (event: FormEvent) => {
    event.preventDefault();
    if (role === "professor") {
      if (!selectedRosterStudent) return;
      setPeople((current) => current.map((person) => person.id === selectedRosterStudent.id ? { ...person, course: "CS 412 · Web Engineering" } : person));
      toast.success(`${selectedRosterStudent.name} added to CS 412`);
      setPersonDialog(false); setStudentLookup(""); setSelectedRosterStudent(null);
      return;
    }
    if (!personForm.name.trim() || !personForm.email.trim()) return;
    if (editingPerson) { setPeople((current) => current.map((person) => person.id === editingPerson.id ? { ...person, ...personForm } : person)); toast.success("User profile updated"); }
    else {
      const prefix = personForm.role === "Professor" ? "P" : "S";
      const campusId = generatePrefixedCode(prefix, people.map((person) => person.campusId));
      setPeople((current) => [...current, { id: Date.now(), campusId, ...personForm, status: "Invited" }]);
      toast.success(`${personForm.role} account ${campusId} created`);
    }
    setPersonDialog(false);
  };
  const removePerson = (person: Person) => setDeleteCandidate(person);
  const confirmRemovePerson = () => {
    if (!deleteCandidate) return;
    if (role === "professor") {
      setPeople((current) => current.map((item) => item.id === deleteCandidate.id ? { ...item, course: undefined } : item));
      toast.success(`${deleteCandidate.name} removed from CS 412`);
    } else {
      setPeople((current) => current.filter((item) => item.id !== deleteCandidate.id));
      toast.success(`${deleteCandidate.name} removed`);
    }
    setDeleteCandidate(null);
  };
  const generateAssignment = (event: FormEvent) => {
    event.preventDefault();
    if (!assignmentForm.topic.trim() || !assignmentForm.dueDate || !assignmentForm.dueTime) return;
    const title = assignmentForm.topic.replace(/\b\w/g, (letter) => letter.toUpperCase());
    const deadline = new Date(`${assignmentForm.dueDate}T${assignmentForm.dueTime}:00`);
    const created: Assignment = {
      id: Date.now(), assignmentCode: generatePrefixedCode("A", assignments.map((assignment) => assignment.assignmentCode)), title, course: "CS 412 · Web Engineering", due: formatDueAt(deadline.toISOString()), dueAt: deadline.toISOString(), points: 100, status: "new", attempts: 0, aiEvaluationEnabled: assignmentForm.aiEvaluationEnabled, plagiarismCheckEnabled: assignmentForm.plagiarismCheckEnabled, plagiarismThreshold: Number(assignmentForm.plagiarismThreshold),
      questions: [
        { id: `q-${Date.now()}-1`, prompt: `Explain the key design decisions and tradeoffs for ${assignmentForm.topic}.`, type: "text", points: 25 },
        { id: `q-${Date.now()}-2`, prompt: `Write the core implementation for ${assignmentForm.topic}. Include validation and clear error handling.`, type: "code", points: 50, language: "JavaScript" },
        { id: `q-${Date.now()}-3`, prompt: `Describe the tests you would use to prove your solution meets the learning outcome: ${assignmentForm.outcome || "correctness and maintainability"}.`, type: "text", points: 25 },
      ],
    };
    setAssignments((current) => [created, ...current]);
    setAssignmentDialog(false); setAssignmentForm({ topic: "", outcome: "", difficulty: "Intermediate", dueDate: "", dueTime: "23:59", aiEvaluationEnabled: true, plagiarismCheckEnabled: true, plagiarismThreshold: "30" });
    setHomeworkDialog(created); setHomeworkMode("preview"); setActiveSection("Assignments");
    toast.success(`Assignment ${created.assignmentCode} generated`, { description: "Three questions and answer formats are ready for review." });
  };
  const openHomework = (assignment: Assignment, mode: HomeworkMode) => {
    setHomeworkDialog(assignment); setHomeworkMode(mode);
    if (mode === "edit" && assignment.submittedAnswers) setAnswers((current) => ({ ...current, [assignment.id]: { ...assignment.submittedAnswers } }));
  };
  const submitHomework = () => {
    if (!homeworkDialog) return;
    const currentAnswers = answers[homeworkDialog.id] ?? {};
    const missing = homeworkDialog.questions.some((question) => !currentAnswers[question.id]?.trim());
    if (missing) { toast.error("Please answer every question before submitting."); return; }
    const updated = { ...homeworkDialog, status: "submitted" as AssignmentStatus, submittedAnswers: currentAnswers, attempts: homeworkDialog.attempts + 1, hasUnreadFeedback: false };
    setAssignments((current) => current.map((assignment) => assignment.id === updated.id ? updated : assignment));
    setHomeworkDialog(updated); setHomeworkMode("view");
    pushNotification({ audience: "professor", title: "New assignment submission", message: `${meta.name} submitted ${updated.title}. AI evaluation started automatically.`, kind: "submission", assignmentId: updated.id });
    toast.success("Homework submitted", { description: "Your answers are now locked and available for review." });
  };
  const openFeedback = (assignment: Assignment) => {
    setAssignments((current) => current.map((item) => item.id === assignment.id ? { ...item, hasUnreadFeedback: false } : item));
    setFeedbackDialog({ ...assignment, hasUnreadFeedback: false });
  };
  const publishAssignment = () => {
    if (!homeworkDialog) return;
    pushNotification({ audience: "student", title: "New assignment published", message: `Dr. Aisha Patel published ${homeworkDialog.title}. It is due ${homeworkDialog.due}.`, kind: "assignment", assignmentId: homeworkDialog.id });
    setHomeworkDialog(null);
    toast.success("Assignment published to the class");
  };
  const releaseScoreToStudent = (detail: { assignment: Assignment; evaluation: StudentEvaluation }, score: number) => {
    setEvaluationScores((current) => ({ ...current, [detail.evaluation.id]: score }));
    setAssignments((current) => current.map((assignment) => assignment.id === detail.assignment.id ? { ...assignment, status: "completed", grade: score, feedback: assignment.feedback ?? "Your professor reviewed the AI evaluation and released the final score.", hasUnreadFeedback: true } : assignment));
    pushNotification({ audience: "student", recipient: detail.evaluation.student, title: "Score is now available", message: `Dr. Aisha Patel released your score for ${detail.assignment.title}: ${score}%.`, kind: "score", assignmentId: detail.assignment.id });
    toast.success(`Score sent to ${detail.evaluation.student}`);
    setEvaluationDetail(null);
  };
  const releaseAllScores = (assignment?: Assignment) => {
    if (assignment) {
      const averageScore = Math.round(evaluationsFor(assignment).reduce((total, evaluation) => total + (evaluationScores[evaluation.id] ?? evaluation.score), 0) / evaluationsFor(assignment).length);
      setAssignments((current) => current.map((item) => item.id === assignment.id ? { ...item, status: "completed", grade: averageScore, feedback: item.feedback ?? "Your professor reviewed the AI evaluation and released the final score.", hasUnreadFeedback: true } : item));
      pushNotification({ audience: "student", title: "Assignment scores released", message: `Scores and feedback for ${assignment.title} are now available.`, kind: "score", assignmentId: assignment.id });
      toast.success(`All scores for ${assignment.title} sent to students`);
      return;
    }
    pushNotification({ audience: "student", title: "New scores are available", message: "Your professor released the latest evaluated assignment scores and feedback.", kind: "score" });
    toast.success("All evaluated scores submitted to students");
  };
  const openNotification = (notification: CampusNotification) => {
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    setNotificationDialog(false);
    const assignment = notification.assignmentId ? assignments.find((item) => item.id === notification.assignmentId) : undefined;
    if (!assignment) return;
    if (notification.kind === "submission") { setAssignmentDetail(assignment); return; }
    if (notification.kind === "score") { openFeedback(assignment); return; }
    if (notification.kind === "assignment") openHomework(assignment, "edit");
  };

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: { registerTool?: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(modelContext.registerTool({
      name: "switch_campusgrade_portal", title: "Switch CampusGrade portal",
      description: "Open the Admin, Professor, or Student demonstration portal.",
      inputSchema: { type: "object", properties: { role: { type: "string", enum: ["admin", "professor", "student"] } }, required: ["role"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const nextRole = (input as { role?: Role }).role;
        if (!nextRole || !["admin", "professor", "student"].includes(nextRole)) throw new Error("Choose admin, professor, or student.");
        setRole(nextRole); setActiveSection("Overview"); setMobileNav(false); return { portal: nextRole, status: "opened" };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  return <div className="min-h-screen bg-[#f4f7fb] text-[#14213d]">
    <Toaster position="top-right" richColors duration={4500} />
    {mobileNav && <button className="fixed inset-0 z-30 bg-[#07142d]/45 lg:hidden" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#10214a] px-4 py-5 text-white transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center justify-between px-2"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#315fe3] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"><GraduationCap className="size-6" /></div><div><p className="text-lg font-extrabold tracking-[-0.03em]">CampusGrade</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#aabcf0]">Academic OS</p></div></div><Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setMobileNav(false)}><X /></Button></div>
      <div className="mt-7 rounded-xl border border-white/10 bg-white/[0.055] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9eb2e8]">Viewing as</p><div className="mt-2 flex items-center gap-3"><div className="grid size-9 place-items-center rounded-full bg-[#8ba7ff] text-xs font-extrabold text-[#10214a]">{meta.initials}</div><div className="min-w-0"><p className="truncate text-sm font-bold">{meta.name}</p><p className="truncate text-xs text-[#aab8db]">{meta.label} portal</p></div></div></div>
      <nav className="mt-6 space-y-1" aria-label={`${meta.label} navigation`}>{navByRole[role].map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActiveSection(label); setMobileNav(false); }} aria-current={activeSection === label ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${activeSection === label ? "bg-[#315fe3] text-white shadow-[0_5px_16px_rgba(0,0,0,0.16)]" : "text-[#b8c5e6] hover:bg-white/[0.07] hover:text-white"}`}><Icon className="size-[1.1rem]" /><span>{label}</span></button>)}</nav>
      <div className="mt-auto rounded-2xl border border-[#40588d] bg-[#172d5c] p-4"><div className="mb-3 flex items-center gap-2"><Sparkles className="size-4 text-[#f4b867]" /><span className="text-xs font-bold uppercase tracking-[0.1em] text-[#dce5ff]">AI service online</span></div><p className="text-xs leading-5 text-[#b8c5e6]">Assignment generation and code evaluation are ready.</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[86%] rounded-full bg-[#70d5b8]" /></div></div>
    </aside>

    <div className="lg:pl-[260px]">
      <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b bg-white/95 px-4 backdrop-blur sm:px-7 lg:px-9"><div className="flex items-center gap-3"><Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setMobileNav(true)}><Menu /></Button><div><p className="text-lg font-extrabold tracking-[-0.025em] text-[#12213f]">{activeSection}</p><p className="hidden text-xs font-medium text-[#78849a] sm:block">{meta.label} portal · {meta.subtitle}</p></div></div><div className="flex items-center gap-2 sm:gap-3"><div className="hidden items-center gap-2 rounded-lg border bg-[#f8faff] px-2.5 py-1.5 md:flex"><span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8290a6]">Demo role</span><Select value={role} onValueChange={(value) => switchRole(value as Role)}><SelectTrigger className="h-8 min-w-[122px] border-0 bg-white shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="professor">Professor</SelectItem><SelectItem value="student">Student</SelectItem></SelectContent></Select></div><Select value={role} onValueChange={(value) => switchRole(value as Role)}><SelectTrigger aria-label="Switch demo portal" className="w-[118px] md:hidden"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="professor">Professor</SelectItem><SelectItem value="student">Student</SelectItem></SelectContent></Select><Button size="icon" variant="outline" className="relative rounded-full" aria-label="Open notifications" onClick={() => setNotificationDialog(true)}><Bell />{unreadNotificationCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full border-2 border-white bg-[#ea5a63] px-1 text-[10px] font-bold text-white">{unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}</span>}</Button><div className="hidden size-9 place-items-center rounded-full bg-[#dbe4ff] text-xs font-extrabold text-[#2146ad] sm:grid">{meta.initials}</div></div></header>
      <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 lg:px-9 lg:py-9">
        {role === "admin" && <AdminPortal section={activeSection} people={people} search={search} setSearch={setSearch} openPerson={openPerson} removePerson={removePerson} />}
        {role === "professor" && <ProfessorPortal section={activeSection} people={people} assignments={assignments} openPerson={openPerson} removePerson={removePerson} openGenerator={() => setAssignmentDialog(true)} preview={(assignment) => openHomework(assignment, "preview")} openAssignment={setAssignmentDetail} releaseAllScores={releaseAllScores} />}
        {role === "student" && <StudentPortal section={activeSection} assignments={assignments} openHomework={openHomework} feedback={openFeedback} viewAllFeedback={() => setFeedbackHistoryDialog(true)} />}
      </main>
    </div>

    <Dialog open={personDialog} onOpenChange={setPersonDialog}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl"><form onSubmit={savePerson}><DialogHeader><DialogTitle>{role === "professor" ? "Add student to class" : editingPerson ? "Edit campus user" : "Add campus user"}</DialogTitle><DialogDescription>{role === "professor" ? "Find an existing campus student by ID or email. Profile information is managed by an administrator." : editingPerson ? "Update profile and academic information." : "Create a student or professor account and generate a campus ID."}</DialogDescription></DialogHeader>{role === "professor" ? <div className="grid gap-4 py-5"><div className="rounded-xl border border-[#cbd7fa] bg-[#f3f6ff] p-3 text-sm"><p className="font-bold text-[#1b2b4b]">CS 412 · Web Engineering</p><p className="mt-1 text-xs text-[#647187]">The selected student will be added to this class.</p></div><label className="grid gap-1.5 text-sm font-semibold">Student ID or campus email<Input value={studentLookup} onChange={(event) => updateStudentLookup(event.target.value)} placeholder="Start typing S61483 or sofia.kim@campus.edu" autoFocus /></label>{!selectedRosterStudent && rosterSuggestions.length > 0 && <div className="overflow-hidden rounded-xl border bg-white shadow-sm">{rosterSuggestions.map((student) => <button key={student.id} type="button" className="flex w-full items-center justify-between gap-4 border-b p-3 text-left last:border-b-0 hover:bg-[#f7f9ff]" onClick={() => { setSelectedRosterStudent(student); setStudentLookup(`${student.campusId} · ${student.email}`); }}><span><span className="block text-sm font-bold text-[#1b2b4b]">{student.name}</span><span className="mt-0.5 block text-xs text-[#718096]">{student.email} · {student.department}</span></span><Badge variant="outline">{student.campusId}</Badge></button>)}</div>}{!selectedRosterStudent && studentLookup.trim() && rosterSuggestions.length === 0 && <div className="rounded-xl border border-dashed p-4 text-sm text-[#69758a]">No available campus student found. Ask an administrator to create the account first.</div>}{selectedRosterStudent && <div className="grid gap-3 rounded-xl border bg-[#f8faff] p-4 sm:grid-cols-2"><ReadOnlyDetail label="Full name" value={selectedRosterStudent.name} /><ReadOnlyDetail label="Student ID" value={selectedRosterStudent.campusId} /><ReadOnlyDetail label="Campus email" value={selectedRosterStudent.email} /><ReadOnlyDetail label="Role" value={selectedRosterStudent.role} /><ReadOnlyDetail label="Department" value={selectedRosterStudent.department} /></div>}</div> : <div className="grid gap-4 py-5"><label className="grid gap-1.5 text-sm font-semibold">Full name<Input required value={personForm.name} onChange={(event) => setPersonForm({ ...personForm, name: event.target.value })} placeholder="e.g. Taylor Morgan" autoFocus /></label><label className="grid gap-1.5 text-sm font-semibold">Campus email<Input required type="email" value={personForm.email} onChange={(event) => setPersonForm({ ...personForm, email: event.target.value })} placeholder="name@campus.edu" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold">Role<Select value={personForm.role} onValueChange={(value) => setPersonForm({ ...personForm, role: value as UserRole, courses: value === "Professor" ? personForm.courses : [] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Student">Student</SelectItem><SelectItem value="Professor">Professor</SelectItem></SelectContent></Select></label><label className="grid gap-1.5 text-sm font-semibold">Department<Input required value={personForm.department} onChange={(event) => setPersonForm({ ...personForm, department: event.target.value })} /></label></div>{editingPerson ? <label className="grid gap-1.5 text-sm font-semibold">{editingPerson.role} ID<Input readOnly value={editingPerson.campusId} className="bg-[#f3f5f8] font-bold" /></label> : <div className="rounded-xl border border-dashed bg-[#fafbfc] p-3 text-xs text-[#69758a]">A unique {personForm.role === "Professor" ? "P" : "S"} + five-digit campus ID will be generated automatically.</div>}{personForm.role === "Professor" && <div className="grid gap-2"><label className="text-sm font-semibold">Courses taught</label><Select value={coursePicker} onValueChange={(value) => { if (!personForm.courses.includes(value)) setPersonForm({ ...personForm, courses: [...personForm.courses, value] }); setCoursePicker(""); }}><SelectTrigger className="w-full"><SelectValue placeholder="Select a course" /></SelectTrigger><SelectContent>{courseOptions.map((course) => <SelectItem key={course} value={course}>{course}</SelectItem>)}</SelectContent></Select><div className="flex flex-wrap gap-2">{personForm.courses.map((course) => <Badge key={course} variant="outline" className="gap-1 border-[#cbd7fa] bg-[#f3f6ff] text-[#3155b7]">{course}<button type="button" aria-label={`Remove ${course}`} onClick={() => setPersonForm({ ...personForm, courses: personForm.courses.filter((item) => item !== course) })}><X className="size-3" /></button></Badge>)}</div></div>}</div>}<DialogFooter><Button type="button" variant="outline" onClick={() => setPersonDialog(false)}>Cancel</Button><Button type="submit" disabled={role === "professor" && !selectedRosterStudent}>{editingPerson ? "Save changes" : role === "professor" ? "Add student to class" : "Create campus user"}</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={Boolean(deleteCandidate)} onOpenChange={(open) => !open && setDeleteCandidate(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Remove {deleteCandidate?.role?.toLowerCase()}?</DialogTitle><DialogDescription>{deleteCandidate?.name} will lose access to {role === "professor" ? deleteCandidate?.course ?? "this class" : "the CampusGrade workspace"}. This demo action can’t be undone.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteCandidate(null)}>Cancel</Button><Button className="bg-[#c93832] text-white hover:bg-[#ae2e29]" onClick={confirmRemovePerson}><Trash2 />Remove {deleteCandidate?.role?.toLowerCase()}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(assignmentDetail)} onOpenChange={(open) => !open && setAssignmentDetail(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{assignmentDetail?.title}</DialogTitle><DialogDescription>{assignmentDetail?.assignmentCode} · {assignmentDetail?.course} · {assignmentDetail?.questions.length} questions · Due {assignmentDetail?.due}</DialogDescription></DialogHeader>{assignmentDetail && <><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-[#f8faff] p-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#77849a]">Submitted</p><p className="mt-1 text-2xl font-extrabold">{evaluationsFor(assignmentDetail).length} <span className="text-sm font-semibold text-[#7b8799]">of 32</span></p></div><div className="rounded-xl border bg-[#f8faff] p-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#77849a]">{assignmentDetail.aiEvaluationEnabled ? "AI evaluated" : "Grading mode"}</p><p className={`mt-1 font-extrabold ${assignmentDetail.aiEvaluationEnabled ? "text-2xl text-[#16866a]" : "text-base text-[#a75b12]"}`}>{assignmentDetail.aiEvaluationEnabled ? evaluationsFor(assignmentDetail).length : "Manual review"}</p></div><div className="rounded-xl border bg-[#f8faff] p-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#77849a]">Plagiarism check</p><p className="mt-1 text-2xl font-extrabold text-[#315fe3]">{assignmentDetail.plagiarismCheckEnabled ? `${assignmentDetail.plagiarismThreshold}% allowed` : "Off"}</p></div></div><div className="overflow-hidden rounded-xl border"><Table><TableHeader className="bg-[#f7f9fc]"><TableRow><TableHead className="pl-4">Student</TableHead><TableHead>Submitted</TableHead><TableHead>Score</TableHead><TableHead>Plagiarism</TableHead><TableHead className="text-right">Assignment</TableHead></TableRow></TableHeader><TableBody>{evaluationsFor(assignmentDetail).map((evaluation) => <TableRow key={evaluation.id}><TableCell className="pl-4 font-bold">{evaluation.student}</TableCell><TableCell className="text-[#68758a]">{evaluation.submittedAt}</TableCell><TableCell>{assignmentDetail.aiEvaluationEnabled ? <Badge variant="outline" className="border-[#bce7da] bg-[#eaf9f4] text-[#11765f]">{evaluationScores[evaluation.id] ?? evaluation.score}% · evaluated</Badge> : <Badge variant="outline" className="border-[#eed3b2] bg-[#fff6e8] text-[#9a5b18]">Manual grading</Badge>}</TableCell><TableCell>{assignmentDetail.plagiarismCheckEnabled ? <span className={`font-bold ${evaluation.plagiarism > assignmentDetail.plagiarismThreshold ? "text-[#c93832]" : "text-[#5f6d82]"}`}>{evaluation.plagiarism}%</span> : <span className="text-sm text-[#8a96a8]">Not checked</span>}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => { setEvaluationDetail({ assignment: assignmentDetail, evaluation }); setManualScore(String(evaluationScores[evaluation.id] ?? evaluation.score)); }}>Open submission</Button></TableCell></TableRow>)}</TableBody></Table></div><DialogFooter className="gap-2 sm:justify-between"><Button variant="outline" onClick={() => openHomework(assignmentDetail, "preview")}><BookOpen />View questions</Button><Button onClick={() => releaseAllScores(assignmentDetail)}><CheckCircle2 />Submit all scores</Button></DialogFooter></>}</DialogContent></Dialog>

    <Dialog
      open={Boolean(evaluationDetail)}
      onOpenChange={(open) => {
        if (!open) {
          setEvaluationDetail(null);
          setPlagiarismDetail(null);
        }
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{evaluationDetail?.evaluation.student} · {evaluationDetail?.assignment.title}</DialogTitle>
          <DialogDescription>
            Submitted answers are read-only. Review the AI score and reasoning before releasing the professor-approved result.
          </DialogDescription>
        </DialogHeader>
        {evaluationDetail && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#c7e8de] bg-[#eefaf6] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#58786f]">AI score</p>
                <p className="mt-1 text-3xl font-extrabold text-[#16866a]">
                  {evaluationDetail.assignment.aiEvaluationEnabled ? (evaluationScores[evaluationDetail.evaluation.id] ?? evaluationDetail.evaluation.score) + "%" : "Not run"}
                </p>
              </div>
              <button
                type="button"
                disabled={!evaluationDetail.assignment.plagiarismCheckEnabled}
                onClick={() => setPlagiarismDetail(evaluationDetail)}
                className="group rounded-xl border bg-[#f8faff] p-4 text-left transition-colors enabled:hover:border-[#b7c7f3] enabled:hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-65"
              >
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#77849a]">Plagiarism match</p>
                <p className={evaluationDetail.evaluation.plagiarism > evaluationDetail.assignment.plagiarismThreshold ? "mt-1 text-3xl font-extrabold text-[#c93832]" : "mt-1 text-3xl font-extrabold text-[#315fe3]"}>
                  {evaluationDetail.assignment.plagiarismCheckEnabled ? evaluationDetail.evaluation.plagiarism + "%" : "Not checked"}
                </p>
                <span className="mt-2 block text-xs font-bold text-[#315fe3] group-enabled:group-hover:underline">
                  {evaluationDetail.assignment.plagiarismCheckEnabled ? "View matched evidence →" : "Plagiarism check was disabled"}
                </span>
              </button>
              <label className="rounded-xl border bg-white p-4 text-xs font-bold uppercase tracking-[0.1em] text-[#77849a]">
                Professor score
                <Input type="number" min="0" max="100" value={manualScore} onChange={(event) => setManualScore(event.target.value)} className="mt-2 text-base font-bold normal-case tracking-normal" />
              </label>
            </div>
            <div className="rounded-xl border bg-[#f8faff] p-4">
              <p className="text-sm font-bold text-[#1b2b4b]">AI evaluation summary</p>
              <p className="mt-2 text-sm leading-6 text-[#647187]">
                {evaluationDetail.assignment.aiEvaluationEnabled
                  ? "The solution meets the main functional requirements and is clearly structured. Input validation is strong; error handling and test coverage could be expanded. Review the question-level explanations below before finalizing the score."
                  : "AI evaluation was disabled for this assignment. The professor must review and score each response manually."}
              </p>
            </div>
            <div className="grid gap-3">
              {evaluationDetail.assignment.questions.map((question, index) => {
                const assessment = questionAssessmentFor(evaluationDetail.assignment, evaluationDetail.evaluation, question, index);
                const awardedPercentage = assessment.awardedPoints === null ? null : (assessment.awardedPoints / question.points) * 100;

                return (
                  <section key={question.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#77849a]">Question {index + 1}</p>
                        <p className="mt-1 font-bold">{question.prompt}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Badge variant="outline" className="border-[#cbd7fa] bg-[#f3f6ff] text-[#3155b7]">Maximum {question.points} pts</Badge>
                        <Badge
                          variant="outline"
                          className={awardedPercentage === null
                            ? "border-[#d8dee8] bg-[#f3f5f8] text-[#68758a]"
                            : awardedPercentage >= 80
                              ? "border-[#bce7da] bg-[#eaf9f4] text-[#11765f]"
                              : "border-[#f0cda6] bg-[#fff5e8] text-[#a45b17]"}
                        >
                          {assessment.awardedPoints === null ? "AI not run" : "AI awarded " + assessment.awardedPoints + " pts"}
                        </Badge>
                      </div>
                    </div>
                    <div className={question.type === "code" ? "mt-3 whitespace-pre-wrap rounded-lg bg-[#101827] p-3 font-mono text-sm leading-6 text-[#d9e4f5]" : "mt-3 whitespace-pre-wrap rounded-lg bg-[#f6f8fb] p-3 text-sm leading-6 text-[#5f6d82]"}>
                      {evaluationDetail.assignment.submittedAnswers?.[question.id] ?? (question.type === "code"
                        ? "// Student code submission\nfunction solution(input) {\n  return validate(input);\n}"
                        : "The student’s submitted written response is shown here for faculty review.")}
                    </div>
                    <div className="mt-3 rounded-lg border border-[#ded6f5] border-l-4 border-l-[#7151c8] bg-[#faf8ff] p-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#443174]"><Bot className="size-4" />AI scoring justification</div>
                      <p className="mt-1.5 text-sm leading-6 text-[#625a73]">{assessment.justification}</p>
                    </div>
                  </section>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEvaluationDetail(null)}>Close</Button>
              <Button variant="secondary" onClick={() => {
                const score = Math.max(0, Math.min(100, Number(manualScore)));
                setEvaluationScores((current) => ({ ...current, [evaluationDetail.evaluation.id]: score }));
                toast.success("Manual score updated");
              }}>Update score</Button>
              <Button onClick={() => {
                const score = Math.max(0, Math.min(100, Number(manualScore)));
                releaseScoreToStudent(evaluationDetail, score);
              }}><CheckCircle2 />Submit score to student</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(plagiarismDetail)} onOpenChange={(open) => !open && setPlagiarismDetail(null)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Plagiarism evidence · {plagiarismDetail?.evaluation.student}</DialogTitle>
          <DialogDescription>
            {plagiarismDetail?.assignment.assignmentCode} · {plagiarismDetail?.assignment.title} · Review the matched locations before making a final academic-integrity decision.
          </DialogDescription>
        </DialogHeader>
        {plagiarismDetail && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-[#f8faff] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#77849a]">Overall match</p>
                <p className={plagiarismDetail.evaluation.plagiarism > plagiarismDetail.assignment.plagiarismThreshold ? "mt-1 text-3xl font-extrabold text-[#c93832]" : "mt-1 text-3xl font-extrabold text-[#315fe3]"}>{plagiarismDetail.evaluation.plagiarism}%</p>
              </div>
              <div className="rounded-xl border bg-[#f8faff] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#77849a]">Allowed threshold</p>
                <p className="mt-1 text-3xl font-extrabold text-[#1b2b4b]">{plagiarismDetail.assignment.plagiarismThreshold}%</p>
              </div>
              <div className={plagiarismDetail.evaluation.plagiarism > plagiarismDetail.assignment.plagiarismThreshold ? "rounded-xl border border-[#f2c2be] bg-[#fff1f0] p-4" : "rounded-xl border border-[#c7e8de] bg-[#eefaf6] p-4"}>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#77849a]">Review status</p>
                <p className={plagiarismDetail.evaluation.plagiarism > plagiarismDetail.assignment.plagiarismThreshold ? "mt-2 font-extrabold text-[#b42318]" : "mt-2 font-extrabold text-[#11765f]"}>
                  {plagiarismDetail.evaluation.plagiarism > plagiarismDetail.assignment.plagiarismThreshold ? "Above allowed limit" : "Within allowed limit"}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-[#f0cda6] bg-[#fff8ed] p-3 text-sm leading-6 text-[#82511f]">
              AI similarity is supporting evidence, not a final finding of misconduct. The professor should review the context and approved course material before speaking with the student.
            </div>
            <div className="grid gap-4">
              {plagiarismEvidenceFor(plagiarismDetail.assignment, plagiarismDetail.evaluation).map((evidence, index) => (
                <section key={evidence.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#77849a]">Match {index + 1}</p>
                      <h3 className="mt-1 font-bold text-[#1b2b4b]">{evidence.source}</h3>
                      <p className="mt-1 text-sm text-[#68758a]">{evidence.location}</p>
                    </div>
                    <Badge variant="outline" className="w-fit border-[#f0cda6] bg-[#fff5e8] text-[#a45b17]">{evidence.similarity}% matched</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#5f6d82]">Student submission</p>
                      <pre className="min-h-28 whitespace-pre-wrap rounded-lg bg-[#101827] p-3 text-xs leading-5 text-[#d9e4f5]">{evidence.studentExcerpt}</pre>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#5f6d82]">Matched source</p>
                      <pre className="min-h-28 whitespace-pre-wrap rounded-lg border border-[#f2d3ae] bg-[#fff8ed] p-3 text-xs leading-5 text-[#69451d]">{evidence.matchedExcerpt}</pre>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-[#f6f8fb] p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#77849a]">Why it was flagged</p>
                    <p className="mt-1 text-sm leading-6 text-[#5f6d82]">{evidence.explanation}</p>
                  </div>
                </section>
              ))}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setPlagiarismDetail(null)}>Close evidence</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={assignmentDialog} onOpenChange={setAssignmentDialog}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl"><form onSubmit={generateAssignment}><DialogHeader><div className="mb-1 grid size-10 place-items-center rounded-xl bg-[#efeaff] text-[#7151c8]"><Sparkles className="size-5" /></div><DialogTitle>Generate assignment with AI</DialogTitle><DialogDescription>CampusGrade will create the brief, requirements, test cases, and grading rubric for faculty review.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><label className="grid gap-1.5 text-sm font-semibold">Topic<Input required value={assignmentForm.topic} onChange={(event) => setAssignmentForm({ ...assignmentForm, topic: event.target.value })} placeholder="e.g. secure REST API with Node.js" autoFocus /></label><label className="grid gap-1.5 text-sm font-semibold">Learning outcomes<Textarea value={assignmentForm.outcome} onChange={(event) => setAssignmentForm({ ...assignmentForm, outcome: event.target.value })} placeholder="Students should demonstrate authentication, validation, testing..." /></label><label className="grid gap-1.5 text-sm font-semibold">Difficulty<Select value={assignmentForm.difficulty} onValueChange={(value) => setAssignmentForm({ ...assignmentForm, difficulty: value })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Beginner">Beginner</SelectItem><SelectItem value="Intermediate">Intermediate</SelectItem><SelectItem value="Advanced">Advanced</SelectItem></SelectContent></Select></label><div><div className="grid items-start gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold">Due date<Input required type="date" value={assignmentForm.dueDate} onChange={(event) => setAssignmentForm({ ...assignmentForm, dueDate: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Due time<Input required type="time" value={assignmentForm.dueTime} onChange={(event) => setAssignmentForm({ ...assignmentForm, dueTime: event.target.value })} /></label></div><p className="mt-1.5 text-xs text-[#7b8799]">Due time defaults to 11:59 PM and can be changed.</p></div><section className="rounded-xl border bg-[#f8faff] p-4"><div className="mb-3"><p className="text-sm font-bold text-[#1b2b4b]">AI evaluation settings</p><p className="mt-1 text-xs text-[#718096]">Choose what CampusGrade should run automatically after submission.</p></div><div className="grid gap-3"><label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3"><Checkbox checked={assignmentForm.aiEvaluationEnabled} onCheckedChange={(checked) => setAssignmentForm({ ...assignmentForm, aiEvaluationEnabled: checked === true })} /><span><span className="block text-sm font-semibold">Evaluate assignment with AI</span><span className="mt-0.5 block text-xs text-[#718096]">Generate a preliminary score and feedback for professor review.</span></span></label><label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3"><Checkbox checked={assignmentForm.plagiarismCheckEnabled} onCheckedChange={(checked) => setAssignmentForm({ ...assignmentForm, plagiarismCheckEnabled: checked === true })} /><span><span className="block text-sm font-semibold">Check plagiarism with AI</span><span className="mt-0.5 block text-xs text-[#718096]">Compare submission similarity against the allowed threshold.</span></span></label>{assignmentForm.plagiarismCheckEnabled && <label className="grid gap-1.5 text-sm font-semibold">Allowed plagiarism<Select value={assignmentForm.plagiarismThreshold} onValueChange={(value) => setAssignmentForm({ ...assignmentForm, plagiarismThreshold: value })}><SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger><SelectContent>{[10, 20, 30, 40, 50].map((value) => <SelectItem key={value} value={String(value)}>{value}%</SelectItem>)}</SelectContent></Select></label>}</div></section></div><DialogFooter><Button type="button" variant="outline" onClick={() => setAssignmentDialog(false)}>Cancel</Button><Button type="submit" className="bg-[#6c4bc5] hover:bg-[#593ba9]"><Sparkles />Generate draft</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={Boolean(homeworkDialog)} onOpenChange={(open) => !open && setHomeworkDialog(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><div className="flex flex-wrap items-center gap-2"><DialogTitle>{homeworkDialog?.title}</DialogTitle>{homeworkDialog && <Badge variant="outline" className="font-mono">{homeworkDialog.assignmentCode}</Badge>}{homeworkMode === "view" && <Badge variant="outline" className="border-[#d8dee8] bg-[#f3f5f8] text-[#5f6d82]"><ShieldCheck />Submitted · locked</Badge>}{homeworkMode === "preview" && <Badge className="bg-[#efeaff] text-[#6545bd]"><Sparkles />Professor preview</Badge>}</div><DialogDescription>{homeworkDialog?.course} · {homeworkDialog?.questions.length} questions · {homeworkDialog?.points} points · Due {homeworkDialog?.due}</DialogDescription></DialogHeader>{homeworkDialog && homeworkMode === "preview" && <div className="flex flex-wrap gap-2"><Badge variant="outline" className={homeworkDialog.aiEvaluationEnabled ? "border-[#bce7da] bg-[#eaf9f4] text-[#11765f]" : "border-[#eed3b2] bg-[#fff6e8] text-[#9a5b18]"}>{homeworkDialog.aiEvaluationEnabled ? "AI evaluation on" : "Manual grading"}</Badge><Badge variant="outline" className="border-[#d7def3] bg-[#f6f8ff] text-[#405481]">{homeworkDialog.plagiarismCheckEnabled ? `Plagiarism limit ${homeworkDialog.plagiarismThreshold}%` : "Plagiarism check off"}</Badge></div>}{homeworkMode === "view" && <div className="flex items-start gap-3 rounded-xl border border-[#d9e0eb] bg-[#f6f8fb] p-3 text-sm text-[#5d6b84]"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><p>This submitted attempt is read-only. Answers cannot be edited after submission.</p></div>}<div className="grid gap-4 py-1">{homeworkDialog?.questions.map((question, index) => <section key={question.id} className="rounded-2xl border bg-white p-4 sm:p-5"><div className="mb-4 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#77849a]">Question {index + 1}</p><h3 className="mt-1 text-base font-bold leading-6 text-[#1b2b4b]">{question.prompt}</h3></div><div className="flex shrink-0 flex-col items-end gap-1"><Badge variant="outline">{question.points} pts</Badge><span className="text-[11px] font-semibold text-[#7b8799]">{question.type === "code" ? `${question.language} code` : "Written answer"}</span></div></div>{homeworkMode === "preview" ? <div className={`rounded-xl border border-dashed p-4 text-sm ${question.type === "code" ? "bg-[#111827] font-mono text-[#cbd5e1]" : "bg-[#f8faff] text-[#68758a]"}`}>{question.type === "code" ? "Student code editor will appear here." : "Student written-answer box will appear here."}</div> : <Textarea aria-label={`Answer for question ${index + 1}`} readOnly={homeworkMode === "view"} value={(answers[homeworkDialog.id] ?? homeworkDialog.submittedAnswers ?? {})[question.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [homeworkDialog.id]: { ...(current[homeworkDialog.id] ?? {}), [question.id]: event.target.value } }))} placeholder={question.type === "code" ? `Write ${question.language ?? "your"} code here...` : "Write your answer here..."} className={`${question.type === "code" ? "min-h-48 bg-[#101827] font-mono text-[14px] leading-6 text-[#d9e4f5] placeholder:text-[#7d8ba3]" : "min-h-32"} ${homeworkMode === "view" ? "cursor-default opacity-90" : ""}`} />}</section>)}</div><DialogFooter><Button variant="outline" onClick={() => setHomeworkDialog(null)}>Close</Button>{homeworkMode === "edit" && <><Button variant="secondary" onClick={() => toast.success("Draft answers saved")}>Save draft</Button><Button onClick={submitHomework}><UploadCloud />Submit homework</Button></>}{homeworkMode === "preview" && <Button onClick={publishAssignment}><Check />Publish assignment</Button>}</DialogFooter></DialogContent></Dialog>

    <Dialog open={notificationDialog} onOpenChange={setNotificationDialog}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{meta.label} notifications</DialogTitle>
          <DialogDescription>Assignment, submission, and grading updates for this portal.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {visibleNotifications.length > 0 ? visibleNotifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className={notification.read
                ? "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-[#f8faff]"
                : "flex items-start gap-3 rounded-xl border border-[#cbd7fa] bg-[#f3f6ff] p-4 text-left transition-colors hover:border-[#9eb2ef]"}
              onClick={() => openNotification(notification)}
            >
              <span className={notification.kind === "score"
                ? "mt-1 size-2 shrink-0 rounded-full bg-[#315fe3]"
                : notification.kind === "submission"
                  ? "mt-1 size-2 shrink-0 rounded-full bg-[#1a9a79]"
                  : notification.kind === "assignment"
                    ? "mt-1 size-2 shrink-0 rounded-full bg-[#e58a2d]"
                    : "mt-1 size-2 shrink-0 rounded-full bg-[#8290a6]"} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <strong className="block text-sm text-[#1b2b4b]">{notification.title}</strong>
                  {!notification.read && <Badge className="shrink-0 bg-[#315fe3] text-[10px] text-white">New</Badge>}
                </span>
                <span className="mt-1 block text-sm leading-5 text-[#647187]">{notification.message}</span>
                <span className="mt-2 block text-xs font-bold text-[#667085]">{notification.time}</span>
              </span>
            </button>
          )) : (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <Bell className="mx-auto size-6 text-[#98a3b4]" />
              <p className="mt-3 text-sm font-bold text-[#1b2b4b]">No notifications yet</p>
              <p className="mt-1 text-xs text-[#78849a]">New activity for this portal will appear here.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(feedbackDialog)} onOpenChange={(open) => !open && setFeedbackDialog(null)}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{feedbackDialog?.title}</DialogTitle><DialogDescription>Faculty-approved feedback · Attempt {feedbackDialog?.attempts}</DialogDescription></DialogHeader><div className="grid gap-5 py-2 sm:grid-cols-[120px_1fr]"><div className="rounded-2xl bg-[#10214a] p-4 text-center text-white"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#a9b9df]">Grade</p><p className="mt-2 text-4xl font-extrabold">{feedbackDialog?.grade}<span className="text-lg text-[#a9b9df]">%</span></p></div><div><p className="text-sm font-bold text-[#12213f]">Feedback</p><p className="mt-2 text-sm leading-6 text-[#5d6b84]">{feedbackDialog?.feedback}</p></div></div><div className="rounded-xl border bg-[#f8faff] p-4"><div className="mb-2 flex items-center gap-2 text-sm font-bold"><Bot className="size-4 text-[#7151c8]" />AI evaluation breakdown</div><div className="grid gap-2 text-sm text-[#5d6b84] sm:grid-cols-2"><span>Functionality · 36/40</span><span>Code quality · 24/30</span><span>Documentation · 15/15</span><span>Testing · 13/15</span></div></div><DialogFooter><Button variant="outline" onClick={() => setFeedbackDialog(null)}>Close</Button><Button onClick={() => { if (feedbackDialog) { openHomework(feedbackDialog, "edit"); setFeedbackDialog(null); } }}><RefreshCw />Improve & resubmit</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={feedbackHistoryDialog} onOpenChange={setFeedbackHistoryDialog}><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>All previous feedback</DialogTitle><DialogDescription>Your graded assignments and faculty comments, newest first.</DialogDescription></DialogHeader><div className="grid gap-3">{assignments.filter((assignment) => assignment.feedback).map((assignment) => <button key={assignment.id} className="rounded-xl border p-4 text-left transition-colors hover:border-[#bfcdf4] hover:bg-[#f9fbff]" onClick={() => { setFeedbackHistoryDialog(false); openFeedback(assignment); }}><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#1b2b4b]">{assignment.title}</h3>{assignment.hasUnreadFeedback && <Badge className="bg-[#e9efff] text-[#2457e6]">New feedback</Badge>}</div><p className="mt-1 text-xs font-semibold text-[#78849a]">{assignment.course} · Attempt {assignment.attempts}</p></div><span className="text-2xl font-extrabold text-[#16866a]">{assignment.grade}%</span></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-[#647187]">{assignment.feedback}</p></button>)}</div></DialogContent></Dialog>
  </div>;
}

function AdminPortal({ section, people, search, setSearch, openPerson, removePerson }: { section: string; people: Person[]; search: string; setSearch: (value: string) => void; openPerson: (person?: Person) => void; removePerson: (person: Person) => void }) {
  const [directoryTab, setDirectoryTab] = useState<"students" | "professors">("students");
  const directoryPeople = people.filter((person) => person.role === (directoryTab === "students" ? "Student" : "Professor") && `${person.name} ${person.email} ${person.campusId}`.toLowerCase().includes(search.toLowerCase()));
  const directoryTotal = people.filter((person) => person.role === (directoryTab === "students" ? "Student" : "Professor")).length;
  if (section === "Courses") return <div className="space-y-7"><SectionHeading eyebrow="Academic catalog" title="Courses" action={<Button><Plus />Add course</Button>} /><div className="grid gap-4 lg:grid-cols-3">{["CS 412 · Web Engineering", "CS 308 · Algorithms", "DS 220 · Data Analytics"].map((course, index) => <section key={course} className="rounded-2xl border bg-white p-5"><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#e9efff] text-[#2457e6]"><BookOpen className="size-5" /></span><StatusBadge status="Active" /></div><h2 className="mt-5 text-lg font-extrabold">{course}</h2><p className="mt-2 text-sm text-[#69758a]">{[32, 28, 41][index]} students · {[5, 4, 6][index]} assignments</p><Button variant="outline" className="mt-5 w-full">Manage course <ChevronRight /></Button></section>)}</div></div>;
  if (section === "System activity") return <div className="space-y-7"><SectionHeading eyebrow="Audit log" title="System activity" /><section className="rounded-2xl border bg-white p-5 sm:p-6"><div className="grid gap-3">{[["AI evaluation completed", "Maya Chen · REST API with Authentication", "2 min ago"], ["Faculty account updated", "Dr. Aisha Patel · Computer Science", "18 min ago"], ["Course roster imported", "CS 308 · 28 students", "1 hr ago"], ["Assignment published", "Graph Traversal Visualizer", "Yesterday"]].map(([title, detail, time]) => <div key={`${title}-${time}`} className="flex items-start gap-3 rounded-xl border p-4"><span className="mt-1 size-2 rounded-full bg-[#315fe3]" /><div className="flex-1"><p className="font-bold">{title}</p><p className="mt-1 text-sm text-[#69758a]">{detail}</p></div><span className="text-xs font-semibold text-[#8a96a8]">{time}</span></div>)}</div></section></div>;
  return <div className="space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold text-[#315fe3]">Wednesday, September 30</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-[#10214a] sm:text-4xl">{section === "People" ? "Students & faculty" : "Campus operations at a glance"}</h1><p className="mt-2 text-base text-[#69758a]">Manage academic users, course access, and platform activity.</p></div><Button onClick={() => openPerson()}><UserRoundPlus />Add campus user</Button></div>
    {section === "Overview" && <div className="grid max-w-4xl gap-3 sm:grid-cols-3"><CompactStatCard icon={Users} label="Active users" value="1,284" /><CompactStatCard icon={GraduationCap} label="Faculty" value="86" tone="green" /><CompactStatCard icon={BookOpen} label="Active courses" value="64" tone="purple" /></div>}
    <AdminDirectory directoryTab={directoryTab} setDirectoryTab={setDirectoryTab} people={directoryPeople} total={directoryTotal} search={search} setSearch={setSearch} openPerson={openPerson} removePerson={removePerson} />
  </div>;
}

function AdminDirectory({ directoryTab, setDirectoryTab, people, total, search, setSearch, openPerson, removePerson }: { directoryTab: "students" | "professors"; setDirectoryTab: (value: "students" | "professors") => void; people: Person[]; total: number; search: string; setSearch: (value: string) => void; openPerson: (person?: Person) => void; removePerson: (person: Person) => void }) {
  const isProfessorTab = directoryTab === "professors";
  return <section className="rounded-2xl border bg-white p-5 shadow-[0_6px_24px_rgba(20,33,61,0.04)] sm:p-6"><SectionHeading eyebrow="Directory" title="Campus users" /><div className="mt-5 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between"><Tabs value={directoryTab} onValueChange={(value) => { setDirectoryTab(value as "students" | "professors"); setSearch(""); }}><TabsList><TabsTrigger value="students">Students</TabsTrigger><TabsTrigger value="professors">Professors</TabsTrigger></TabsList></Tabs><div className="relative w-full sm:w-[300px]"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a96a8]" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${directoryTab} by name, ID or email`} /></div></div><div className="mt-4 overflow-hidden rounded-xl border"><Table><TableHeader className="bg-[#f7f9fc]"><TableRow><TableHead className="pl-4">Name</TableHead><TableHead>{isProfessorTab ? "Professor ID" : "Student ID"}</TableHead><TableHead>Department</TableHead>{isProfessorTab && <TableHead>Courses</TableHead>}<TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{people.map((person) => <TableRow key={person.id}><TableCell className="pl-4"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-full bg-[#e9efff] text-xs font-extrabold text-[#2457e6]">{person.name.split(" ").map((name) => name[0]).join("")}</div><div><p className="font-bold text-[#1b2b4b]">{person.name}</p><p className="text-xs text-[#7b8799]">{person.email}</p></div></div></TableCell><TableCell><Badge variant="outline" className="font-mono">{person.campusId}</Badge></TableCell><TableCell className="text-[#5e6b80]">{person.department}</TableCell>{isProfessorTab && <TableCell><div className="flex max-w-sm flex-wrap gap-1">{person.courses?.map((course) => <Badge key={course} variant="outline" className="border-[#d7def3] bg-[#f6f8ff] text-[#405481]">{course}</Badge>)}{!person.courses?.length && <span className="text-xs text-[#8a96a8]">No courses assigned</span>}</div></TableCell>}<TableCell><StatusBadge status={person.status} /></TableCell><TableCell><div className="flex justify-end gap-1"><Button size="icon-sm" variant="ghost" aria-label={`Edit ${person.name}`} onClick={() => openPerson(person)}><Pencil /></Button><Button size="icon-sm" variant="ghost" className="text-[#c33c35] hover:bg-[#fff0ef] hover:text-[#b42318]" aria-label={`Remove ${person.name}`} onClick={() => removePerson(person)}><Trash2 /></Button></div></TableCell></TableRow>)}</TableBody></Table>{people.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No {directoryTab} match your search.</p>}</div><div className="mt-4 flex items-center justify-between text-xs font-medium text-[#7d899b]"><span>Showing {people.length} of {total} {directoryTab}</span><Button size="sm" variant="ghost">View full directory <ChevronRight /></Button></div></section>;
}

function getStudentGradeSummary(student: Person, assignments: Assignment[]) {
  const results = assignments.map((assignment) => ({
    assignment,
    evaluation: evaluationsFor(assignment).find((evaluation) => evaluation.student === student.name) ?? null,
  }));
  const submitted = results.filter((result) => result.evaluation);
  const average = submitted.length
    ? Math.round(submitted.reduce((total, result) => total + (result.evaluation?.score ?? 0), 0) / submitted.length)
    : null;
  return { results, submittedCount: submitted.length, average };
}

function StudentRosterTable({ students, assignments, onSelect, onRemove, showCourse = false, className = "" }: { students: Person[]; assignments: Assignment[]; onSelect: (student: Person) => void; onRemove: (student: Person) => void; showCourse?: boolean; className?: string }) {
  return <div className={`overflow-hidden rounded-xl border ${className}`}><Table><TableHeader className="bg-[#f7f9fc]"><TableRow><TableHead className="pl-4">Student</TableHead>{showCourse && <TableHead>Course</TableHead>}<TableHead>Submitted</TableHead><TableHead>Average</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{students.map((student) => {
    const summary = getStudentGradeSummary(student, assignments);
    return <TableRow key={student.id} role="button" tabIndex={0} aria-label={`View academic details for ${student.name}`} className="cursor-pointer transition-colors hover:bg-[#f7f9ff] focus-visible:bg-[#f7f9ff] focus-visible:outline-none" onClick={() => onSelect(student)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(student); } }}><TableCell className="pl-4"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-full bg-[#e9efff] text-xs font-extrabold text-[#2457e6]">{student.name.split(" ").map((name) => name[0]).join("")}</div><div><p className="font-bold">{student.name}</p><p className="text-xs text-[#7b8799]">{student.campusId} · {student.email}</p></div></div></TableCell>{showCourse && <TableCell className="text-[#68758a]">{student.course ?? "CS 412 · Web Engineering"}</TableCell>}<TableCell className="font-semibold text-[#5e6b80]">{summary.submittedCount} of {assignments.length}</TableCell><TableCell className="font-bold">{summary.average === null ? "—" : `${summary.average}%`}</TableCell><TableCell><div className="flex justify-end"><Button size="icon-sm" variant="ghost" className="text-[#c33c35] hover:bg-[#fff0ef] hover:text-[#b42318]" onClick={(event) => { event.stopPropagation(); onRemove(student); }} aria-label={`Remove ${student.name} from class`}><Trash2 /></Button></div></TableCell></TableRow>;
  })}</TableBody></Table></div>;
}

function StudentDetailsDialog({ student, assignments, onClose }: { student: Person | null; assignments: Assignment[]; onClose: () => void }) {
  const summary = student ? getStudentGradeSummary(student, assignments) : null;
  return <Dialog open={Boolean(student)} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{student?.name}</DialogTitle><DialogDescription>{student?.campusId} · {student?.email}</DialogDescription></DialogHeader>{student && summary && <div className="grid gap-4"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-[#f8faff] p-4 sm:col-span-1"><p className="text-xs font-bold uppercase tracking-[0.08em] text-[#78849a]">Department</p><p className="mt-1 font-extrabold text-[#1b2b4b]">{student.department}</p></div><div className="rounded-xl border bg-[#f8faff] p-4"><p className="text-xs font-bold uppercase tracking-[0.08em] text-[#78849a]">Assignments submitted</p><p className="mt-1 text-2xl font-extrabold text-[#1b2b4b]">{summary.submittedCount}<span className="text-sm text-[#78849a]">/{assignments.length}</span></p></div><div className="rounded-xl border bg-[#f8faff] p-4"><p className="text-xs font-bold uppercase tracking-[0.08em] text-[#78849a]">Overall average</p><p className="mt-1 text-2xl font-extrabold text-[#16866a]">{summary.average === null ? "—" : `${summary.average}%`}</p></div></div><section><h3 className="mb-3 font-extrabold text-[#1b2b4b]">Assignment grades</h3><div className="overflow-hidden rounded-xl border"><Table><TableHeader className="bg-[#f7f9fc]"><TableRow><TableHead className="pl-4">Assignment</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Grade</TableHead></TableRow></TableHeader><TableBody>{summary.results.map(({ assignment, evaluation }) => <TableRow key={assignment.id}><TableCell className="pl-4"><p className="font-bold text-[#1b2b4b]">{assignment.title}</p><p className="mt-0.5 text-xs text-[#78849a]">{assignment.assignmentCode}</p></TableCell><TableCell>{evaluation ? <Badge variant="outline" className={evaluation.status === "Score released" ? "border-[#bce7da] bg-[#eaf9f4] text-[#11765f]" : "border-[#cbd7fa] bg-[#f3f6ff] text-[#3155b7]"}>{evaluation.status}</Badge> : <span className="text-sm text-[#8a96a8]">Not submitted</span>}</TableCell><TableCell className="text-right text-lg font-extrabold">{evaluation ? `${evaluation.score}%` : "—"}</TableCell></TableRow>)}</TableBody></Table></div></section></div>}</DialogContent></Dialog>;
}

function ProfessorPortal({ section, people, assignments, openPerson, removePerson, openGenerator, preview, openAssignment, releaseAllScores }: { section: string; people: Person[]; assignments: Assignment[]; openPerson: (person?: Person) => void; removePerson: (person: Person) => void; openGenerator: () => void; preview: (assignment: Assignment) => void; openAssignment: (assignment: Assignment) => void; releaseAllScores: (assignment?: Assignment) => void }) {
  const students = people.filter((person) => person.role === "Student" && person.course === "CS 412 · Web Engineering");
  const [selectedStudent, setSelectedStudent] = useState<Person | null>(null);
  if (section === "Assignments") return <div className="space-y-7"><div className="flex flex-wrap items-end justify-between gap-3"><SectionHeading eyebrow="Coursework" title="Assignments & AI evaluations" /><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => releaseAllScores()}><CheckCircle2 />Submit all scores</Button><Button onClick={openGenerator} className="bg-[#6c4bc5] hover:bg-[#593ba9]"><Sparkles />Generate assignment</Button></div></div><div className="grid gap-4">{assignments.map((assignment) => { const submitted = evaluationsFor(assignment).length; return <article key={assignment.id} className="flex flex-col justify-between gap-4 rounded-2xl border bg-white p-5 shadow-[0_6px_24px_rgba(20,33,61,0.04)] sm:flex-row sm:items-center"><button className="flex min-w-0 flex-1 items-center gap-4 text-left" onClick={() => openAssignment(assignment)}><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e9efff] text-[#2457e6]"><FileCode2 className="size-5" /></span><span><span className="flex flex-wrap items-center gap-2"><strong className="font-extrabold text-[#1b2b4b]">{assignment.title}</strong><Badge variant="outline" className="font-mono">{assignment.assignmentCode}</Badge></span><span className="mt-1 block text-xs font-semibold text-[#78849a]">{assignment.questions.length} questions · Due {assignment.due} · {submitted} of 32 submitted</span><span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${assignment.aiEvaluationEnabled ? "bg-[#eaf9f4] text-[#11765f]" : "bg-[#fff6e8] text-[#9a5b18]"}`}>{assignment.aiEvaluationEnabled ? `${submitted} automatically evaluated` : "Manual grading"}</span>{assignment.plagiarismCheckEnabled && <span className="ml-2 mt-2 inline-flex rounded-full bg-[#f3f6ff] px-2 py-1 text-[11px] font-bold text-[#405481]">Plagiarism limit {assignment.plagiarismThreshold}%</span>}</span></button><div className="flex gap-2"><Button variant="outline" onClick={() => preview(assignment)}>Preview</Button><Button onClick={() => openAssignment(assignment)}>View submissions <ChevronRight /></Button></div></article>; })}</div></div>;
  if (section === "Class roster") return <><div className="space-y-7"><SectionHeading eyebrow="Class management" title="CS 412 roster" action={<Button onClick={() => openPerson()}><UserRoundPlus />Add student</Button>} /><StudentRosterTable students={students} assignments={assignments} onSelect={setSelectedStudent} onRemove={removePerson} showCourse /></div><StudentDetailsDialog student={selectedStudent} assignments={assignments} onClose={() => setSelectedStudent(null)} /></>;
  if (section === "Analytics") return <div className="space-y-7"><SectionHeading eyebrow="Class performance" title="Analytics" /><div className="grid gap-4 sm:grid-cols-3"><StatCard icon={TrendingUp} label="Class average" value="87.4%" note="+3.2% this month" tone="green" /><StatCard icon={ClipboardCheck} label="Submission rate" value="91%" note="Across 5 assignments" /><StatCard icon={ShieldCheck} label="Average similarity" value="8.3%" note="Below review threshold" tone="purple" /></div><section className="rounded-2xl border bg-white p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#efeaff] text-[#7151c8]"><Bot className="size-5" /></span><div><h2 className="font-extrabold">AI learning insight</h2><p className="text-xs text-[#78849a]">Based on 23 recent submissions</p></div></div><p className="mt-5 max-w-3xl text-sm leading-6 text-[#5f6d82]">Students perform well on implementation but lose the most points on asynchronous error handling. A short targeted exercise before the next API assignment is recommended.</p></section></div>;
  return <div className="space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold text-[#315fe3]">CS 412 · Web Engineering</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-[#10214a] sm:text-4xl">Good morning, Dr. Patel</h1><p className="mt-2 text-base text-[#69758a]">Your class has 8 submissions ready for final review.</p></div><Button onClick={openGenerator} className="bg-[#6c4bc5] hover:bg-[#593ba9]"><Sparkles />Generate assignment</Button></div>
    <div className="grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4"><CompactStatCard icon={Users} label="Class enrollment" value="32" /><CompactStatCard icon={ClipboardCheck} label="Pending review" value="8" tone="orange" /><CompactStatCard icon={BookOpen} label="Live assignments" value="5" tone="purple" /><CompactStatCard icon={TrendingUp} label="Class average" value="87.4%" tone="green" /></div>
    <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
      <section className="rounded-2xl border bg-white p-5 shadow-[0_6px_24px_rgba(20,33,61,0.04)] sm:p-6"><SectionHeading eyebrow="Coursework" title="Assignment pipeline" action={<Button size="sm" variant="outline" onClick={openGenerator}><Plus />Create assignment</Button>} /><div className="mt-5 space-y-3">{assignments.slice(0, 4).map((assignment, index) => <button key={assignment.id} onClick={() => openAssignment(assignment)} className="flex w-full flex-wrap items-center justify-between gap-4 rounded-xl border p-4 text-left transition-colors hover:border-[#bfcdf4] hover:bg-[#f9fbff]"><span className="flex min-w-0 items-center gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${index === 2 ? "bg-[#fff2e2] text-[#c36a13]" : "bg-[#e9efff] text-[#2457e6]"}`}><FileCode2 className="size-5" /></span><span><span className="block font-bold text-[#1b2b4b]">{assignment.title}</span><span className="mt-1 block text-xs font-medium text-[#7c8798]">{evaluationsFor(assignment).length} of 32 submitted · automatically evaluated</span></span></span><span className="flex items-center gap-2"><StatusBadge status={index === 2 ? "Needs review" : index === 3 ? "Draft" : "Published"} /><ChevronRight className="size-4 text-[#7b8799]" /></span></button>)}</div></section>
      <section className="relative overflow-hidden rounded-2xl bg-[#10214a] p-6 text-white shadow-[0_10px_30px_rgba(16,33,74,0.18)]"><div className="metric-grid absolute inset-0 opacity-[0.06]" /><div className="relative"><div className="flex items-center justify-between"><div className="grid size-11 place-items-center rounded-xl bg-white/10"><Bot className="size-6 text-[#9fb5ff]" /></div><Badge className="bg-[#224581] text-[#bcd0ff]">AI insight</Badge></div><h3 className="mt-6 text-xl font-extrabold">Students need more help with API error handling.</h3><p className="mt-3 text-sm leading-6 text-[#b9c5e2]">Across the last 3 assignments, validation and error-state rubric scores average 14% below other categories.</p><div className="mt-6 border-t border-white/10 pt-5"><div className="mb-2 flex justify-between text-xs font-bold"><span>Observed in 23 submissions</span><span>72%</span></div><div className="h-2 rounded-full bg-white/10"><div className="h-2 w-[72%] rounded-full bg-[#80a1ff]" /></div></div><Button variant="secondary" className="mt-6 w-full bg-white text-[#14213d] hover:bg-[#eaf0ff]">View learning insights</Button></div></section>
    </div>
    <section className="rounded-2xl border bg-white p-5 shadow-[0_6px_24px_rgba(20,33,61,0.04)] sm:p-6"><SectionHeading eyebrow="Class management" title="CS 412 roster" action={<Button size="sm" onClick={() => openPerson()}><UserRoundPlus />Add student</Button>} /><StudentRosterTable className="mt-5" students={students} assignments={assignments} onSelect={setSelectedStudent} onRemove={removePerson} /></section>
    <StudentDetailsDialog student={selectedStudent} assignments={assignments} onClose={() => setSelectedStudent(null)} />
  </div>;
}

function StudentPortal({ section, assignments, openHomework, feedback, viewAllFeedback }: { section: string; assignments: Assignment[]; openHomework: (assignment: Assignment, mode: HomeworkMode) => void; feedback: (assignment: Assignment) => void; viewAllFeedback: () => void }) {
  const newItems = assignments.filter((assignment) => assignment.status === "new");
  const submittedItems = assignments.filter((assignment) => assignment.status === "submitted");
  const completedItems = assignments.filter((assignment) => assignment.status === "completed");
  return <div className="space-y-7">
    {section === "Overview" && <div><p className="text-sm font-bold text-[#315fe3]">Wednesday, September 30</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-[#10214a] sm:text-4xl">Welcome back, Maya</h1></div>}
    {(["Overview", "Progress"].includes(section)) && <div>
      <section className="rounded-2xl border bg-white p-6 shadow-[0_6px_24px_rgba(20,33,61,0.04)]"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#768298]">Course progress</p><p className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">76%</p></div><div className="grid size-12 place-items-center rounded-2xl bg-[#e8f7f1] text-[#16866a]"><TrendingUp className="size-6" /></div></div><Progress value={76} className="mt-5 h-2.5 bg-[#e9edf3] [&_[data-slot=progress-indicator]]:bg-[#1ca27f]" /><div className="mt-5 grid grid-cols-3 gap-3 text-center"><div><p className="text-lg font-extrabold">9</p><p className="text-[11px] font-semibold text-[#7c8798]">Completed</p></div><div className="border-x"><p className="text-lg font-extrabold">88%</p><p className="text-[11px] font-semibold text-[#7c8798]">Average</p></div><div><p className="text-lg font-extrabold">2</p><p className="text-[11px] font-semibold text-[#7c8798]">Remaining</p></div></div></section>
    </div>}
    {(["Overview", "My homework", "Submissions"].includes(section)) && <section className="rounded-2xl border bg-white p-5 shadow-[0_6px_24px_rgba(20,33,61,0.04)] sm:p-6"><SectionHeading eyebrow="Coursework" title={section === "Submissions" ? "My submissions" : "My homework"} /><Tabs defaultValue={section === "Submissions" ? "submitted" : "new"} className="mt-5"><TabsList variant="line" className="w-full justify-start border-b pb-0"><TabsTrigger value="new" className="flex-none px-4">New <span className="ml-1 rounded-full bg-[#e7edff] px-1.5 py-0.5 text-[10px] font-bold text-[#2457e6]">{newItems.length}</span></TabsTrigger><TabsTrigger value="submitted" className="flex-none px-4">Submitted <span className="ml-1 rounded-full bg-[#f0f2f5] px-1.5 py-0.5 text-[10px] font-bold">{submittedItems.length}</span></TabsTrigger><TabsTrigger value="completed" className="flex-none px-4">Completed <span className="ml-1 rounded-full bg-[#f0f2f5] px-1.5 py-0.5 text-[10px] font-bold">{completedItems.length}</span></TabsTrigger></TabsList><TabsContent value="new" className="pt-5"><AssignmentList items={newItems} actionLabel="Open homework" actionIcon={BookOpen} onAction={(assignment) => openHomework(assignment, "edit")} /></TabsContent><TabsContent value="submitted" className="pt-5"><AssignmentList items={submittedItems} actionLabel="View answers" actionIcon={ShieldCheck} onAction={(assignment) => openHomework(assignment, "view")} /></TabsContent><TabsContent value="completed" className="pt-5"><AssignmentList items={completedItems} actionLabel="View feedback" actionIcon={ClipboardCheck} onAction={feedback} completed /></TabsContent></Tabs></section>}
    {(["Overview", "Progress"].includes(section)) && <section className="rounded-2xl border bg-white p-5 sm:p-6"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#efeaff] text-[#7151c8]"><Bot className="size-5" /></div><div><h3 className="font-extrabold">Latest feedback insight</h3><p className="text-xs font-medium text-[#7b8799]">Based on 5 graded assignments</p></div></div><p className="mt-5 text-sm leading-6 text-[#5f6d82]">Your documentation and test coverage are consistently strong. Focus next on handling asynchronous error states and keeping controller functions small.</p><Button variant="ghost" className="mt-3 px-0 text-[#2457e6] hover:bg-transparent" onClick={viewAllFeedback}>View all feedback <ChevronRight /></Button></section>}
  </div>;
}

function AssignmentList({ items, actionLabel, actionIcon: Icon, onAction, completed = false }: { items: Assignment[]; actionLabel: string; actionIcon: React.ComponentType<{ className?: string }>; onAction: (assignment: Assignment) => void; completed?: boolean }) {
  return <div className="grid gap-3">{items.map((assignment) => {
    const deadline = getDeadlineInfo(assignment);
    return <article key={assignment.id} className="flex flex-col justify-between gap-4 rounded-xl border p-4 transition-all hover:border-[#bfcdf4] hover:shadow-[0_5px_18px_rgba(27,56,126,0.06)] sm:flex-row sm:items-center"><div className="flex min-w-0 items-center gap-3"><div className={`grid size-11 shrink-0 place-items-center rounded-xl ${completed ? "bg-[#e8f7f1] text-[#16866a]" : assignment.status === "submitted" ? "bg-[#fff2e2] text-[#c36a13]" : "bg-[#e9efff] text-[#2457e6]"}`}>{completed ? <Check /> : assignment.status === "submitted" ? <Clock3 /> : <FileCode2 />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#1b2b4b]">{assignment.title}</h3><Badge variant="outline" className="font-mono text-[10px]">{assignment.assignmentCode}</Badge>{completed && <Badge variant="outline" className="border-[#c1e4d8] bg-[#ecf9f5] text-[#14745f]">{assignment.grade}%</Badge>}{assignment.hasUnreadFeedback && <Badge className="bg-[#315fe3] text-white"><Bell />New feedback</Badge>}</div><p className="mt-1 text-xs font-medium text-[#7c8798]">{assignment.course}</p><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-[#5f6d82]">Deadline: {assignment.due} · {assignment.points} points</span><Badge variant="outline" className={deadline.className}>{deadline.label}</Badge></div></div></div><Button variant={completed ? "outline" : "default"} className="sm:min-w-[138px]" onClick={() => onAction(assignment)}><Icon />{actionLabel}</Button></article>;
  })}{items.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center"><CircleUserRound className="mx-auto size-8 text-[#9aa5b5]" /><p className="mt-3 text-sm font-semibold text-[#69758a]">Nothing here yet.</p></div>}</div>;
}
