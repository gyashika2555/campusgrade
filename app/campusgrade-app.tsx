"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell, BookOpen, CheckCircle2, ClipboardCheck, GraduationCap, LayoutDashboard,
  LoaderCircle, LogOut, Menu, Plus, RefreshCw, Search, ShieldCheck, Sparkles,
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

const navByRole: Record<Role, string[]> = {
  admin: ["Overview", "People", "Courses"],
  professor: ["Overview", "Assignments", "Class roster"],
  student: ["Overview", "My homework", "Submissions"],
};

const iconBySection = { Overview: LayoutDashboard, People: Users, Courses: BookOpen, Assignments: ClipboardCheck, "Class roster": Users, "My homework": BookOpen, Submissions: UploadCloud };
const idOf = (record: { _id?: string; id?: string }) => record._id ?? record.id ?? "";
const courseName = (course: ApiAssignment["course"]) => `${course.code} · ${course.title}`;
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-2xl border border-dashed bg-white p-10 text-center"><BookOpen className="mx-auto size-7 text-[#98a3b4]" /><p className="mt-3 font-bold text-[#1b2b4b]">{title}</p><p className="mt-1 text-sm text-[#718096]">{detail}</p></div>;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return <div className="rounded-2xl border bg-white p-5 shadow-[0_6px_24px_rgba(20,33,61,0.04)]"><span className="grid size-10 place-items-center rounded-xl bg-[#e9efff] text-[#2457e6]"><Icon className="size-5" /></span><p className="mt-5 text-sm font-semibold text-[#69758a]">{label}</p><p className="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-[#12213f]">{value}</p></div>;
}

