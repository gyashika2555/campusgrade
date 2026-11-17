"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowDown, ArrowUp, BarChart3, Bell, BookOpen, CalendarClock, CheckCircle2, ClipboardCheck, GraduationCap, LayoutDashboard,
  Lightbulb, RotateCcw, Send, Undo2,
  LoaderCircle, LogOut, Menu, Plus, RefreshCw, Search, Sparkles,
  Trash2, UploadCloud, UserRoundPlus, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import {
  campusGradeApi,
  type ApiAdminAnalytics,
  type ApiAssignment,
  type ApiCourse,
  type ApiNotification,
  type ApiSession,
  type ApiSubmission,
  type ApiUser,
} from "@/lib/campusgrade-api";

type Role = "admin" | "professor" | "student";
type GeneratedAssignment = {
  title: string;
  description: string;
  learningOutcomes?: string[];
  questions: Array<{ prompt: string; type: "text" | "code"; language?: string; points: number }>;
  rubric?: Array<{ criterion: string; description?: string; maxPoints: number }>;
};
type EditableQuestion = { id: string; prompt: string; type: "text" | "code"; language?: string; points: number };
type AssignmentDraft = Omit<GeneratedAssignment, "questions"> & { questions: EditableQuestion[] };

const navByRole: Record<Role, string[]> = {
  admin: ["Overview", "People", "Courses", "Analytics"],
  professor: ["Overview", "Assignments", "Class roster"],
  student: ["Overview", "My homework", "Submissions"],
};

const iconBySection = { Overview: LayoutDashboard, People: Users, Courses: BookOpen, Analytics: BarChart3, Assignments: ClipboardCheck, "Class roster": Users, "My homework": BookOpen, Submissions: UploadCloud };
const idOf = (record: { _id?: string; id?: string }) => record._id ?? record.id ?? "";
const assignmentIdOf = (assignment: ApiSubmission["assignment"]) => typeof assignment === "string" ? assignment : assignment._id;
const assignmentCourseId = (assignment: ApiAssignment) => typeof assignment.course === "string" ? assignment.course : assignment.course._id;
const courseName = (course: ApiAssignment["course"]) => `${course.code} · ${course.title}`;
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

const previewProfessor: ApiUser = { _id: "preview-professor", campusId: "P10421", name: "Dr. Maya Chen", email: "maya.chen@campusgrade.edu", role: "professor", department: "Computer Science", active: true };
const previewProfessorTwo: ApiUser = { _id: "preview-professor-2", campusId: "P10422", name: "Prof. Daniel Kim", email: "daniel.kim@campusgrade.edu", role: "professor", department: "Information Systems", active: true };
const previewStudent: ApiUser = { _id: "preview-student", campusId: "S20845", name: "Jordan Lee", email: "jordan.lee@campusgrade.edu", role: "student", department: "Computer Science", active: true };
const previewUsers: ApiUser[] = [
  previewProfessor,
  previewProfessorTwo,
  previewStudent,
  { _id: "preview-student-2", campusId: "S20846", name: "Priya Shah", email: "priya.shah@campusgrade.edu", role: "student", department: "Information Systems", active: true },
  { _id: "preview-student-3", campusId: "S20847", name: "Alex Rivera", email: "alex.rivera@campusgrade.edu", role: "student", department: "Computer Science", active: true },
];
const previewCourses: ApiCourse[] = [
  { _id: "preview-course", code: "CS412", title: "Software Quality Engineering", term: "Fall 2026", professor: previewProfessor, students: previewUsers.filter((user) => user.role === "student"), createdAt: "2026-09-01T12:00:00.000Z" },
  { _id: "preview-course-2", code: "IS330", title: "Database Systems", term: "Fall 2026", professor: previewProfessorTwo, students: previewUsers.filter((user) => ["preview-student", "preview-student-2"].includes(idOf(user))), createdAt: "2026-09-01T12:00:00.000Z" },
];
const previewAssignments: ApiAssignment[] = [{
  _id: "preview-assignment",
  assignmentCode: "A48217",
  course: previewCourses[0],
  title: "API Test Strategy and Automation",
  description: "Design a practical API testing strategy and implement a focused automated test suite.",
  learningOutcomes: ["Create a maintainable API test strategy", "Validate positive and negative API behavior"],
  difficulty: "intermediate",
  rubric: [
    { criterion: "Test strategy", description: "Coverage, risks, and approach", maxPoints: 30 },
    { criterion: "Automation", description: "Correct and maintainable tests", maxPoints: 50 },
    { criterion: "Analysis", description: "Clear results and recommendations", maxPoints: 20 },
  ],
  questions: [
    { _id: "preview-question-1", prompt: "Explain the key risks and coverage priorities for the API.", type: "text", points: 30 },
    { _id: "preview-question-2", prompt: "Implement automated tests for success, validation, and authorization scenarios.", type: "code", language: "JavaScript", points: 50 },
    { _id: "preview-question-3", prompt: "Summarize the results and recommend the next testing improvements.", type: "text", points: 20 },
  ],
  totalPoints: 100,
  dueAt: "2026-12-10T23:59:00.000Z",
  status: "published",
  aiGenerated: true,
  aiEvaluationEnabled: true,
  plagiarismCheckEnabled: true,
  plagiarismThreshold: 30,
}];
const previewSubmissions: ApiSubmission[] = [{
  _id: "preview-submission",
  assignment: previewAssignments[0],
  student: previewStudent,
  answers: [
    { question: "preview-question-1", type: "text", answer: "The highest risks are authentication, authorization, validation, rate limits, and inconsistent error contracts. I would prioritize business-critical endpoints and negative paths." },
    { question: "preview-question-2", type: "code", answer: "describe('POST /users', () => {\n  it('creates a valid user', async () => { /* assertions */ });\n  it('rejects missing email', async () => { /* assertions */ });\n  it('rejects an unauthorized request', async () => { /* assertions */ });\n});" },
    { question: "preview-question-3", type: "text", answer: "The core flows passed. Next I would add contract tests, data-driven boundary cases, and performance checks for the busiest endpoints." },
  ],
  attemptNumber: 1,
  status: "graded",
  aiEvaluation: {
    suggestedGrade: 82,
    summary: "Strong risk coverage and a clear automation approach. Add more precise assertions and boundary cases.",
    scores: [
      { questionId: "preview-question-1", criterion: "Risk analysis", score: 25, maxPoints: 30, note: "Good prioritization; add data integrity risks." },
      { questionId: "preview-question-2", criterion: "Automation", score: 40, maxPoints: 50, note: "Useful scenario coverage; assertions need more detail." },
      { questionId: "preview-question-3", criterion: "Recommendations", score: 17, maxPoints: 20, note: "Clear next steps with room for stronger prioritization." },
    ],
    plagiarismLevel: 8,
    plagiarismEvidence: [],
  },
  finalGrade: 82,
  facultyFeedback: "Good work. Strengthen boundary-value assertions and include contract validation in the next attempt.",
  scoreReleasedAt: "2026-11-15T18:00:00.000Z",
  submittedAt: "2026-11-14T20:30:00.000Z",
}];
const previewAnalytics: ApiAdminAnalytics = {
  summary: { professors: 2, students: 3, subjects: 2, assignments: 9, submissions: 24, averageScore: 82.4, submissionRate: 88.9 },
  professors: [
    { id: "preview-professor", campusId: "P10421", name: "Dr. Maya Chen", department: "Computer Science", courses: 1, assignmentsCreated: 5, studentsTaught: 3, submissionsReceived: 14, averageScore: 86, submissionRate: 93.3, subjectAverages: [{ courseId: "preview-course", code: "CS412", title: "Software Quality Engineering", averageScore: 86, submissionRate: 93.3 }], improvement: "Student outcomes are strong. Add one advanced code-review challenge and continue the current feedback approach." },
    { id: "preview-professor-2", campusId: "P10422", name: "Prof. Daniel Kim", department: "Information Systems", courses: 1, assignmentsCreated: 4, studentsTaught: 2, submissionsReceived: 10, averageScore: 78, submissionRate: 83.3, subjectAverages: [{ courseId: "preview-course-2", code: "IS330", title: "Database Systems", averageScore: 78, submissionRate: 83.3 }], improvement: "Add targeted practice on database normalization and provide question-level feedback before the next assignment." },
  ],
  students: [
    { id: "preview-student", campusId: "S20845", name: "Jordan Lee", department: "Computer Science", subjects: 2, assignmentsAvailable: 9, assignmentsSubmitted: 9, pendingAssignments: 0, averageScore: 88, submissionRate: 100, strongestSubject: "Software Quality Engineering", needsFocus: "Database Systems" },
    { id: "preview-student-2", campusId: "S20846", name: "Priya Shah", department: "Information Systems", subjects: 2, assignmentsAvailable: 9, assignmentsSubmitted: 8, pendingAssignments: 1, averageScore: 81, submissionRate: 88.9, strongestSubject: "Database Systems", needsFocus: "Software Quality Engineering" },
    { id: "preview-student-3", campusId: "S20847", name: "Alex Rivera", department: "Computer Science", subjects: 1, assignmentsAvailable: 5, assignmentsSubmitted: 4, pendingAssignments: 1, averageScore: 74, submissionRate: 80, strongestSubject: "Software Quality Engineering", needsFocus: "Software Quality Engineering" },
  ],
  subjects: [
    { id: "preview-course", code: "CS412", title: "Software Quality Engineering", term: "Fall 2026", professor: "Dr. Maya Chen", enrolledStudents: 3, assignments: 5, submissions: 14, averageScore: 86, submissionRate: 93.3 },
    { id: "preview-course-2", code: "IS330", title: "Database Systems", term: "Fall 2026", professor: "Prof. Daniel Kim", enrolledStudents: 2, assignments: 4, submissions: 10, averageScore: 78, submissionRate: 83.3 },
  ],
};

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-2xl border border-dashed bg-white p-10 text-center"><BookOpen className="mx-auto size-7 text-[#98a3b4]" /><p className="mt-3 font-bold text-[#1b2b4b]">{title}</p><p className="mt-1 text-sm text-[#718096]">{detail}</p></div>;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return <div className="rounded-2xl border bg-white p-5 shadow-[0_6px_24px_rgba(20,33,61,0.04)]"><span className="grid size-10 place-items-center rounded-xl bg-[#e9efff] text-[#2457e6]"><Icon className="size-5" /></span><p className="mt-5 text-sm font-semibold text-[#69758a]">{label}</p><p className="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-[#12213f]">{value}</p></div>;
}

