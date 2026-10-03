const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

export type ApiUser = { _id?: string; id?: string; campusId?: string; name: string; email: string; role: "admin" | "professor" | "student"; department?: string; courses?: string[]; active?: boolean; temporaryPassword?: string };
export type ApiSession = { token: string; user: ApiUser };
export type ApiCourse = { _id: string; code: string; title: string; term: string; professor: ApiUser; students: ApiUser[]; createdAt: string };
export type ApiQuestion = { _id: string; prompt: string; type: "text" | "code"; language?: string; points: number };
export type ApiAssignment = { _id: string; assignmentCode: string; course: ApiCourse | Pick<ApiCourse, "_id" | "code" | "title" | "term">; title: string; description: string; learningOutcomes: string[]; difficulty: "beginner" | "intermediate" | "advanced"; rubric: Array<{ criterion: string; description?: string; maxPoints: number }>; questions: ApiQuestion[]; totalPoints: number; dueAt: string; status: "draft" | "published" | "closed"; aiGenerated: boolean; aiEvaluationEnabled: boolean; plagiarismCheckEnabled: boolean; plagiarismThreshold: 10 | 20 | 30 | 40 | 50 };
export type ApiSubmission = { _id: string; assignment: ApiAssignment | string; student?: ApiUser; answers: Array<{ question: string; type: "text" | "code"; answer: string }>; attemptNumber: number; note?: string; status: "submitted" | "ai_reviewed" | "graded" | "returned"; aiEvaluation?: { suggestedGrade?: number; summary?: string; scores?: Array<{ questionId?: string; criterion?: string; score?: number; maxPoints?: number; note?: string }>; plagiarismLevel?: number; plagiarismEvidence?: Array<{ source?: string; location?: string; similarity?: number; studentExcerpt?: string; matchedExcerpt?: string; explanation?: string }> }; finalGrade?: number; facultyFeedback?: string; scoreReleasedAt?: string; submittedAt: string };
export type ApiNotification = { _id: string; type: "assignment_published" | "submission_received" | "score_released" | "system"; title: string; message: string; assignment?: ApiAssignment; submission?: ApiSubmission; readAt?: string; createdAt: string };

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" })) as { message?: string };
    throw new Error(error.message ?? `Request failed with ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const campusGradeApi = {
  setupStatus: () => request<{ needsSetup: boolean }>("/auth/setup-status"),
  setupAdmin: (input: { name: string; email: string; password: string; department: string }) => request<ApiSession>("/auth/setup", { method: "POST", body: JSON.stringify(input) }),
  login: (email: string, password: string) => request<ApiSession>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: (token: string) => request<ApiUser>("/auth/me", {}, token),
  listUsers: (token: string) => request<ApiUser[]>("/users", {}, token),
  addUser: (token: string, user: unknown) => request<ApiUser>("/users", { method: "POST", body: JSON.stringify(user) }, token),
  updateUser: (token: string, id: string, user: unknown) => request<ApiUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(user) }, token),
  removeUser: (token: string, id: string) => request(`/users/${id}`, { method: "DELETE" }, token),
  searchStudents: (token: string, query: string) => request<ApiUser[]>(`/users/student-directory?query=${encodeURIComponent(query)}`, {}, token),
  listCourses: (token: string) => request<ApiCourse[]>("/courses", {}, token),
  createCourse: (token: string, input: unknown) => request<ApiCourse>("/courses", { method: "POST", body: JSON.stringify(input) }, token),
  updateCourse: (token: string, id: string, input: unknown) => request<ApiCourse>(`/courses/${id}`, { method: "PATCH", body: JSON.stringify(input) }, token),
  listCourseStudents: (token: string, courseId: string) => request<ApiUser[]>(`/courses/${courseId}/students`, {}, token),
  addStudentToCourse: (token: string, courseId: string, studentId: string) => request(`/courses/${courseId}/students`, { method: "POST", body: JSON.stringify({ studentId }) }, token),
  removeStudentFromCourse: (token: string, courseId: string, studentId: string) => request(`/courses/${courseId}/students/${studentId}`, { method: "DELETE" }, token),
  listAssignments: (token: string) => request<ApiAssignment[]>("/assignments", {}, token),
  generateAssignment: (token: string, input: unknown) => request("/assignments/generate", { method: "POST", body: JSON.stringify(input) }, token),
  createAssignment: (token: string, input: unknown) => request<ApiAssignment>("/assignments", { method: "POST", body: JSON.stringify(input) }, token),
  updateAssignment: (token: string, id: string, input: unknown) => request<ApiAssignment>(`/assignments/${id}`, { method: "PATCH", body: JSON.stringify(input) }, token),
  submitHomework: (token: string, input: unknown) => request<ApiSubmission>("/submissions", { method: "POST", body: JSON.stringify(input) }, token),
  mySubmissions: (token: string) => request<ApiSubmission[]>("/submissions/mine", {}, token),
  assignmentSubmissions: (token: string, assignmentId: string) => request<ApiSubmission[]>(`/submissions/assignment/${assignmentId}`, {}, token),
  evaluateSubmission: (token: string, id: string) => request<ApiSubmission>(`/submissions/${id}/ai-evaluate`, { method: "POST" }, token),
  finalizeSubmission: (token: string, id: string, input: { finalGrade: number; facultyFeedback: string }) => request<ApiSubmission>(`/submissions/${id}/finalize`, { method: "PATCH", body: JSON.stringify(input) }, token),
  finalizeAllSubmissions: (token: string, assignmentId: string) => request<{ released: number }>(`/submissions/assignment/${assignmentId}/finalize-all`, { method: "PATCH" }, token),
  listNotifications: (token: string) => request<ApiNotification[]>("/notifications", {}, token),
  markNotificationRead: (token: string, id: string) => request(`/notifications/${id}/read`, { method: "PATCH" }, token),
  markAllNotificationsRead: (token: string) => request("/notifications/read-all", { method: "PATCH" }, token),
};