export function CampusGradeApp({ session, onLogout }: { session: ApiSession; onLogout: () => void }) {
  const role = session.user.role;
  const token = session.token;
  const [section, setSection] = useState("Overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [courses, setCourses] = useState<ApiCourse[]>([]);
  const [assignments, setAssignments] = useState<ApiAssignment[]>([]);
  const [submissions, setSubmissions] = useState<ApiSubmission[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [courseData, assignmentData, notificationData] = await Promise.all([
        campusGradeApi.listCourses(token), campusGradeApi.listAssignments(token), campusGradeApi.listNotifications(token),
      ]);
      setCourses(courseData); setAssignments(assignmentData); setNotifications(notificationData);
      if (role === "admin") setUsers(await campusGradeApi.listUsers(token));
      if (role === "student") setSubmissions(await campusGradeApi.mySubmissions(token));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "CampusGrade data could not be loaded");
    } finally { setLoading(false); }
  }, [role, token]);

  useEffect(() => { void loadData(); }, [loadData]);

  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const latestSubmission = useMemo(() => {
    const map = new Map<string, ApiSubmission>();
    for (const submission of submissions) {
      const assignmentId = typeof submission.assignment === "string" ? submission.assignment : submission.assignment._id;
      if (!map.has(assignmentId)) map.set(assignmentId, submission);
    }
    return map;
  }, [submissions]);

  const markNotificationRead = async (notification: ApiNotification) => {
    if (!notification.readAt) await campusGradeApi.markNotificationRead(token, notification._id);
    setNotifications((current) => current.map((item) => item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item));
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f4f7fb]"><div className="text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-[#315fe3]" /><p className="mt-3 text-sm font-semibold text-[#647187]">Loading MongoDB data…</p></div></div>;

  return <div className="min-h-screen bg-[#f4f7fb] text-[#14213d]">
    <Toaster position="top-right" richColors />
    {mobileNav && <button className="fixed inset-0 z-30 bg-[#07142d]/45 lg:hidden" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#10214a] px-4 py-5 text-white transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center justify-between px-2"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#315fe3]"><GraduationCap className="size-6" /></span><div><p className="text-lg font-extrabold">CampusGrade</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#aabcf0]">Academic OS</p></div></div><Button size="icon-sm" variant="ghost" className="text-white lg:hidden" onClick={() => setMobileNav(false)}><X /></Button></div>
      <div className="mt-7 rounded-xl border border-white/10 bg-white/[0.055] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9eb2e8]">Signed in as</p><div className="mt-2 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#8ba7ff] text-xs font-extrabold text-[#10214a]">{initials(session.user.name)}</span><div className="min-w-0"><p className="truncate text-sm font-bold">{session.user.name}</p><p className="truncate text-xs capitalize text-[#aab8db]">{role}</p></div></div></div>
      <nav className="mt-6 space-y-1">{navByRole[role].map((label) => { const Icon = iconBySection[label as keyof typeof iconBySection]; return <button key={label} onClick={() => { setSection(label); setMobileNav(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${section === label ? "bg-[#315fe3] text-white" : "text-[#b8c5e6] hover:bg-white/[0.07] hover:text-white"}`}><Icon className="size-[1.1rem]" />{label}</button>; })}</nav>
      <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.055] p-3 text-xs leading-5 text-[#b8c5e6]">All academic records shown in this portal are loaded from MongoDB.</div>
    </aside>
    <div className="lg:pl-[260px]">
      <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b bg-white/95 px-4 backdrop-blur sm:px-7 lg:px-9"><div className="flex items-center gap-3"><Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setMobileNav(true)}><Menu /></Button><div><p className="text-lg font-extrabold">{section}</p><p className="hidden text-xs text-[#78849a] sm:block">{session.user.department ?? "CampusGrade"}</p></div></div><div className="flex items-center gap-2"><Button size="icon" variant="outline" className="relative rounded-full" onClick={() => setNotificationOpen(true)}><Bell />{unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[#ea5a63] px-1 text-[10px] font-bold text-white">{unreadCount}</span>}</Button><Button size="sm" variant="ghost" onClick={onLogout}><LogOut />Sign out</Button></div></header>
      <main className="mx-auto max-w-[1450px] px-4 py-7 sm:px-7 lg:px-9 lg:py-9">
        {error && <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-[#f2c2bf] bg-[#fff2f1] p-4 text-sm font-semibold text-[#a8322d]"><span>{error}</span><Button size="sm" variant="outline" onClick={() => void loadData()}><RefreshCw />Retry</Button></div>}
        {role === "admin" && <AdminPortal section={section} users={users} courses={courses} token={token} reload={loadData} />}
        {role === "professor" && <ProfessorPortal section={section} courses={courses} assignments={assignments} notifications={notifications} token={token} reload={loadData} />}
        {role === "student" && <StudentPortal section={section} courses={courses} assignments={assignments} submissions={submissions} latestSubmission={latestSubmission} token={token} reload={loadData} />}
      </main>
    </div>
    <Dialog open={notificationOpen} onOpenChange={setNotificationOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Notifications</DialogTitle><DialogDescription>Updates saved for your account.</DialogDescription></DialogHeader><div className="grid gap-2">{notifications.length ? notifications.map((item) => <button key={item._id} className={`rounded-xl border p-4 text-left ${item.readAt ? "bg-white" : "border-[#cbd7fa] bg-[#f3f6ff]"}`} onClick={() => void markNotificationRead(item)}><div className="flex justify-between gap-3"><strong className="text-sm">{item.title}</strong>{!item.readAt && <Badge>New</Badge>}</div><p className="mt-1 text-sm text-[#647187]">{item.message}</p><p className="mt-2 text-xs font-semibold text-[#8290a6]">{formatDate(item.createdAt)}</p></button>) : <EmptyState title="No notifications" detail="Account updates will appear here." />}</div></DialogContent></Dialog>
  </div>;
}

function AdminPortal({ section, users, courses, token, reload }: { section: string; users: ApiUser[]; courses: ApiCourse[]; token: string; reload: () => Promise<void> }) {
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
    if (!confirm(`Deactivate ${user.name}?`)) return;
    try { await campusGradeApi.removeUser(token, idOf(user)); await reload(); toast.success("User deactivated"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to deactivate user"); }
  };
  const saveCourse = async (event: FormEvent) => {
    event.preventDefault();
    try { await campusGradeApi.createCourse(token, courseForm); setCourseOpen(false); setCourseForm({ code: "", title: "", term: "", professorId: "" }); await reload(); toast.success("Course created in MongoDB"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create course"); }
  };

  if (section === "Overview") return <div className="space-y-7"><div><p className="text-sm font-bold text-[#315fe3]">Administration</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">Campus operations</h1><p className="mt-2 text-[#69758a]">Live totals calculated from MongoDB records.</p></div><div className="grid gap-4 sm:grid-cols-3"><StatCard icon={Users} label="Active users" value={users.filter((user) => user.active !== false).length} /><StatCard icon={GraduationCap} label="Professors" value={professors.length} /><StatCard icon={BookOpen} label="Courses" value={courses.length} /></div></div>;

  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-[#315fe3]">{section === "People" ? "Directory" : "Academic catalog"}</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">{section === "People" ? "Students and faculty" : "Courses"}</h1></div>{section === "People" ? <Button onClick={() => openUser()}><UserRoundPlus />Add user</Button> : <Button onClick={() => setCourseOpen(true)} disabled={!professors.length}><Plus />Add course</Button>}</div>
    {section === "People" ? <section className="rounded-2xl border bg-white p-5"><div className="relative mb-4 max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a96a8]" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users" /></div>{visibleUsers.length ? <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>ID</TableHead><TableHead>Role</TableHead><TableHead>Department</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{visibleUsers.map((user) => <TableRow key={idOf(user)}><TableCell><p className="font-bold">{user.name}</p><p className="text-xs text-[#78849a]">{user.email}</p></TableCell><TableCell className="font-mono">{user.campusId}</TableCell><TableCell className="capitalize">{user.role}</TableCell><TableCell>{user.department}</TableCell><TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => openUser(user)}>Edit</Button><Button size="icon-sm" variant="ghost" className="text-[#c93832]" onClick={() => void removeUser(user)}><Trash2 /></Button></TableCell></TableRow>)}</TableBody></Table> : <EmptyState title="No users yet" detail="Create the first professor or student." />}</section> : <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{courses.length ? courses.map((course) => <article key={course._id} className="rounded-2xl border bg-white p-5"><Badge variant="outline">{course.code}</Badge><h2 className="mt-4 text-lg font-extrabold">{course.title}</h2><p className="mt-1 text-sm text-[#69758a]">{course.term}</p><div className="mt-5 border-t pt-4 text-sm"><p className="font-semibold">Professor: {course.professor?.name}</p><p className="mt-1 text-[#78849a]">{course.students?.length ?? 0} students</p></div></article>) : <EmptyState title="No courses yet" detail={professors.length ? "Create the first course." : "Create a professor before creating a course."} />}</section>}
    <Dialog open={userOpen} onOpenChange={setUserOpen}><DialogContent><form onSubmit={saveUser}><DialogHeader><DialogTitle>{editing ? "Edit user" : "Create campus user"}</DialogTitle><DialogDescription>Account information will be stored in MongoDB.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><label className="grid gap-1.5 text-sm font-semibold">Full name<Input required value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Email<Input required type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Role<Select value={userForm.role} onValueChange={(value) => setUserForm({ ...userForm, role: value as "student" | "professor" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="professor">Professor</SelectItem></SelectContent></Select></label><label className="grid gap-1.5 text-sm font-semibold">Department<Input required value={userForm.department} onChange={(event) => setUserForm({ ...userForm, department: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">{editing ? "New password (optional)" : "Password (optional)"}<Input type="password" minLength={8} value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /><span className="text-xs font-normal text-[#78849a]">Leave blank to generate a temporary password.</span></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setUserOpen(false)}>Cancel</Button><Button type="submit">Save user</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={courseOpen} onOpenChange={setCourseOpen}><DialogContent><form onSubmit={saveCourse}><DialogHeader><DialogTitle>Create course</DialogTitle><DialogDescription>The course and professor relationship will be stored in MongoDB.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><label className="grid gap-1.5 text-sm font-semibold">Course code<Input required value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value.toUpperCase() })} placeholder="CS412" /></label><label className="grid gap-1.5 text-sm font-semibold">Course title<Input required value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Term<Input required value={courseForm.term} onChange={(event) => setCourseForm({ ...courseForm, term: event.target.value })} placeholder="Fall 2026" /></label><label className="grid gap-1.5 text-sm font-semibold">Professor<Select required value={courseForm.professorId} onValueChange={(value) => setCourseForm({ ...courseForm, professorId: value })}><SelectTrigger><SelectValue placeholder="Select professor" /></SelectTrigger><SelectContent>{professors.map((professor) => <SelectItem key={idOf(professor)} value={idOf(professor)}>{professor.name}</SelectItem>)}</SelectContent></Select></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setCourseOpen(false)}>Cancel</Button><Button type="submit">Create course</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={Boolean(credential)} onOpenChange={(open) => !open && setCredential(null)}><DialogContent><DialogHeader><DialogTitle>Temporary login created</DialogTitle><DialogDescription>Share this once with the user. CampusGrade does not store readable passwords.</DialogDescription></DialogHeader>{credential && <div className="rounded-xl border bg-[#f8faff] p-4"><p className="text-xs font-bold uppercase text-[#78849a]">Email</p><p className="mt-1 font-mono">{credential.email}</p><p className="mt-4 text-xs font-bold uppercase text-[#78849a]">Temporary password</p><p className="mt-1 break-all font-mono font-bold">{credential.password}</p></div>}</DialogContent></Dialog>
  </div>;
}

function ProfessorPortal({ section, courses, assignments, notifications, token, reload }: { section: string; courses: ApiCourse[]; assignments: ApiAssignment[]; notifications: ApiNotification[]; token: string; reload: () => Promise<void> }) {
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

  useEffect(() => { if (!selectedCourseId && courses[0]) setSelectedCourseId(courses[0]._id); }, [courses, selectedCourseId]);

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
    try { await campusGradeApi.finalizeSubmission(token, reviewSubmission._id, { finalGrade: Number(gradeForm.finalGrade), facultyFeedback: gradeForm.facultyFeedback }); setReviewSubmission(null); if (selectedAssignment) await openSubmissions(selectedAssignment); await reload(); toast.success("Grade released"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to release grade"); }
  };

  if (section === "Overview") return <div className="space-y-7"><div><p className="text-sm font-bold text-[#315fe3]">Faculty workspace</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">Coursework overview</h1><p className="mt-2 text-[#69758a]">Live totals from your courses and assignments.</p></div><div className="grid gap-4 sm:grid-cols-3"><StatCard icon={BookOpen} label="My courses" value={courses.length} /><StatCard icon={ClipboardCheck} label="Assignments" value={assignments.length} /><StatCard icon={Bell} label="Unread notifications" value={notifications.filter((item) => !item.readAt).length} /></div></div>;

  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-[#315fe3]">{section === "Assignments" ? "Coursework" : "Enrollment"}</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">{section}</h1></div>{section === "Assignments" ? <Button disabled={!courses.length} onClick={() => { setAssignmentForm((current) => ({ ...current, courseId: courses[0]?._id ?? "" })); setAssignmentOpen(true); }}><Sparkles />Generate assignment</Button> : null}</div>
    {section === "Assignments" ? <div className="grid gap-4">{assignments.length ? assignments.map((assignment) => <article key={assignment._id} className="flex flex-col justify-between gap-4 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-extrabold">{assignment.title}</h2><Badge variant="outline" className="font-mono">{assignment.assignmentCode}</Badge><Badge className="capitalize">{assignment.status}</Badge></div><p className="mt-2 text-sm text-[#69758a]">{courseName(assignment.course)} · Due {formatDate(assignment.dueAt)}</p><p className="mt-2 text-xs font-semibold text-[#78849a]">{assignment.totalPoints} points · Plagiarism {assignment.plagiarismCheckEnabled ? `${assignment.plagiarismThreshold}% limit` : "off"}</p></div><Button onClick={() => void openSubmissions(assignment)}>View submissions</Button></article>) : <EmptyState title="No assignments" detail={courses.length ? "Generate the first assignment." : "An administrator must assign you a course first."} />}</div> : <div className="space-y-5">{courses.length ? <><Select value={selectedCourse?._id} onValueChange={setSelectedCourseId}><SelectTrigger className="max-w-md bg-white"><SelectValue /></SelectTrigger><SelectContent>{courses.map((course) => <SelectItem key={course._id} value={course._id}>{course.code} · {course.title}</SelectItem>)}</SelectContent></Select><section className="rounded-2xl border bg-white p-5"><div className="flex gap-2"><Input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Student ID or email" onKeyDown={(event) => event.key === "Enter" && void searchStudents()} /><Button onClick={() => void searchStudents()}><Search />Search</Button></div>{studentResults.length > 0 && <div className="mt-3 rounded-xl border">{studentResults.map((student) => <button key={idOf(student)} className="flex w-full items-center justify-between border-b p-3 text-left last:border-0" onClick={() => void addStudent(student)}><span><strong className="block">{student.name}</strong><span className="text-xs text-[#78849a]">{student.campusId} · {student.email}</span></span><Plus /></button>)}</div>}<div className="mt-5">{selectedCourse?.students?.length ? <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>ID</TableHead><TableHead>Department</TableHead><TableHead /></TableRow></TableHeader><TableBody>{selectedCourse.students.map((student) => <TableRow key={idOf(student)}><TableCell><p className="font-bold">{student.name}</p><p className="text-xs text-[#78849a]">{student.email}</p></TableCell><TableCell className="font-mono">{student.campusId}</TableCell><TableCell>{student.department}</TableCell><TableCell className="text-right"><Button size="icon-sm" variant="ghost" className="text-[#c93832]" onClick={() => void removeStudent(student)}><Trash2 /></Button></TableCell></TableRow>)}</TableBody></Table> : <EmptyState title="No students enrolled" detail="Search for an existing student account to add it." />}</div></section></> : <EmptyState title="No courses assigned" detail="Ask an administrator to create a course for your account." />}</div>}
    <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><form onSubmit={createAssignment}><DialogHeader><DialogTitle>Generate assignment</DialogTitle><DialogDescription>The AI draft will be reviewed by this form and stored in MongoDB.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><label className="grid gap-1.5 text-sm font-semibold">Course<Select required value={assignmentForm.courseId} onValueChange={(value) => setAssignmentForm({ ...assignmentForm, courseId: value })}><SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger><SelectContent>{courses.map((course) => <SelectItem key={course._id} value={course._id}>{course.code} · {course.title}</SelectItem>)}</SelectContent></Select></label><label className="grid gap-1.5 text-sm font-semibold">Topic<Input required value={assignmentForm.topic} onChange={(event) => setAssignmentForm({ ...assignmentForm, topic: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Learning outcome<Input required value={assignmentForm.outcome} onChange={(event) => setAssignmentForm({ ...assignmentForm, outcome: event.target.value })} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold">Due date<Input required type="date" value={assignmentForm.dueDate} onChange={(event) => setAssignmentForm({ ...assignmentForm, dueDate: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Due time<Input required type="time" value={assignmentForm.dueTime} onChange={(event) => setAssignmentForm({ ...assignmentForm, dueTime: event.target.value })} /></label></div><label className="flex items-start gap-3 rounded-xl border p-3"><Checkbox checked={assignmentForm.aiEvaluationEnabled} onCheckedChange={(value) => setAssignmentForm({ ...assignmentForm, aiEvaluationEnabled: value === true })} /><span><strong className="block text-sm">AI evaluation</strong><span className="text-xs text-[#78849a]">Suggest scores for professor review.</span></span></label><label className="flex items-start gap-3 rounded-xl border p-3"><Checkbox checked={assignmentForm.plagiarismCheckEnabled} onCheckedChange={(value) => setAssignmentForm({ ...assignmentForm, plagiarismCheckEnabled: value === true })} /><span><strong className="block text-sm">Plagiarism check</strong><span className="text-xs text-[#78849a]">Compare against other MongoDB submissions.</span></span></label>{assignmentForm.plagiarismCheckEnabled && <label className="grid gap-1.5 text-sm font-semibold">Allowed plagiarism<Select value={assignmentForm.plagiarismThreshold} onValueChange={(value) => setAssignmentForm({ ...assignmentForm, plagiarismThreshold: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[10,20,30,40,50].map((value) => <SelectItem key={value} value={String(value)}>{value}%</SelectItem>)}</SelectContent></Select></label>}</div><DialogFooter><Button type="button" variant="outline" onClick={() => setAssignmentOpen(false)}>Cancel</Button><Button type="submit"><Sparkles />Generate and publish</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={Boolean(selectedAssignment)} onOpenChange={(open) => !open && setSelectedAssignment(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{selectedAssignment?.title}</DialogTitle><DialogDescription>Submissions and AI results loaded from MongoDB.</DialogDescription></DialogHeader>{assignmentSubmissions.length ? <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Submitted</TableHead><TableHead>AI score</TableHead><TableHead>Plagiarism</TableHead><TableHead /></TableRow></TableHeader><TableBody>{assignmentSubmissions.map((submission) => <TableRow key={submission._id}><TableCell><p className="font-bold">{submission.student?.name}</p><p className="text-xs text-[#78849a]">{submission.student?.campusId}</p></TableCell><TableCell>{formatDate(submission.submittedAt)}</TableCell><TableCell>{submission.aiEvaluation?.suggestedGrade ?? "—"}</TableCell><TableCell>{submission.aiEvaluation?.plagiarismLevel ?? "—"}{submission.aiEvaluation?.plagiarismLevel !== undefined ? "%" : ""}</TableCell><TableCell className="text-right"><Button size="sm" onClick={() => openReview(submission)}>Review</Button></TableCell></TableRow>)}</TableBody></Table> : <EmptyState title="No submissions" detail="Student submissions will appear here." />}</DialogContent></Dialog>
    <Dialog open={Boolean(reviewSubmission)} onOpenChange={(open) => !open && setReviewSubmission(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>Review {reviewSubmission?.student?.name}</DialogTitle><DialogDescription>AI results are suggestions. The professor releases the final grade.</DialogDescription></DialogHeader>{reviewSubmission && selectedAssignment && <div className="grid gap-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border bg-[#eefaf6] p-4"><p className="text-xs font-bold uppercase text-[#58786f]">AI suggested grade</p><p className="mt-1 text-3xl font-extrabold text-[#16866a]">{reviewSubmission.aiEvaluation?.suggestedGrade ?? "—"}</p></div><div className="rounded-xl border bg-[#fff7eb] p-4"><p className="text-xs font-bold uppercase text-[#8a632e]">Plagiarism</p><p className="mt-1 text-3xl font-extrabold text-[#b66b18]">{reviewSubmission.aiEvaluation?.plagiarismLevel ?? 0}%</p></div></div>{reviewSubmission.answers.map((answer, index) => <section key={`${answer.question}-${index}`} className="rounded-xl border p-4"><p className="text-xs font-bold uppercase text-[#78849a]">Question {index + 1}</p><p className="mt-1 font-bold">{selectedAssignment.questions.find((question) => question._id === answer.question)?.prompt}</p><pre className="mt-3 whitespace-pre-wrap rounded-lg bg-[#101827] p-4 text-sm text-[#d9e4f5]">{answer.answer}</pre><p className="mt-3 text-sm text-[#5f6d82]">{reviewSubmission.aiEvaluation?.scores?.find((score) => score.questionId === answer.question)?.note}</p></section>)}{(reviewSubmission.aiEvaluation?.plagiarismEvidence?.length ?? 0) > 0 && <section><h3 className="font-extrabold">Plagiarism evidence</h3><div className="mt-3 grid gap-3">{reviewSubmission.aiEvaluation?.plagiarismEvidence?.map((evidence, index) => <div key={index} className="rounded-xl border border-[#f0cda6] bg-[#fff9f0] p-4"><div className="flex justify-between gap-4"><strong>{evidence.source}</strong><Badge variant="outline">{evidence.similarity}% match</Badge></div><p className="mt-2 text-sm text-[#6f5a40]">{evidence.explanation}</p></div>)}</div></section>}<div className="grid gap-4 sm:grid-cols-[160px_1fr]"><label className="grid gap-1.5 text-sm font-semibold">Final grade<Input required type="number" min="0" max={selectedAssignment.totalPoints} value={gradeForm.finalGrade} onChange={(event) => setGradeForm({ ...gradeForm, finalGrade: event.target.value })} /></label><label className="grid gap-1.5 text-sm font-semibold">Faculty feedback<Textarea value={gradeForm.facultyFeedback} onChange={(event) => setGradeForm({ ...gradeForm, facultyFeedback: event.target.value })} /></label></div></div>}<DialogFooter><Button onClick={() => void finalize()}><CheckCircle2 />Release grade</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function StudentPortal({ section, courses, assignments, submissions, latestSubmission, token, reload }: { section: string; courses: ApiCourse[]; assignments: ApiAssignment[]; submissions: ApiSubmission[]; latestSubmission: Map<string, ApiSubmission>; token: string; reload: () => Promise<void> }) {
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