export function CampusGradeApp({ session, onLogout, previewMode = false, onPreviewRoleChange }: { session: ApiSession; onLogout: () => void; previewMode?: boolean; onPreviewRoleChange?: (role: Role) => void }) {
  const role = session.user.role;
  const token = session.token;
  const [section, setSection] = useState("Overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(!previewMode);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<ApiUser[]>(previewMode ? previewUsers : []);
  const [courses, setCourses] = useState<ApiCourse[]>(previewMode ? previewCourses : []);
  const [assignments, setAssignments] = useState<ApiAssignment[]>(previewMode ? previewAssignments : []);
  const [submissions, setSubmissions] = useState<ApiSubmission[]>(previewMode ? previewSubmissions : []);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [analytics, setAnalytics] = useState<ApiAdminAnalytics | null>(previewMode ? previewAnalytics : null);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (previewMode) { setLoading(false); return; }
    setError("");
    try {
      const [courseData, assignmentData, notificationData] = await Promise.all([
        campusGradeApi.listCourses(token), campusGradeApi.listAssignments(token), campusGradeApi.listNotifications(token),
      ]);
      setCourses(courseData); setAssignments(assignmentData); setNotifications(notificationData);
      if (role === "admin") {
        const [userData, analyticsData] = await Promise.all([campusGradeApi.listUsers(token), campusGradeApi.adminAnalytics(token)]);
        setUsers(userData); setAnalytics(analyticsData);
      }
      if (role === "student") setSubmissions(await campusGradeApi.mySubmissions(token));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "CampusGrade data could not be loaded");
    } finally { setLoading(false); }
  }, [previewMode, role, token]);

  // Loading remote records is the external synchronization performed by this effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadData(); }, [loadData]);

  const roleCourses = previewMode
    ? role === "professor"
      ? courses.filter((course) => idOf(course.professor) === idOf(session.user))
      : role === "student"
        ? courses.filter((course) => course.students?.some((student) => idOf(student) === idOf(session.user)))
        : courses
    : courses;
  const roleCourseIds = new Set(roleCourses.map((course) => course._id));
  const roleAssignments = previewMode && role !== "admin" ? assignments.filter((assignment) => roleCourseIds.has(assignmentCourseId(assignment))) : assignments;
  const roleSubmissions = previewMode && role === "student" ? submissions.filter((submission) => idOf(submission.student ?? {}) === idOf(session.user)) : submissions;
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const latestSubmission = useMemo(() => {
    const map = new Map<string, ApiSubmission>();
    for (const submission of roleSubmissions) {
      const assignmentId = assignmentIdOf(submission.assignment);
      if (!map.has(assignmentId)) map.set(assignmentId, submission);
    }
    return map;
  }, [roleSubmissions]);

  const markNotificationRead = async (notification: ApiNotification) => {
    if (!previewMode && !notification.readAt) await campusGradeApi.markNotificationRead(token, notification._id);
    setNotifications((current) => current.map((item) => item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item));
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f4f7fb]"><div className="text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-[#315fe3]" /><p className="mt-3 text-sm font-semibold text-[#647187]">Loading MongoDB data…</p></div></div>;

  return <div className="min-h-screen bg-[#f4f7fb] text-[#14213d]">
    <Toaster position="top-right" richColors />
    {mobileNav && <button className="fixed inset-0 z-30 bg-[#07142d]/45 lg:hidden" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#10214a] px-4 py-5 text-white transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center justify-between px-2"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#315fe3]"><GraduationCap className="size-6" /></span><div><p className="text-lg font-extrabold">CampusGrade</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#aabcf0]">Academic OS</p></div></div><Button size="icon-sm" variant="ghost" className="text-white lg:hidden" onClick={() => setMobileNav(false)}><X /></Button></div>
      <div className="mt-7 rounded-xl border border-white/10 bg-white/[0.055] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9eb2e8]">{previewMode ? "Viewing as" : "Signed in as"}</p><div className="mt-2 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#8ba7ff] text-xs font-extrabold text-[#10214a]">{initials(session.user.name)}</span><div className="min-w-0"><p className="truncate text-sm font-bold">{session.user.name}</p><p className="truncate text-xs capitalize text-[#aab8db]">{role}</p></div></div></div>
      <nav className="mt-6 space-y-1">{navByRole[role].map((label) => { const Icon = iconBySection[label as keyof typeof iconBySection]; return <button key={label} onClick={() => { setSection(label); setMobileNav(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${section === label ? "bg-[#315fe3] text-white" : "text-[#b8c5e6] hover:bg-white/[0.07] hover:text-white"}`}><Icon className="size-[1.1rem]" />{label}</button>; })}</nav>
      <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.055] p-3 text-xs leading-5 text-[#b8c5e6]">{previewMode ? "Demo mode is active. Switch dashboards from the header; your demo edits stay available while this page remains open." : "All academic records shown in this portal are loaded from MongoDB."}</div>
    </aside>
    <div className="lg:pl-[260px]">
      <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b bg-white/95 px-4 backdrop-blur sm:px-7 lg:px-9"><div className="flex items-center gap-3"><Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setMobileNav(true)}><Menu /></Button><div><p className="text-lg font-extrabold">{section}</p><p className="hidden text-xs text-[#78849a] sm:block">{session.user.department ?? "CampusGrade"}</p></div></div><div className="flex items-center gap-2">{previewMode && onPreviewRoleChange && <Select value={role} onValueChange={(value) => { setSection("Overview"); setMobileNav(false); onPreviewRoleChange(value as Role); }}><SelectTrigger className="w-[148px] bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Admin dashboard</SelectItem><SelectItem value="professor">Professor dashboard</SelectItem><SelectItem value="student">Student dashboard</SelectItem></SelectContent></Select>}<Badge variant="outline" className="hidden sm:inline-flex">{previewMode ? "Demo mode" : role}</Badge><Button size="icon" variant="outline" className="relative rounded-full" onClick={() => setNotificationOpen(true)}><Bell />{unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[#ea5a63] px-1 text-[10px] font-bold text-white">{unreadCount}</span>}</Button>{!previewMode && <Button size="sm" variant="ghost" onClick={onLogout}><LogOut />Sign out</Button>}</div></header>
      <main className="mx-auto max-w-[1450px] px-4 py-7 sm:px-7 lg:px-9 lg:py-9">
        {error && <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-[#f2c2bf] bg-[#fff2f1] p-4 text-sm font-semibold text-[#a8322d]"><span>{error}</span><Button size="sm" variant="outline" onClick={() => void loadData()}><RefreshCw />Retry</Button></div>}
        {role === "admin" && <AdminPortal section={section} users={users} courses={roleCourses} analytics={analytics} token={token} reload={loadData} previewMode={previewMode} />}
        {role === "professor" && <ProfessorPortal section={section} courses={roleCourses} assignments={roleAssignments} submissions={submissions} notifications={notifications} token={token} reload={loadData} previewMode={previewMode} setAssignments={setAssignments} setSubmissions={setSubmissions} />}
        {role === "student" && <StudentPortal section={section} courses={roleCourses} assignments={roleAssignments} submissions={roleSubmissions} latestSubmission={latestSubmission} token={token} reload={loadData} previewMode={previewMode} setSubmissions={setSubmissions} />}
      </main>
    </div>
    <Dialog open={notificationOpen} onOpenChange={setNotificationOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Notifications</DialogTitle><DialogDescription>Updates saved for your account.</DialogDescription></DialogHeader><div className="grid gap-2">{notifications.length ? notifications.map((item) => <button key={item._id} className={`rounded-xl border p-4 text-left ${item.readAt ? "bg-white" : "border-[#cbd7fa] bg-[#f3f6ff]"}`} onClick={() => void markNotificationRead(item)}><div className="flex justify-between gap-3"><strong className="text-sm">{item.title}</strong>{!item.readAt && <Badge>New</Badge>}</div><p className="mt-1 text-sm text-[#647187]">{item.message}</p><p className="mt-2 text-xs font-semibold text-[#8290a6]">{formatDate(item.createdAt)}</p></button>) : <EmptyState title="No notifications" detail="Account updates will appear here." />}</div></DialogContent></Dialog>
  </div>;
}

function MetricBar({ label, value, color = "bg-[#315fe3]" }: { label: string; value: number; color?: string }) {
  const width = Math.max(0, Math.min(value, 100));
  return <div><div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[#657187]"><span>{label}</span><span>{roundedDisplay(value)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#e8edf5]"><div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} /></div></div>;
}

const roundedDisplay = (value: number) => Number.isInteger(value) ? value : value.toFixed(1);

function AnalyticsSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a96a8]" /><Input className="h-11 bg-white pl-9" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} /></div>;
}

function AdminAnalytics({ analytics }: { analytics: ApiAdminAnalytics | null }) {
  const [professorSearch, setProfessorSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  if (!analytics) return <EmptyState title="Analytics are loading" detail="Campus performance data will appear here." />;

  const professorQuery = professorSearch.trim().toLowerCase();
  const studentQuery = studentSearch.trim().toLowerCase();
  const subjectQuery = subjectSearch.trim().toLowerCase();
  const visibleProfessors = analytics.professors.filter((professor) => `${professor.name} ${professor.campusId} ${professor.id}`.toLowerCase().includes(professorQuery));
  const visibleStudents = analytics.students.filter((student) => `${student.name} ${student.campusId} ${student.id}`.toLowerCase().includes(studentQuery));
  const visibleSubjects = analytics.subjects.filter((subject) => `${subject.title} ${subject.code} ${subject.id}`.toLowerCase().includes(subjectQuery));

  return <div className="space-y-7">
    <div><p className="text-sm font-bold text-[#315fe3]">Administrator analytics</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">Academic performance insights</h1></div>
    <Tabs defaultValue="professors" className="space-y-5">
      <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-xl bg-[#e8edf7] p-1 sm:w-fit sm:grid-cols-3"><TabsTrigger value="professors">Professor analytics</TabsTrigger><TabsTrigger value="students">Student analytics</TabsTrigger><TabsTrigger value="subjects">Subject analytics</TabsTrigger></TabsList>
      <TabsContent value="professors" className="space-y-4">
        <AnalyticsSearch value={professorSearch} onChange={setProfessorSearch} placeholder="Search professors by name or ID" />
        {visibleProfessors.length ? visibleProfessors.map((professor) => <article key={professor.id} className="rounded-2xl border bg-white p-5 shadow-[0_6px_24px_rgba(20,33,61,0.04)] sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-extrabold">{professor.name}</h2><Badge variant="outline" className="font-mono">{professor.campusId}</Badge></div><p className="mt-1 text-sm text-[#758197]">{professor.department} · {professor.courses} {professor.courses === 1 ? "subject" : "subjects"}</p></div><Badge className="bg-[#e8f7f1] text-[#16745e] hover:bg-[#e8f7f1]">Class average {roundedDisplay(professor.averageScore)}%</Badge></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#f6f8fc] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#7a869a]">Assignments created</p><p className="mt-1 text-2xl font-extrabold">{professor.assignmentsCreated}</p></div><div className="rounded-xl bg-[#f6f8fc] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#7a869a]">Students taught</p><p className="mt-1 text-2xl font-extrabold">{professor.studentsTaught}</p></div><div className="rounded-xl bg-[#f6f8fc] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#7a869a]">Submissions received</p><p className="mt-1 text-2xl font-extrabold">{professor.submissionsReceived}</p></div></div><div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]"> <div className="rounded-xl border p-4"><h3 className="font-extrabold">Average marks by subject</h3><div className="mt-4 grid gap-4">{professor.subjectAverages.length ? professor.subjectAverages.map((subject) => <div key={subject.courseId}><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-bold">{subject.code} · {subject.title}</span><span className="text-sm font-extrabold text-[#315fe3]">{roundedDisplay(subject.averageScore)}%</span></div><MetricBar label="Submission rate" value={subject.submissionRate} color="bg-[#36a785]" /></div>) : <p className="text-sm text-[#758197]">No graded subject data yet.</p>}</div></div><div className="rounded-xl border border-[#d9e2ff] bg-[#f5f7ff] p-4"><div className="flex items-center gap-2 text-[#315fe3]"><Lightbulb className="size-5" /><h3 className="font-extrabold">What to improve</h3></div><p className="mt-3 text-sm leading-6 text-[#55627a]">{professor.improvement}</p><div className="mt-4"><MetricBar label="Overall submission rate" value={professor.submissionRate} /></div></div></div></article>) : <EmptyState title={professorQuery ? "No matching professors" : "No professor analytics"} detail={professorQuery ? "Try another professor name or ID." : "Professor performance will appear after courses and assignments are created."} />}
      </TabsContent>
      <TabsContent value="students" className="space-y-4">
        <AnalyticsSearch value={studentSearch} onChange={setStudentSearch} placeholder="Search students by name or ID" />
        {visibleStudents.length ? <section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b p-5"><h2 className="text-lg font-extrabold">Individual student progress</h2><p className="mt-1 text-sm text-[#758197]">Submitted assignments, pending work, average scores, and subject-level focus areas.</p></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Submitted</TableHead><TableHead>Pending</TableHead><TableHead>Average</TableHead><TableHead>Completion</TableHead><TableHead>Strongest subject</TableHead><TableHead>Needs focus</TableHead></TableRow></TableHeader><TableBody>{visibleStudents.map((student) => <TableRow key={student.id}><TableCell><p className="font-bold">{student.name}</p><p className="text-xs text-[#78849a]">{student.campusId} · {student.department}</p></TableCell><TableCell className="font-semibold">{student.assignmentsSubmitted}/{student.assignmentsAvailable}</TableCell><TableCell><Badge variant={student.pendingAssignments ? "outline" : "default"}>{student.pendingAssignments}</Badge></TableCell><TableCell className="font-extrabold text-[#315fe3]">{roundedDisplay(student.averageScore)}%</TableCell><TableCell className="min-w-40"><MetricBar label="" value={student.submissionRate} color="bg-[#36a785]" /></TableCell><TableCell className="max-w-48 text-sm">{student.strongestSubject}</TableCell><TableCell className="max-w-48 text-sm">{student.needsFocus}</TableCell></TableRow>)}</TableBody></Table></div></section> : <EmptyState title={studentQuery ? "No matching students" : "No student analytics"} detail={studentQuery ? "Try another student name or ID." : "Student performance will appear after assignments are submitted."} />}
      </TabsContent>
      <TabsContent value="subjects" className="space-y-4">
        <AnalyticsSearch value={subjectSearch} onChange={setSubjectSearch} placeholder="Search subjects by name or ID" />
        {visibleSubjects.length ? <div className="grid gap-4 lg:grid-cols-2">{visibleSubjects.map((subject) => <article key={subject.id} className="rounded-2xl border bg-white p-5 shadow-[0_6px_24px_rgba(20,33,61,0.04)]"><div className="flex items-start justify-between gap-4"><div><Badge variant="outline">{subject.code}</Badge><h2 className="mt-3 text-lg font-extrabold">{subject.title}</h2><p className="mt-1 text-sm text-[#758197]">{subject.term} · {subject.professor}</p></div><div className="rounded-xl bg-[#e9efff] px-3 py-2 text-center"><p className="text-[10px] font-bold uppercase text-[#6074aa]">Average</p><p className="text-xl font-extrabold text-[#315fe3]">{roundedDisplay(subject.averageScore)}%</p></div></div><div className="mt-5 grid grid-cols-3 gap-3 text-center"><div className="rounded-xl bg-[#f6f8fc] p-3"><p className="text-xl font-extrabold">{subject.assignments}</p><p className="text-xs text-[#758197]">Assignments</p></div><div className="rounded-xl bg-[#f6f8fc] p-3"><p className="text-xl font-extrabold">{subject.enrolledStudents}</p><p className="text-xs text-[#758197]">Students</p></div><div className="rounded-xl bg-[#f6f8fc] p-3"><p className="text-xl font-extrabold">{subject.submissions}</p><p className="text-xs text-[#758197]">Submissions</p></div></div><div className="mt-5"><MetricBar label="Submission rate" value={subject.submissionRate} color="bg-[#36a785]" /></div></article>)}</div> : <EmptyState title={subjectQuery ? "No matching subjects" : "No subject analytics"} detail={subjectQuery ? "Try another subject name or ID." : "Subject analytics will appear after courses are created."} />}
      </TabsContent>
    </Tabs>
  </div>;
}

function AdminPortal({ section, users, courses, analytics, token, reload, previewMode }: { section: string; users: ApiUser[]; courses: ApiCourse[]; analytics: ApiAdminAnalytics | null; token: string; reload: () => Promise<void>; previewMode: boolean }) {
  const [userOpen, setUserOpen] = useState(false);
  const [editing, setEditing] = useState<ApiUser | null>(null);
  const [userForm, setUserForm] = useState({ name: "", email: "", role: "student" as "student" | "professor", department: "Computer Science", password: "" });
  const [credential, setCredential] = useState<{ email: string; password: string } | null>(null);
  const [courseOpen, setCourseOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({ code: "", title: "", term: "", professorId: "" });
  const [search, setSearch] = useState("");
  const professors = users.filter((user) => user.role === "professor" && user.active !== false);
  const visibleUsers = users.filter((user) => user.role !== "admin" && `${user.name} ${user.email} ${user.campusId ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  const openUser = (user?: ApiUser) => {
    if (previewMode) { toast.info("Editing is paused in temporary preview mode"); return; }
    setEditing(user ?? null);
    setUserForm(user ? { name: user.name, email: user.email, role: user.role as "student" | "professor", department: user.department ?? "", password: "" } : { name: "", email: "", role: "student", department: "Computer Science", password: "" });
    setUserOpen(true);
  };
  const saveUser = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (editing) await campusGradeApi.updateUser(token, idOf(editing), { ...userForm, password: userForm.password || undefined });
      else {
        const created = await campusGradeApi.addUser(token, { ...userForm, password: userForm.password || undefined, courses: [] });
        if (created.temporaryPassword) setCredential({ email: created.email, password: created.temporaryPassword });
      }
      setUserOpen(false); await reload(); toast.success(editing ? "User updated" : "User created in MongoDB");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save user"); }
  };
  const removeUser = async (user: ApiUser) => {
    if (previewMode) { toast.info("Database changes are paused in temporary preview mode"); return; }
    if (!confirm(`Deactivate ${user.name}?`)) return;
    try { await campusGradeApi.removeUser(token, idOf(user)); await reload(); toast.success("User deactivated"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to deactivate user"); }
  };
  const saveCourse = async (event: FormEvent) => {
    event.preventDefault();
    if (previewMode) { toast.info("Database changes are paused in temporary preview mode"); return; }
    try { await campusGradeApi.createCourse(token, courseForm); setCourseOpen(false); setCourseForm({ code: "", title: "", term: "", professorId: "" }); await reload(); toast.success("Course created in MongoDB"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create course"); }
  };

  if (section === "Analytics") return <AdminAnalytics analytics={analytics} />;

  if (section === "Overview") return <div className="space-y-7"><div><p className="text-sm font-bold text-[#315fe3]">Administration</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">Campus operations</h1><p className="mt-2 text-[#69758a]">Live totals calculated from MongoDB records.</p></div><div className="grid gap-4 sm:grid-cols-3"><StatCard icon={Users} label="Active users" value={users.filter((user) => user.active !== false).length} /><StatCard icon={GraduationCap} label="Professors" value={professors.length} /><StatCard icon={BookOpen} label="Courses" value={courses.length} /></div></div>;

  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-[#315fe3]">{section === "People" ? "Directory" : "Academic catalog"}</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">{section === "People" ? "Students and faculty" : "Courses"}</h1></div>{section === "People" ? <Button onClick={() => openUser()} disabled={previewMode}><UserRoundPlus />Add user</Button> : <Button onClick={() => setCourseOpen(true)} disabled={previewMode || !professors.length}><Plus />Add course</Button>}</div>
    {section === "People" ? <section className="rounded-2xl border bg-white p-5"><div className="relative mb-4 max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a96a8]" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users" /></div>{visibleUsers.length ? <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>ID</TableHead><TableHead>Role</TableHead><TableHead>Department</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{visibleUsers.map((user) => <TableRow key={idOf(user)}><TableCell><p className="font-bold">{user.name}</p><p className="text-xs text-[#78849a]">{user.email}</p></TableCell><TableCell className="font-mono">{user.campusId}</TableCell><TableCell className="capitalize">{user.role}</TableCell><TableCell>{user.department}</TableCell><TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => openUser(user)}>Edit</Button><Button size="icon-sm" variant="ghost" className="text-[#c93832]" onClick={() => void removeUser(user)}><Trash2 /></Button></TableCell></TableRow>)}</TableBody></Table> : <EmptyState title="No users yet" detail="Create the first professor or student." />}</section> : <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{courses.length ? courses.map((course) => <article key={course._id} className="rounded-2xl border bg-white p-5"><Badge variant="outline">{course.code}</Badge><h2 className="mt-4 text-lg font-extrabold">{course.title}</h2><p className="mt-1 text-sm text-[#69758a]">{course.term}</p><div className="mt-5 border-t pt-4 text-sm"><p className="font-semibold">Professor: {course.professor?.name}</p><p className="mt-1 text-[#78849a]">{course.students?.length ?? 0} students</p></div></article>) : <EmptyState title="No courses yet" detail={professors.length ? "Create the first course." : "Create a professor before creating a course."} />}</section>}
    <Dialog open={userOpen} onOpenChange={setUserOpen}><DialogContent><form onSubmit={saveUser}><DialogHeader><DialogTitle>{editing ? "Edit user" : "Create campus user"}</DialogTitle><DialogDescription>Account information will be stored in MongoDB.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><label className="grid gap-1.5 text-sm font-semibold">Full name<Input required value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Email<Input required type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Role<Select value={userForm.role} onValueChange={(value) => setUserForm({ ...userForm, role: value as "student" | "professor" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="professor">Professor</SelectItem></SelectContent></Select></label><label className="grid gap-1.5 text-sm font-semibold">Department<Input required value={userForm.department} onChange={(event) => setUserForm({ ...userForm, department: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">{editing ? "New password (optional)" : "Password (optional)"}<Input type="password" minLength={8} value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /><span className="text-xs font-normal text-[#78849a]">Leave blank to generate a temporary password.</span></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setUserOpen(false)}>Cancel</Button><Button type="submit">Save user</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={courseOpen} onOpenChange={setCourseOpen}><DialogContent><form onSubmit={saveCourse}><DialogHeader><DialogTitle>Create course</DialogTitle><DialogDescription>The course and professor relationship will be stored in MongoDB.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><label className="grid gap-1.5 text-sm font-semibold">Course code<Input required value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value.toUpperCase() })} placeholder="CS412" /></label><label className="grid gap-1.5 text-sm font-semibold">Course title<Input required value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Term<Input required value={courseForm.term} onChange={(event) => setCourseForm({ ...courseForm, term: event.target.value })} placeholder="Fall 2026" /></label><label className="grid gap-1.5 text-sm font-semibold">Professor<Select required value={courseForm.professorId} onValueChange={(value) => setCourseForm({ ...courseForm, professorId: value })}><SelectTrigger><SelectValue placeholder="Select professor" /></SelectTrigger><SelectContent>{professors.map((professor) => <SelectItem key={idOf(professor)} value={idOf(professor)}>{professor.name}</SelectItem>)}</SelectContent></Select></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setCourseOpen(false)}>Cancel</Button><Button type="submit">Create course</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={Boolean(credential)} onOpenChange={(open) => !open && setCredential(null)}><DialogContent><DialogHeader><DialogTitle>Temporary login created</DialogTitle><DialogDescription>Share this once with the user. CampusGrade does not store readable passwords.</DialogDescription></DialogHeader>{credential && <div className="rounded-xl border bg-[#f8faff] p-4"><p className="text-xs font-bold uppercase text-[#78849a]">Email</p><p className="mt-1 font-mono">{credential.email}</p><p className="mt-4 text-xs font-bold uppercase text-[#78849a]">Temporary password</p><p className="mt-1 break-all font-mono font-bold">{credential.password}</p></div>}</DialogContent></Dialog>
  </div>;
}

function LegacyProfessorPortal({ section, courses, assignments, notifications, token, reload }: { section: string; courses: ApiCourse[]; assignments: ApiAssignment[]; notifications: ApiNotification[]; token: string; reload: () => Promise<void> }) {
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({ courseId: "", topic: "", outcome: "", difficulty: "intermediate", totalPoints: "100", dueDate: "", dueTime: "23:59", aiEvaluationEnabled: true, plagiarismCheckEnabled: true, plagiarismThreshold: "30" });
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?._id ?? "");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<ApiUser[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<ApiAssignment | null>(null);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<ApiSubmission[]>([]);
  const [reviewSubmission, setReviewSubmission] = useState<ApiSubmission | null>(null);
  const [gradeForm, setGradeForm] = useState({ finalGrade: "", facultyFeedback: "" });
  const selectedCourse = courses.find((course) => course._id === selectedCourseId) ?? courses[0];

  const createAssignment = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const generated = await campusGradeApi.generateAssignment(token, { topic: assignmentForm.topic, outcomes: [assignmentForm.outcome], difficulty: assignmentForm.difficulty, totalPoints: Number(assignmentForm.totalPoints) }) as GeneratedAssignment;
      await campusGradeApi.createAssignment(token, {
        course: assignmentForm.courseId, title: generated.title, description: generated.description,
        learningOutcomes: generated.learningOutcomes?.length ? generated.learningOutcomes : [assignmentForm.outcome], difficulty: assignmentForm.difficulty,
        rubric: generated.rubric ?? [], questions: generated.questions, totalPoints: Number(assignmentForm.totalPoints),
        dueAt: new Date(`${assignmentForm.dueDate}T${assignmentForm.dueTime}:00`).toISOString(), status: "published", aiGenerated: true,
        aiEvaluationEnabled: assignmentForm.aiEvaluationEnabled, plagiarismCheckEnabled: assignmentForm.plagiarismCheckEnabled, plagiarismThreshold: Number(assignmentForm.plagiarismThreshold),
      });
      setAssignmentOpen(false); await reload(); toast.success("Assignment created and published");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create assignment"); }
  };
  const searchStudents = async () => {
    if (!studentQuery.trim()) return;
    try { setStudentResults(await campusGradeApi.searchStudents(token, studentQuery)); } catch (error) { toast.error(error instanceof Error ? error.message : "Search failed"); }
  };
  const addStudent = async (student: ApiUser) => {
    if (!selectedCourse) return;
    try { await campusGradeApi.addStudentToCourse(token, selectedCourse._id, idOf(student)); setStudentResults([]); setStudentQuery(""); await reload(); toast.success(`${student.name} added`); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to add student"); }
  };
  const removeStudent = async (student: ApiUser) => {
    if (!selectedCourse || !confirm(`Remove ${student.name} from ${selectedCourse.code}?`)) return;
    try { await campusGradeApi.removeStudentFromCourse(token, selectedCourse._id, idOf(student)); await reload(); toast.success("Student removed"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to remove student"); }
  };
  const openSubmissions = async (assignment: ApiAssignment) => {
    try { setSelectedAssignment(assignment); setAssignmentSubmissions(await campusGradeApi.assignmentSubmissions(token, assignment._id)); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load submissions"); }
  };
  const openReview = (submission: ApiSubmission) => {
    setReviewSubmission(submission);
    setGradeForm({ finalGrade: String(submission.finalGrade ?? submission.aiEvaluation?.suggestedGrade ?? ""), facultyFeedback: submission.facultyFeedback ?? submission.aiEvaluation?.summary ?? "" });
  };
  const finalize = async () => {
    if (!reviewSubmission) return;
    try { await campusGradeApi.finalizeSubmission(token, reviewSubmission._id, { finalGrade: Number(gradeForm.finalGrade), facultyFeedback: gradeForm.facultyFeedback, scores: [] }); setReviewSubmission(null); if (selectedAssignment) await openSubmissions(selectedAssignment); await reload(); toast.success("Grade released"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to release grade"); }
  };

  if (section === "Overview") return <div className="space-y-7"><div><p className="text-sm font-bold text-[#315fe3]">Faculty workspace</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">Coursework overview</h1><p className="mt-2 text-[#69758a]">Live totals from your courses and assignments.</p></div><div className="grid gap-4 sm:grid-cols-3"><StatCard icon={BookOpen} label="My courses" value={courses.length} /><StatCard icon={ClipboardCheck} label="Assignments" value={assignments.length} /><StatCard icon={Bell} label="Unread notifications" value={notifications.filter((item) => !item.readAt).length} /></div></div>;

  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-[#315fe3]">{section === "Assignments" ? "Coursework" : "Enrollment"}</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">{section}</h1></div>{section === "Assignments" ? <Button disabled={!courses.length} onClick={() => { setAssignmentForm((current) => ({ ...current, courseId: courses[0]?._id ?? "" })); setAssignmentOpen(true); }}><Sparkles />Generate assignment</Button> : null}</div>
    {section === "Assignments" ? <div className="grid gap-4">{assignments.length ? assignments.map((assignment) => <article key={assignment._id} className="flex flex-col justify-between gap-4 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-extrabold">{assignment.title}</h2><Badge variant="outline" className="font-mono">{assignment.assignmentCode}</Badge><Badge className="capitalize">{assignment.status}</Badge></div><p className="mt-2 text-sm text-[#69758a]">{courseName(assignment.course)} · Due {formatDate(assignment.dueAt)}</p><p className="mt-2 text-xs font-semibold text-[#78849a]">{assignment.totalPoints} points · Plagiarism {assignment.plagiarismCheckEnabled ? `${assignment.plagiarismThreshold}% limit` : "off"}</p></div><Button onClick={() => void openSubmissions(assignment)}>View submissions</Button></article>) : <EmptyState title="No assignments" detail={courses.length ? "Generate the first assignment." : "An administrator must assign you a course first."} />}</div> : <div className="space-y-5">{courses.length ? <><Select value={selectedCourse?._id} onValueChange={setSelectedCourseId}><SelectTrigger className="max-w-md bg-white"><SelectValue /></SelectTrigger><SelectContent>{courses.map((course) => <SelectItem key={course._id} value={course._id}>{course.code} · {course.title}</SelectItem>)}</SelectContent></Select><section className="rounded-2xl border bg-white p-5"><div className="flex gap-2"><Input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Student ID or email" onKeyDown={(event) => event.key === "Enter" && void searchStudents()} /><Button onClick={() => void searchStudents()}><Search />Search</Button></div>{studentResults.length > 0 && <div className="mt-3 rounded-xl border">{studentResults.map((student) => <button key={idOf(student)} className="flex w-full items-center justify-between border-b p-3 text-left last:border-0" onClick={() => void addStudent(student)}><span><strong className="block">{student.name}</strong><span className="text-xs text-[#78849a]">{student.campusId} · {student.email}</span></span><Plus /></button>)}</div>}<div className="mt-5">{selectedCourse?.students?.length ? <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>ID</TableHead><TableHead>Department</TableHead><TableHead /></TableRow></TableHeader><TableBody>{selectedCourse.students.map((student) => <TableRow key={idOf(student)}><TableCell><p className="font-bold">{student.name}</p><p className="text-xs text-[#78849a]">{student.email}</p></TableCell><TableCell className="font-mono">{student.campusId}</TableCell><TableCell>{student.department}</TableCell><TableCell className="text-right"><Button size="icon-sm" variant="ghost" className="text-[#c93832]" onClick={() => void removeStudent(student)}><Trash2 /></Button></TableCell></TableRow>)}</TableBody></Table> : <EmptyState title="No students enrolled" detail="Search for an existing student account to add it." />}</div></section></> : <EmptyState title="No courses assigned" detail="Ask an administrator to create a course for your account." />}</div>}
    <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><form onSubmit={createAssignment}><DialogHeader><DialogTitle>Generate assignment</DialogTitle><DialogDescription>The AI draft will be reviewed by this form and stored in MongoDB.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><label className="grid gap-1.5 text-sm font-semibold">Course<Select required value={assignmentForm.courseId} onValueChange={(value) => setAssignmentForm({ ...assignmentForm, courseId: value })}><SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger><SelectContent>{courses.map((course) => <SelectItem key={course._id} value={course._id}>{course.code} · {course.title}</SelectItem>)}</SelectContent></Select></label><label className="grid gap-1.5 text-sm font-semibold">Topic<Input required value={assignmentForm.topic} onChange={(event) => setAssignmentForm({ ...assignmentForm, topic: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Learning outcome<Input required value={assignmentForm.outcome} onChange={(event) => setAssignmentForm({ ...assignmentForm, outcome: event.target.value })} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold">Due date<Input required type="date" value={assignmentForm.dueDate} onChange={(event) => setAssignmentForm({ ...assignmentForm, dueDate: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Due time<Input required type="time" value={assignmentForm.dueTime} onChange={(event) => setAssignmentForm({ ...assignmentForm, dueTime: event.target.value })} /></label></div><label className="flex items-start gap-3 rounded-xl border p-3"><Checkbox checked={assignmentForm.aiEvaluationEnabled} onCheckedChange={(value) => setAssignmentForm({ ...assignmentForm, aiEvaluationEnabled: value === true })} /><span><strong className="block text-sm">AI evaluation</strong><span className="text-xs text-[#78849a]">Suggest scores for professor review.</span></span></label><label className="flex items-start gap-3 rounded-xl border p-3"><Checkbox checked={assignmentForm.plagiarismCheckEnabled} onCheckedChange={(value) => setAssignmentForm({ ...assignmentForm, plagiarismCheckEnabled: value === true })} /><span><strong className="block text-sm">Plagiarism check</strong><span className="text-xs text-[#78849a]">Compare against other MongoDB submissions.</span></span></label>{assignmentForm.plagiarismCheckEnabled && <label className="grid gap-1.5 text-sm font-semibold">Allowed plagiarism<Select value={assignmentForm.plagiarismThreshold} onValueChange={(value) => setAssignmentForm({ ...assignmentForm, plagiarismThreshold: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[10,20,30,40,50].map((value) => <SelectItem key={value} value={String(value)}>{value}%</SelectItem>)}</SelectContent></Select></label>}</div><DialogFooter><Button type="button" variant="outline" onClick={() => setAssignmentOpen(false)}>Cancel</Button><Button type="submit"><Sparkles />Generate and publish</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={Boolean(selectedAssignment)} onOpenChange={(open) => !open && setSelectedAssignment(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{selectedAssignment?.title}</DialogTitle><DialogDescription>Submissions and AI results loaded from MongoDB.</DialogDescription></DialogHeader>{assignmentSubmissions.length ? <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Submitted</TableHead><TableHead>AI score</TableHead><TableHead>Plagiarism</TableHead><TableHead /></TableRow></TableHeader><TableBody>{assignmentSubmissions.map((submission) => <TableRow key={submission._id}><TableCell><p className="font-bold">{submission.student?.name}</p><p className="text-xs text-[#78849a]">{submission.student?.campusId}</p></TableCell><TableCell>{formatDate(submission.submittedAt)}</TableCell><TableCell>{submission.aiEvaluation?.suggestedGrade ?? "—"}</TableCell><TableCell>{submission.aiEvaluation?.plagiarismLevel ?? "—"}{submission.aiEvaluation?.plagiarismLevel !== undefined ? "%" : ""}</TableCell><TableCell className="text-right"><Button size="sm" onClick={() => openReview(submission)}>Review</Button></TableCell></TableRow>)}</TableBody></Table> : <EmptyState title="No submissions" detail="Student submissions will appear here." />}</DialogContent></Dialog>
    <Dialog open={Boolean(reviewSubmission)} onOpenChange={(open) => !open && setReviewSubmission(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>Review {reviewSubmission?.student?.name}</DialogTitle><DialogDescription>AI results are suggestions. The professor releases the final grade.</DialogDescription></DialogHeader>{reviewSubmission && selectedAssignment && <div className="grid gap-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border bg-[#eefaf6] p-4"><p className="text-xs font-bold uppercase text-[#58786f]">AI suggested grade</p><p className="mt-1 text-3xl font-extrabold text-[#16866a]">{reviewSubmission.aiEvaluation?.suggestedGrade ?? "—"}</p></div><div className="rounded-xl border bg-[#fff7eb] p-4"><p className="text-xs font-bold uppercase text-[#8a632e]">Plagiarism</p><p className="mt-1 text-3xl font-extrabold text-[#b66b18]">{reviewSubmission.aiEvaluation?.plagiarismLevel ?? 0}%</p></div></div>{reviewSubmission.answers.map((answer, index) => <section key={`${answer.question}-${index}`} className="rounded-xl border p-4"><p className="text-xs font-bold uppercase text-[#78849a]">Question {index + 1}</p><p className="mt-1 font-bold">{selectedAssignment.questions.find((question) => question._id === answer.question)?.prompt}</p><pre className="mt-3 whitespace-pre-wrap rounded-lg bg-[#101827] p-4 text-sm text-[#d9e4f5]">{answer.answer}</pre><p className="mt-3 text-sm text-[#5f6d82]">{reviewSubmission.aiEvaluation?.scores?.find((score) => score.questionId === answer.question)?.note}</p></section>)}{(reviewSubmission.aiEvaluation?.plagiarismEvidence?.length ?? 0) > 0 && <section><h3 className="font-extrabold">Plagiarism evidence</h3><div className="mt-3 grid gap-3">{reviewSubmission.aiEvaluation?.plagiarismEvidence?.map((evidence, index) => <div key={index} className="rounded-xl border border-[#f0cda6] bg-[#fff9f0] p-4"><div className="flex justify-between gap-4"><strong>{evidence.source}</strong><Badge variant="outline">{evidence.similarity}% match</Badge></div><p className="mt-2 text-sm text-[#6f5a40]">{evidence.explanation}</p></div>)}</div></section>}<div className="grid gap-4 sm:grid-cols-[160px_1fr]"><label className="grid gap-1.5 text-sm font-semibold">Final grade<Input required type="number" min="0" max={selectedAssignment.totalPoints} value={gradeForm.finalGrade} onChange={(event) => setGradeForm({ ...gradeForm, finalGrade: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Faculty feedback<Textarea value={gradeForm.facultyFeedback} onChange={(event) => setGradeForm({ ...gradeForm, facultyFeedback: event.target.value })} /></label></div></div>}<DialogFooter><Button onClick={() => void finalize()}><CheckCircle2 />Release grade</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function LegacyStudentPortal({ section, courses, assignments, submissions, latestSubmission, token, reload }: { section: string; courses: ApiCourse[]; assignments: ApiAssignment[]; submissions: ApiSubmission[]; latestSubmission: Map<string, ApiSubmission>; token: string; reload: () => Promise<void> }) {
  const [homework, setHomework] = useState<ApiAssignment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const openHomework = (assignment: ApiAssignment) => {
    const submission = latestSubmission.get(assignment._id);
    setAnswers(Object.fromEntries((submission?.answers ?? []).map((answer) => [answer.question, answer.answer])));
    setHomework(assignment);
  };
  const submit = async () => {
    if (!homework) return;
    const missing = homework.questions.some((question) => !answers[question._id]?.trim());
    if (missing) return toast.error("Answer every question before submitting");
    try { await campusGradeApi.submitHomework(token, { assignmentId: homework._id, answers: homework.questions.map((question) => ({ question: question._id, type: question.type, answer: answers[question._id] })) }); setHomework(null); await reload(); toast.success("Homework submitted to MongoDB"); } catch (error) { toast.error(error instanceof Error ? error.message : "Submission failed"); }
  };
  const shownAssignments = section === "Submissions" ? assignments.filter((assignment) => latestSubmission.has(assignment._id)) : assignments;
  const graded = submissions.filter((submission) => submission.status === "graded");
  const average = graded.length ? Math.round(graded.reduce((sum, submission) => sum + (submission.finalGrade ?? 0), 0) / graded.length) : 0;

  if (section === "Overview") return <div className="space-y-7"><div><p className="text-sm font-bold text-[#315fe3]">Student workspace</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">My coursework</h1><p className="mt-2 text-[#69758a]">Live totals from your enrollment and submissions.</p></div><div className="grid gap-4 sm:grid-cols-3"><StatCard icon={BookOpen} label="My courses" value={courses.length} /><StatCard icon={ClipboardCheck} label="Assignments" value={assignments.length} /><StatCard icon={CheckCircle2} label="Current average" value={graded.length ? `${average}%` : "—"} /></div></div>;

  return <div className="space-y-6"><div><p className="text-sm font-bold text-[#315fe3]">Coursework</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">{section}</h1></div>{shownAssignments.length ? <div className="grid gap-4">{shownAssignments.map((assignment) => { const submission = latestSubmission.get(assignment._id); return <article key={assignment._id} className="flex flex-col justify-between gap-4 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-extrabold">{assignment.title}</h2><Badge variant="outline" className="font-mono">{assignment.assignmentCode}</Badge>{submission && <Badge className="capitalize">{submission.status.replace("_", " ")}</Badge>}</div><p className="mt-2 text-sm text-[#69758a]">{courseName(assignment.course)} · Due {formatDate(assignment.dueAt)}</p>{submission?.status === "graded" && <p className="mt-2 font-bold text-[#16866a]">Grade: {submission.finalGrade}/{assignment.totalPoints}</p>}</div><Button variant={submission ? "outline" : "default"} onClick={() => openHomework(assignment)}>{submission ? "View submission" : "Open homework"}</Button></article>; })}</div> : <EmptyState title="Nothing here yet" detail={section === "Submissions" ? "Your submitted homework will appear here." : "Published assignments from your courses will appear here."} />}
    <Dialog open={Boolean(homework)} onOpenChange={(open) => !open && setHomework(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{homework?.title}</DialogTitle><DialogDescription>{homework && `${courseName(homework.course)} · ${homework.totalPoints} points · Due ${formatDate(homework.dueAt)}`}</DialogDescription></DialogHeader>{homework && (() => { const submission = latestSubmission.get(homework._id); const locked = Boolean(submission); return <div className="grid gap-4">{submission?.status === "graded" && <div className="rounded-xl border border-[#bce7da] bg-[#eaf9f4] p-4"><p className="text-sm font-bold text-[#11765f]">Final grade: {submission.finalGrade}/{homework.totalPoints}</p><p className="mt-1 text-sm text-[#4f6f66]">{submission.facultyFeedback}</p>{submission.aiEvaluation?.plagiarismLevel !== undefined && <p className="mt-2 text-xs font-bold text-[#65766f]">Plagiarism: {submission.aiEvaluation.plagiarismLevel}%</p>}</div>}{homework.questions.map((question, index) => <section key={question._id} className="rounded-xl border p-4"><div className="flex justify-between gap-4"><div><p className="text-xs font-bold uppercase text-[#78849a]">Question {index + 1}</p><p className="mt-1 font-bold">{question.prompt}</p></div><Badge variant="outline">{question.points} pts</Badge></div><Textarea readOnly={locked} className={question.type === "code" ? "mt-4 min-h-40 bg-[#101827] font-mono text-[#d9e4f5]" : "mt-4 min-h-28"} value={answers[question._id] ?? ""} onChange={(event) => setAnswers({ ...answers, [question._id]: event.target.value })} /></section>)}<DialogFooter><Button variant="outline" onClick={() => setHomework(null)}>Close</Button>{!locked && <Button onClick={() => void submit()}><UploadCloud />Submit homework</Button>}</DialogFooter></div>; })()}</DialogContent></Dialog>
  </div>;
}

type ProfessorPortalProps = {
  section: string;
  courses: ApiCourse[];
  assignments: ApiAssignment[];
  submissions: ApiSubmission[];
  notifications: ApiNotification[];
  token: string;
  reload: () => Promise<void>;
  previewMode: boolean;
  setAssignments: Dispatch<SetStateAction<ApiAssignment[]>>;
  setSubmissions: Dispatch<SetStateAction<ApiSubmission[]>>;
};

const localDatePart = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const localTimePart = (value?: string) => value ? new Date(value).toTimeString().slice(0, 5) : "23:59";

function ProfessorPortal({ section, courses, assignments, submissions, notifications, token, reload, previewMode, setAssignments, setSubmissions }: ProfessorPortalProps) {
  const blankAssignment = { courseId: courses[0]?._id ?? "", topic: "", outcome: "", difficulty: "intermediate", totalPoints: "100", dueDate: "", dueTime: "23:59", aiEvaluationEnabled: true, plagiarismCheckEnabled: true, plagiarismThreshold: "30" };
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState(blankAssignment);
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deadlineAssignment, setDeadlineAssignment] = useState<ApiAssignment | null>(null);
  const [deadlineForm, setDeadlineForm] = useState({ dueDate: "", dueTime: "23:59" });
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?._id ?? "");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<ApiUser[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<ApiAssignment | null>(null);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<ApiSubmission[]>([]);
  const [reviewSubmission, setReviewSubmission] = useState<ApiSubmission | null>(null);
  const [questionScores, setQuestionScores] = useState<Record<string, string>>({});
  const [facultyFeedback, setFacultyFeedback] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnForm, setReturnForm] = useState({ facultyFeedback: "", dueDate: "", dueTime: "23:59" });
  const selectedCourse = courses.find((course) => course._id === selectedCourseId) ?? courses[0];

  const closeAssignmentBuilder = () => {
    setAssignmentOpen(false);
    setAssignmentDraft(null);
    setGenerating(false);
  };
  const generateDraft = async (event: FormEvent) => {
    event.preventDefault();
    setGenerating(true);
    try {
      const total = Number(assignmentForm.totalPoints);
      const first = Math.max(1, Math.round(total * 0.3));
      const second = Math.max(1, Math.round(total * 0.5));
      const fallback: GeneratedAssignment = {
        title: assignmentForm.topic,
        description: `Apply course concepts to ${assignmentForm.topic} through analysis, implementation, and reflection.`,
        learningOutcomes: [assignmentForm.outcome],
        questions: [
          { prompt: `Explain the main concepts and risks involved in ${assignmentForm.topic}.`, type: "text", points: first },
          { prompt: `Create a practical solution for ${assignmentForm.topic} and explain your design choices.`, type: "code", language: "JavaScript", points: second },
          { prompt: "Evaluate the solution and recommend two improvements.", type: "text", points: Math.max(1, total - first - second) },
        ],
      };
      const generated = previewMode ? fallback : await campusGradeApi.generateAssignment(token, { topic: assignmentForm.topic, outcomes: [assignmentForm.outcome], difficulty: assignmentForm.difficulty, totalPoints: total }) as GeneratedAssignment;
      setAssignmentDraft({ ...generated, questions: generated.questions.map((question, index) => ({ ...question, id: `draft-${Date.now()}-${index}` })) });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to generate questions"); }
    finally { setGenerating(false); }
  };
  const updateDraftQuestion = (id: string, change: Partial<EditableQuestion>) => setAssignmentDraft((draft) => draft ? { ...draft, questions: draft.questions.map((question) => question.id === id ? { ...question, ...change } : question) } : draft);
  const moveDraftQuestion = (index: number, direction: -1 | 1) => setAssignmentDraft((draft) => {
    if (!draft) return draft;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.questions.length) return draft;
    const questions = [...draft.questions];
    [questions[index], questions[nextIndex]] = [questions[nextIndex], questions[index]];
    return { ...draft, questions };
  });
  const addDraftQuestion = () => setAssignmentDraft((draft) => draft ? { ...draft, questions: [...draft.questions, { id: `draft-${Date.now()}`, prompt: "", type: "text", points: 10 }] } : draft);
  const publishAssignment = async () => {
    if (!assignmentDraft) return;
    if (!assignmentDraft.questions.length || assignmentDraft.questions.some((question) => !question.prompt.trim() || question.points <= 0)) return toast.error("Every question needs wording and a maximum score above zero");
    const course = courses.find((item) => item._id === assignmentForm.courseId);
    if (!course) return toast.error("Select a course");
    const totalPoints = assignmentDraft.questions.reduce((sum, question) => sum + question.points, 0);
    const dueAt = new Date(`${assignmentForm.dueDate}T${assignmentForm.dueTime}:00`).toISOString();
    try {
      const input = {
        course: assignmentForm.courseId, title: assignmentDraft.title, description: assignmentDraft.description,
        learningOutcomes: assignmentDraft.learningOutcomes?.length ? assignmentDraft.learningOutcomes : [assignmentForm.outcome], difficulty: assignmentForm.difficulty,
        rubric: assignmentDraft.rubric ?? [], questions: assignmentDraft.questions.map((question) => ({ prompt: question.prompt, type: question.type, language: question.language, points: question.points })), totalPoints, dueAt,
        status: "published", aiGenerated: true, aiEvaluationEnabled: assignmentForm.aiEvaluationEnabled,
        plagiarismCheckEnabled: assignmentForm.plagiarismCheckEnabled, plagiarismThreshold: Number(assignmentForm.plagiarismThreshold),
      };
      if (previewMode) {
        const created: ApiAssignment = { ...input, _id: `preview-assignment-${Date.now()}`, assignmentCode: `A${Math.floor(10000 + Math.random() * 90000)}`, course, difficulty: assignmentForm.difficulty as ApiAssignment["difficulty"], status: "published", plagiarismThreshold: Number(assignmentForm.plagiarismThreshold) as ApiAssignment["plagiarismThreshold"], questions: assignmentDraft.questions.map((question, index) => ({ _id: `question-${Date.now()}-${index}`, prompt: question.prompt, type: question.type, language: question.language, points: question.points })) };
        setAssignments((current) => [created, ...current]);
      } else {
        await campusGradeApi.createAssignment(token, input);
        await reload();
      }
      closeAssignmentBuilder();
      setAssignmentForm({ ...blankAssignment, courseId: courses[0]?._id ?? "" });
      toast.success("Assignment published");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to publish assignment"); }
  };
  const openDeadline = (assignment: ApiAssignment) => {
    setDeadlineAssignment(assignment);
    setDeadlineForm({ dueDate: localDatePart(assignment.dueAt), dueTime: localTimePart(assignment.dueAt) });
  };
  const saveDeadline = async () => {
    if (!deadlineAssignment || !deadlineForm.dueDate) return;
    const dueAt = new Date(`${deadlineForm.dueDate}T${deadlineForm.dueTime}:00`).toISOString();
    try {
      if (previewMode) setAssignments((current) => current.map((assignment) => assignment._id === deadlineAssignment._id ? { ...assignment, dueAt } : assignment));
      else { await campusGradeApi.updateAssignment(token, deadlineAssignment._id, { dueAt }); await reload(); }
      setDeadlineAssignment(null);
      toast.success("Deadline updated and students notified");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update deadline"); }
  };
  const searchStudents = async () => {
    if (!studentQuery.trim()) return;
    if (previewMode) { setStudentResults([]); toast.info("The demo course already includes sample students"); return; }
    try { setStudentResults(await campusGradeApi.searchStudents(token, studentQuery)); } catch (error) { toast.error(error instanceof Error ? error.message : "Search failed"); }
  };
  const addStudent = async (student: ApiUser) => {
    if (!selectedCourse || previewMode) return;
    try { await campusGradeApi.addStudentToCourse(token, selectedCourse._id, idOf(student)); setStudentResults([]); setStudentQuery(""); await reload(); toast.success(`${student.name} added`); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to add student"); }
  };
  const removeStudent = async (student: ApiUser) => {
    if (!selectedCourse || previewMode || !confirm(`Remove ${student.name} from ${selectedCourse.code}?`)) return;
    try { await campusGradeApi.removeStudentFromCourse(token, selectedCourse._id, idOf(student)); await reload(); toast.success("Student removed"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to remove student"); }
  };
  const openSubmissions = async (assignment: ApiAssignment) => {
    try {
      setSelectedAssignment(assignment);
      setAssignmentSubmissions(previewMode ? submissions.filter((submission) => assignmentIdOf(submission.assignment) === assignment._id) : await campusGradeApi.assignmentSubmissions(token, assignment._id));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load submissions"); }
  };
  const openReview = (submission: ApiSubmission) => {
    setReviewSubmission(submission);
    setFacultyFeedback(submission.facultyFeedback ?? submission.aiEvaluation?.summary ?? "");
    setQuestionScores(Object.fromEntries((selectedAssignment?.questions ?? []).map((question) => {
      const score = submission.aiEvaluation?.scores?.find((item) => item.questionId === question._id)?.score ?? 0;
      return [question._id, String(score)];
    })));
  };
  const calculatedScore = selectedAssignment?.questions.reduce((sum, question) => sum + Number(questionScores[question._id] || 0), 0) ?? 0;
  const finalize = async () => {
    if (!reviewSubmission || !selectedAssignment) return;
    const invalid = selectedAssignment.questions.some((question) => Number(questionScores[question._id]) < 0 || Number(questionScores[question._id]) > question.points);
    if (invalid) return toast.error("Question marks must be between zero and the maximum score");
    const scores = selectedAssignment.questions.map((question) => {
      const previous = reviewSubmission.aiEvaluation?.scores?.find((item) => item.questionId === question._id);
      return { questionId: question._id, score: Number(questionScores[question._id] || 0), maxPoints: question.points, criterion: previous?.criterion, note: previous?.note };
    });
    try {
      if (previewMode) {
        const updated: ApiSubmission = { ...reviewSubmission, status: "graded", finalGrade: calculatedScore, facultyFeedback, scoreReleasedAt: new Date().toISOString(), aiEvaluation: { ...reviewSubmission.aiEvaluation, scores } };
        setSubmissions((current) => current.map((submission) => submission._id === updated._id ? updated : submission));
        setAssignmentSubmissions((current) => current.map((submission) => submission._id === updated._id ? updated : submission));
      } else {
        await campusGradeApi.finalizeSubmission(token, reviewSubmission._id, { finalGrade: calculatedScore, facultyFeedback, scores });
        await openSubmissions(selectedAssignment);
        await reload();
      }
      setReviewSubmission(null);
      toast.success("Grade released");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to release grade"); }
  };
  const openReturn = () => {
    if (!reviewSubmission) return;
    setReturnForm({ facultyFeedback: facultyFeedback || "Please review the question feedback and improve your answers.", dueDate: "", dueTime: "23:59" });
    setReturnOpen(true);
  };
  const returnForImprovement = async () => {
    if (!reviewSubmission) return;
    if (returnForm.facultyFeedback.trim().length < 3) return toast.error("Add improvement instructions");
    if (!returnForm.dueDate) return toast.error("Select a new due date");
    if (!returnForm.dueTime) return toast.error("Select a due time");
    const resubmissionDueAt = new Date(`${returnForm.dueDate}T${returnForm.dueTime}:00`).toISOString();
    try {
      if (previewMode) {
        const updated: ApiSubmission = { ...reviewSubmission, status: "returned", facultyFeedback: returnForm.facultyFeedback, returnedAt: new Date().toISOString(), resubmissionDueAt };
        setSubmissions((current) => current.map((submission) => submission._id === updated._id ? updated : submission));
        setAssignmentSubmissions((current) => current.map((submission) => submission._id === updated._id ? updated : submission));
      } else {
        await campusGradeApi.returnForImprovement(token, reviewSubmission._id, { facultyFeedback: returnForm.facultyFeedback, resubmissionDueAt });
        if (selectedAssignment) await openSubmissions(selectedAssignment);
        await reload();
      }
      setReturnOpen(false);
      setReviewSubmission(null);
      toast.success("Homework returned for improvement");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to return homework"); }
  };

  if (section === "Overview") return <div className="space-y-7"><div><p className="text-sm font-bold text-[#315fe3]">Faculty workspace</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">Coursework overview</h1><p className="mt-2 text-[#69758a]">Create, review, and improve student coursework.</p></div><div className="grid gap-4 sm:grid-cols-3"><StatCard icon={BookOpen} label="My courses" value={courses.length} /><StatCard icon={ClipboardCheck} label="Assignments" value={assignments.length} /><StatCard icon={Bell} label="Unread notifications" value={notifications.filter((item) => !item.readAt).length} /></div></div>;

  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-[#315fe3]">{section === "Assignments" ? "Coursework" : "Enrollment"}</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">{section}</h1></div>{section === "Assignments" && <Button disabled={!courses.length} onClick={() => { setAssignmentForm({ ...blankAssignment, courseId: courses[0]?._id ?? "" }); setAssignmentDraft(null); setAssignmentOpen(true); }}><Sparkles />Generate assignment</Button>}</div>
    {section === "Assignments" ? <div className="grid gap-4">{assignments.length ? assignments.map((assignment) => <article key={assignment._id} className="flex flex-col justify-between gap-4 rounded-2xl border bg-white p-5 lg:flex-row lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-extrabold">{assignment.title}</h2><Badge variant="outline" className="font-mono">{assignment.assignmentCode}</Badge><Badge className="capitalize">{assignment.status}</Badge></div><p className="mt-2 text-sm text-[#69758a]">{courseName(assignment.course)} · Due {formatDate(assignment.dueAt)}</p><p className="mt-2 text-xs font-semibold text-[#78849a]">{assignment.questions.length} questions · {assignment.totalPoints} points · Plagrism {assignment.plagiarismCheckEnabled ? `${assignment.plagiarismThreshold}% limit` : "off"}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => openDeadline(assignment)}><CalendarClock />Edit deadline</Button><Button onClick={() => void openSubmissions(assignment)}>View submissions</Button></div></article>) : <EmptyState title="No assignments" detail={courses.length ? "Generate the first assignment." : "An administrator must assign you a course first."} />}</div> : <div className="space-y-5">{courses.length ? <><Select value={selectedCourse?._id} onValueChange={setSelectedCourseId}><SelectTrigger className="max-w-md bg-white"><SelectValue /></SelectTrigger><SelectContent>{courses.map((course) => <SelectItem key={course._id} value={course._id}>{course.code} · {course.title}</SelectItem>)}</SelectContent></Select><section className="rounded-2xl border bg-white p-5"><div className="flex gap-2"><Input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Student ID or email" onKeyDown={(event) => event.key === "Enter" && void searchStudents()} /><Button onClick={() => void searchStudents()}><Search />Search</Button></div>{studentResults.length > 0 && <div className="mt-3 rounded-xl border">{studentResults.map((student) => <button key={idOf(student)} className="flex w-full items-center justify-between border-b p-3 text-left last:border-0" onClick={() => void addStudent(student)}><span><strong className="block">{student.name}</strong><span className="text-xs text-[#78849a]">{student.campusId} · {student.email}</span></span><Plus /></button>)}</div>}<div className="mt-5">{selectedCourse?.students?.length ? <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>ID</TableHead><TableHead>Department</TableHead><TableHead /></TableRow></TableHeader><TableBody>{selectedCourse.students.map((student) => <TableRow key={idOf(student)}><TableCell><p className="font-bold">{student.name}</p><p className="text-xs text-[#78849a]">{student.email}</p></TableCell><TableCell className="font-mono">{student.campusId}</TableCell><TableCell>{student.department}</TableCell><TableCell className="text-right"><Button size="icon-sm" variant="ghost" disabled={previewMode} className="text-[#c93832]" onClick={() => void removeStudent(student)}><Trash2 /></Button></TableCell></TableRow>)}</TableBody></Table> : <EmptyState title="No students enrolled" detail="Search for an existing student account to add it." />}</div></section></> : <EmptyState title="No courses assigned" detail="Ask an administrator to create a course for your account." />}</div>}

    <Dialog open={assignmentOpen} onOpenChange={(open) => { if (!open) closeAssignmentBuilder(); }}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">{!assignmentDraft ? <form onSubmit={generateDraft}><DialogHeader><DialogTitle>Generate assignment</DialogTitle><DialogDescription>Set the topic first. You can edit every AI-generated question and score before publishing.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><label className="grid gap-1.5 text-sm font-semibold">Course<Select required value={assignmentForm.courseId} onValueChange={(value) => setAssignmentForm({ ...assignmentForm, courseId: value })}><SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger><SelectContent>{courses.map((course) => <SelectItem key={course._id} value={course._id}>{course.code} · {course.title}</SelectItem>)}</SelectContent></Select></label><label className="grid gap-1.5 text-sm font-semibold">Topic<Input required value={assignmentForm.topic} onChange={(event) => setAssignmentForm({ ...assignmentForm, topic: event.target.value })} placeholder="API test strategy and automation" /></label><label className="grid gap-1.5 text-sm font-semibold">Learning outcome<Input required value={assignmentForm.outcome} onChange={(event) => setAssignmentForm({ ...assignmentForm, outcome: event.target.value })} /></label><div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1.5 text-sm font-semibold">Difficulty<Select value={assignmentForm.difficulty} onValueChange={(value) => setAssignmentForm({ ...assignmentForm, difficulty: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="beginner">Beginner</SelectItem><SelectItem value="intermediate">Intermediate</SelectItem><SelectItem value="advanced">Advanced</SelectItem></SelectContent></Select></label><label className="grid gap-1.5 text-sm font-semibold">Target score<Input required type="number" min="1" value={assignmentForm.totalPoints} onChange={(event) => setAssignmentForm({ ...assignmentForm, totalPoints: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Allowed plagrism<Select value={assignmentForm.plagiarismThreshold} onValueChange={(value) => setAssignmentForm({ ...assignmentForm, plagiarismThreshold: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[10,20,30,40,50].map((value) => <SelectItem key={value} value={String(value)}>{value}%</SelectItem>)}</SelectContent></Select></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold">Due date<Input required type="date" value={assignmentForm.dueDate} onChange={(event) => setAssignmentForm({ ...assignmentForm, dueDate: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Due time<Input required type="time" value={assignmentForm.dueTime} onChange={(event) => setAssignmentForm({ ...assignmentForm, dueTime: event.target.value })} /></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="flex items-start gap-3 rounded-xl border p-3"><Checkbox checked={assignmentForm.aiEvaluationEnabled} onCheckedChange={(value) => setAssignmentForm({ ...assignmentForm, aiEvaluationEnabled: value === true })} /><span><strong className="block text-sm">AI evaluation</strong><span className="text-xs text-[#78849a]">Suggest question-level marks.</span></span></label><label className="flex items-start gap-3 rounded-xl border p-3"><Checkbox checked={assignmentForm.plagiarismCheckEnabled} onCheckedChange={(value) => setAssignmentForm({ ...assignmentForm, plagiarismCheckEnabled: value === true })} /><span><strong className="block text-sm">Plagrism check</strong><span className="text-xs text-[#78849a]">Compare other submissions.</span></span></label></div></div><DialogFooter><Button type="button" variant="outline" onClick={closeAssignmentBuilder}>Cancel</Button><Button type="submit" disabled={generating}>{generating ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{generating ? "Generating…" : "Generate questions"}</Button></DialogFooter></form> : <><DialogHeader><DialogTitle>Review questions</DialogTitle><DialogDescription>Edit, add, remove, reorder, and set maximum scores. Nothing is published until you approve it.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><label className="grid gap-1.5 text-sm font-semibold">Assignment title<Input value={assignmentDraft.title} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, title: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Instructions<Textarea value={assignmentDraft.description} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, description: event.target.value })} /></label>{assignmentDraft.questions.map((question, index) => <section key={question.id} className="rounded-xl border bg-[#f9fbff] p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-extrabold">Question {index + 1}</p><div className="flex gap-1"><Button size="icon-sm" variant="ghost" disabled={index === 0} onClick={() => moveDraftQuestion(index, -1)}><ArrowUp /></Button><Button size="icon-sm" variant="ghost" disabled={index === assignmentDraft.questions.length - 1} onClick={() => moveDraftQuestion(index, 1)}><ArrowDown /></Button><Button size="icon-sm" variant="ghost" className="text-[#c93832]" onClick={() => setAssignmentDraft({ ...assignmentDraft, questions: assignmentDraft.questions.filter((item) => item.id !== question.id) })}><Trash2 /></Button></div></div><Textarea className="mt-3 min-h-24 bg-white" value={question.prompt} onChange={(event) => updateDraftQuestion(question.id, { prompt: event.target.value })} /><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px]"><label className="grid gap-1 text-xs font-bold">Answer type<Select value={question.type} onValueChange={(value) => updateDraftQuestion(question.id, { type: value as "text" | "code" })}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="text">Written answer</SelectItem><SelectItem value="code">Code answer</SelectItem></SelectContent></Select></label><label className="grid gap-1 text-xs font-bold">Maximum score<Input className="bg-white" type="number" min="1" value={question.points} onChange={(event) => updateDraftQuestion(question.id, { points: Number(event.target.value) })} /></label></div></section>)}<Button variant="outline" onClick={addDraftQuestion}><Plus />Add question</Button><div className="flex items-center justify-between rounded-xl bg-[#eaf0ff] p-4"><span className="font-bold">Total maximum score</span><span className="text-2xl font-extrabold text-[#315fe3]">{assignmentDraft.questions.reduce((sum, question) => sum + question.points, 0)}</span></div></div><DialogFooter><Button variant="outline" onClick={() => setAssignmentDraft(null)}><Undo2 />Back</Button><Button onClick={() => void publishAssignment()}><Send />Publish assignment</Button></DialogFooter></>}</DialogContent></Dialog>
    <Dialog open={Boolean(deadlineAssignment)} onOpenChange={(open) => !open && setDeadlineAssignment(null)}><DialogContent><DialogHeader><DialogTitle>Edit deadline</DialogTitle><DialogDescription>Students will be notified after the new date and time are saved.</DialogDescription></DialogHeader><div className="grid gap-3 py-5 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold">Due date<Input type="date" value={deadlineForm.dueDate} onChange={(event) => setDeadlineForm({ ...deadlineForm, dueDate: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Due time<Input type="time" value={deadlineForm.dueTime} onChange={(event) => setDeadlineForm({ ...deadlineForm, dueTime: event.target.value })} /></label></div><DialogFooter><Button variant="outline" onClick={() => setDeadlineAssignment(null)}>Cancel</Button><Button onClick={() => void saveDeadline()}><CalendarClock />Save deadline</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(selectedAssignment)} onOpenChange={(open) => !open && setSelectedAssignment(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{selectedAssignment?.title}</DialogTitle><DialogDescription>Review AI suggestions, edit question marks, or return work for improvement.</DialogDescription></DialogHeader>{assignmentSubmissions.length ? <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Status</TableHead><TableHead>AI score</TableHead><TableHead>Plagrism</TableHead><TableHead /></TableRow></TableHeader><TableBody>{assignmentSubmissions.map((submission) => <TableRow key={submission._id}><TableCell><p className="font-bold">{submission.student?.name}</p><p className="text-xs text-[#78849a]">{submission.student?.campusId}</p></TableCell><TableCell><div className="flex flex-wrap gap-1"><Badge variant="outline" className="capitalize">{submission.status.replace("_", " ")}</Badge>{submission.improvementRequestedAt && <Badge className="bg-[#fff0d9] text-[#9a5b08] hover:bg-[#fff0d9]">Improvement requested</Badge>}</div></TableCell><TableCell>{submission.aiEvaluation?.suggestedGrade ?? "—"}</TableCell><TableCell>{submission.aiEvaluation?.plagiarismLevel ?? "—"}{submission.aiEvaluation?.plagiarismLevel !== undefined ? "%" : ""}</TableCell><TableCell className="text-right"><Button size="sm" onClick={() => openReview(submission)}>Review</Button></TableCell></TableRow>)}</TableBody></Table> : <EmptyState title="No submissions" detail="Student submissions will appear here." />}</DialogContent></Dialog>
    <Dialog open={Boolean(reviewSubmission)} onOpenChange={(open) => !open && setReviewSubmission(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>Review {reviewSubmission?.student?.name}</DialogTitle><DialogDescription>AI marks are suggestions. Edit each score before releasing the final result.</DialogDescription></DialogHeader>{reviewSubmission && selectedAssignment && <div className="grid gap-5"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-[#eefaf6] p-4"><p className="text-xs font-bold uppercase text-[#58786f]">AI suggested</p><p className="mt-1 text-3xl font-extrabold text-[#16866a]">{reviewSubmission.aiEvaluation?.suggestedGrade ?? "—"}</p></div><div className="rounded-xl border bg-[#eef3ff] p-4"><p className="text-xs font-bold uppercase text-[#566888]">Professor total</p><p className="mt-1 text-3xl font-extrabold text-[#315fe3]">{calculatedScore}/{selectedAssignment.totalPoints}</p></div><div className="rounded-xl border bg-[#fff7eb] p-4"><p className="text-xs font-bold uppercase text-[#8a632e]">Plagrism</p><p className="mt-1 text-3xl font-extrabold text-[#b66b18]">{reviewSubmission.aiEvaluation?.plagiarismLevel ?? 0}%</p></div></div>{reviewSubmission.improvementRequestedAt && <div className="rounded-xl border border-[#f2d19c] bg-[#fff8eb] p-4"><p className="font-extrabold text-[#925a12]">Student requested improvement</p><p className="mt-1 text-sm text-[#6f5a40]">{reviewSubmission.improvementRequestMessage}</p></div>}{reviewSubmission.answers.map((answer, index) => { const question = selectedAssignment.questions.find((item) => item._id === answer.question); const aiScore = reviewSubmission.aiEvaluation?.scores?.find((score) => score.questionId === answer.question); return <section key={`${answer.question}-${index}`} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-[#78849a]">Question {index + 1}</p><p className="mt-1 font-bold">{question?.prompt}</p></div><label className="grid w-36 gap-1 text-xs font-bold">Marks received<div className="flex items-center gap-2"><Input type="number" min="0" max={question?.points ?? 0} value={questionScores[answer.question] ?? "0"} onChange={(event) => setQuestionScores({ ...questionScores, [answer.question]: event.target.value })} /><span>/ {question?.points}</span></div></label></div><pre className="mt-3 whitespace-pre-wrap rounded-lg bg-[#101827] p-4 text-sm text-[#d9e4f5]">{answer.answer}</pre><p className="mt-3 text-sm text-[#5f6d82]"><strong>AI note:</strong> {aiScore?.note ?? "No AI note available."}</p></section>; })}<label className="grid gap-1.5 text-sm font-semibold">Professor feedback<Textarea className="min-h-24" value={facultyFeedback} onChange={(event) => setFacultyFeedback(event.target.value)} /></label></div>}<DialogFooter className="gap-2 sm:justify-between"><Button variant="outline" onClick={openReturn}><RotateCcw />Return for improvement</Button><Button onClick={() => void finalize()}><CheckCircle2 />Release grade</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={returnOpen} onOpenChange={setReturnOpen}><DialogContent><DialogHeader><DialogTitle>Return for improvement</DialogTitle><DialogDescription>The student can edit the answers and submit a new attempt. All fields are required.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><label className="grid gap-1.5 text-sm font-semibold"><span className="inline-flex items-center gap-1">Improvement instructions <span className="text-[#c93832]">*</span></span><Textarea required className="min-h-28" value={returnForm.facultyFeedback} onChange={(event) => setReturnForm({ ...returnForm, facultyFeedback: event.target.value })} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold"><span className="inline-flex items-center gap-1">New due date <span className="text-[#c93832]">*</span></span><Input required type="date" value={returnForm.dueDate} onChange={(event) => setReturnForm({ ...returnForm, dueDate: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold"><span className="inline-flex items-center gap-1">Due time <span className="text-[#c93832]">*</span></span><Input required type="time" value={returnForm.dueTime} onChange={(event) => setReturnForm({ ...returnForm, dueTime: event.target.value })} /></label></div></div><DialogFooter><Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button><Button disabled={returnForm.facultyFeedback.trim().length < 3 || !returnForm.dueDate || !returnForm.dueTime} onClick={() => void returnForImprovement()}><RotateCcw />Return homework</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

type StudentPortalProps = {
  section: string;
  courses: ApiCourse[];
  assignments: ApiAssignment[];
  submissions: ApiSubmission[];
  latestSubmission: Map<string, ApiSubmission>;
  token: string;
  reload: () => Promise<void>;
  previewMode: boolean;
  setSubmissions: Dispatch<SetStateAction<ApiSubmission[]>>;
};

function StudentPortal({ section, courses, assignments, submissions, latestSubmission, token, reload, previewMode, setSubmissions }: StudentPortalProps) {
  const [homework, setHomework] = useState<ApiAssignment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [requestSubmission, setRequestSubmission] = useState<ApiSubmission | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const openHomework = (assignment: ApiAssignment) => {
    const submission = latestSubmission.get(assignment._id);
    setAnswers(Object.fromEntries((submission?.answers ?? []).map((answer) => [answer.question, answer.answer])));
    setHomework(assignment);
  };
  const submit = async () => {
    if (!homework) return;
    if (homework.questions.some((question) => !answers[question._id]?.trim())) return toast.error("Answer every question before submitting");
    try {
      if (previewMode) {
        const previous = latestSubmission.get(homework._id);
        const created: ApiSubmission = {
          _id: `preview-submission-${Date.now()}`, assignment: homework, student: previewStudent,
          answers: homework.questions.map((question) => ({ question: question._id, type: question.type, answer: answers[question._id] })),
          attemptNumber: (previous?.attemptNumber ?? 0) + 1, status: "ai_reviewed", submittedAt: new Date().toISOString(),
          aiEvaluation: { suggestedGrade: Math.min(homework.totalPoints, (previous?.finalGrade ?? 80) + 6), summary: "AI review completed. The professor will verify the question-level marks.", scores: homework.questions.map((question) => ({ questionId: question._id, score: Math.round(question.points * 0.86), maxPoints: question.points, note: "Clear response; add one more concrete example." })), plagiarismLevel: 6, plagiarismEvidence: [] },
        };
        setSubmissions((current) => [created, ...current]);
      } else {
        await campusGradeApi.submitHomework(token, { assignmentId: homework._id, answers: homework.questions.map((question) => ({ question: question._id, type: question.type, answer: answers[question._id] })) });
        await reload();
      }
      setHomework(null);
      toast.success(previousAttemptLabel(latestSubmission.get(homework._id)));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Submission failed"); }
  };
  const requestImprovement = async () => {
    if (!requestSubmission || requestMessage.trim().length < 3) return toast.error("Add a short reason for your request");
    try {
      if (previewMode) setSubmissions((current) => current.map((submission) => submission._id === requestSubmission._id ? { ...submission, improvementRequestedAt: new Date().toISOString(), improvementRequestMessage: requestMessage } : submission));
      else { await campusGradeApi.requestImprovement(token, requestSubmission._id, { message: requestMessage }); await reload(); }
      setRequestSubmission(null);
      setRequestMessage("");
      toast.success("Improvement request sent to your professor");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to send request"); }
  };
  const shownAssignments = section === "Submissions" ? assignments.filter((assignment) => latestSubmission.has(assignment._id)) : assignments;
  const graded = submissions.filter((submission) => submission.status === "graded");
  const average = graded.length ? Math.round(graded.reduce((sum, submission) => sum + (submission.finalGrade ?? 0), 0) / graded.length) : 0;

  if (section === "Overview") return <div className="space-y-7"><div><p className="text-sm font-bold text-[#315fe3]">Student workspace</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">My coursework</h1><p className="mt-2 text-[#69758a]">Complete homework, review feedback, and request another attempt.</p></div><div className="grid gap-4 sm:grid-cols-3"><StatCard icon={BookOpen} label="My courses" value={courses.length} /><StatCard icon={ClipboardCheck} label="Assignments" value={assignments.length} /><StatCard icon={CheckCircle2} label="Current average" value={graded.length ? `${average}%` : "—"} /></div></div>;

  return <div className="space-y-6"><div><p className="text-sm font-bold text-[#315fe3]">Coursework</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">{section}</h1></div>{shownAssignments.length ? <div className="grid gap-4">{shownAssignments.map((assignment) => { const submission = latestSubmission.get(assignment._id); return <article key={assignment._id} className="flex flex-col justify-between gap-4 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-extrabold">{assignment.title}</h2><Badge variant="outline" className="font-mono">{assignment.assignmentCode}</Badge>{submission && <Badge className="capitalize">{submission.status.replace("_", " ")}</Badge>}{submission?.improvementRequestedAt && <Badge className="bg-[#fff0d9] text-[#9a5b08] hover:bg-[#fff0d9]">Request pending</Badge>}</div><p className="mt-2 text-sm text-[#69758a]">{courseName(assignment.course)} · Due {formatDate(assignment.dueAt)}</p>{submission?.status === "graded" && <p className="mt-2 font-bold text-[#16866a]">Grade: {submission.finalGrade}/{assignment.totalPoints}</p>}{submission?.status === "returned" && <p className="mt-2 font-bold text-[#b66b18]">Returned for improvement{submission.resubmissionDueAt ? ` · Resubmit by ${formatDate(submission.resubmissionDueAt)}` : ""}</p>}</div><Button variant={submission && submission.status !== "returned" ? "outline" : "default"} onClick={() => openHomework(assignment)}>{submission?.status === "returned" ? "Improve and resubmit" : submission ? "View submission" : "Open homework"}</Button></article>; })}</div> : <EmptyState title="Nothing here yet" detail={section === "Submissions" ? "Your submitted homework will appear here." : "Published assignments from your courses will appear here."} />}
    <Dialog open={Boolean(homework)} onOpenChange={(open) => !open && setHomework(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{homework?.title}</DialogTitle><DialogDescription>{homework && `${courseName(homework.course)} · ${homework.totalPoints} points · Due ${formatDate(homework.dueAt)}`}</DialogDescription></DialogHeader>{homework && (() => { const submission = latestSubmission.get(homework._id); const locked = Boolean(submission && submission.status !== "returned"); return <div className="grid gap-4">{submission?.status === "graded" && <div className="rounded-xl border border-[#bce7da] bg-[#eaf9f4] p-4"><p className="text-sm font-bold text-[#11765f]">Final grade: {submission.finalGrade}/{homework.totalPoints}</p><p className="mt-1 text-sm text-[#4f6f66]">{submission.facultyFeedback}</p>{submission.aiEvaluation?.plagiarismLevel !== undefined && <p className="mt-2 text-xs font-bold text-[#65766f]">Plagrism: {submission.aiEvaluation.plagiarismLevel}%</p>}{submission.improvementRequestedAt ? <p className="mt-3 text-sm font-bold text-[#925a12]">Your improvement request is waiting for the professor.</p> : <Button className="mt-3" size="sm" variant="outline" onClick={() => { setRequestSubmission(submission); setRequestMessage(""); }}><RotateCcw />Request improvement</Button>}</div>}{submission?.status === "returned" && <div className="rounded-xl border border-[#f2d19c] bg-[#fff8eb] p-4"><p className="font-extrabold text-[#925a12]">Professor returned this homework for improvement</p><p className="mt-1 text-sm text-[#6f5a40]">{submission.facultyFeedback}</p>{submission.resubmissionDueAt && <p className="mt-2 text-xs font-bold">New deadline: {formatDate(submission.resubmissionDueAt)}</p>}</div>}{homework.questions.map((question, index) => { const questionScore = submission?.aiEvaluation?.scores?.find((score) => score.questionId === question._id); return <section key={question._id} className="rounded-xl border p-4"><div className="flex justify-between gap-4"><div><p className="text-xs font-bold uppercase text-[#78849a]">Question {index + 1}</p><p className="mt-1 font-bold">{question.prompt}</p></div><Badge variant="outline">{questionScore?.score !== undefined && submission?.status === "graded" ? `${questionScore.score}/` : ""}{question.points} pts</Badge></div><Textarea readOnly={locked} className={question.type === "code" ? "mt-4 min-h-40 bg-[#101827] font-mono text-[#d9e4f5]" : "mt-4 min-h-28"} value={answers[question._id] ?? ""} onChange={(event) => setAnswers({ ...answers, [question._id]: event.target.value })} />{submission?.status === "graded" && questionScore?.note && <p className="mt-3 text-sm text-[#5f6d82]">{questionScore.note}</p>}</section>; })}<DialogFooter><Button variant="outline" onClick={() => setHomework(null)}>Close</Button>{!locked && <Button onClick={() => void submit()}><UploadCloud />{submission?.status === "returned" ? "Resubmit homework" : "Submit homework"}</Button>}</DialogFooter></div>; })()}</DialogContent></Dialog>
    <Dialog open={Boolean(requestSubmission)} onOpenChange={(open) => !open && setRequestSubmission(null)}><DialogContent><DialogHeader><DialogTitle>Request improvement</DialogTitle><DialogDescription>Tell your professor what you want to improve. The professor can return the homework for another attempt.</DialogDescription></DialogHeader><label className="grid gap-1.5 py-5 text-sm font-semibold">Message<Textarea className="min-h-28" value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} placeholder="I would like to improve my test assertions and boundary cases." /></label><DialogFooter><Button variant="outline" onClick={() => setRequestSubmission(null)}>Cancel</Button><Button onClick={() => void requestImprovement()}><Send />Send request</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function previousAttemptLabel(previous?: ApiSubmission) {
  return previous?.status === "returned" ? "Improved homework resubmitted" : "Homework submitted";
}
