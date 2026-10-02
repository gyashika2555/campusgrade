const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

export type ApiSession = { token: string; user: { id: string; name: string; email: string; role: "admin" | "professor" | "student" } };

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
  login: (email: string, password: string) => request<ApiSession>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  listUsers: (token: string) => request("/users", {}, token),
  addUser: (token: string, user: unknown) => request("/users", { method: "POST", body: JSON.stringify(user) }, token),
  updateUser: (token: string, id: string, user: unknown) => request(`/users/${id}`, { method: "PATCH", body: JSON.stringify(user) }, token),
  removeUser: (token: string, id: string) => request(`/users/${id}`, { method: "DELETE" }, token),
  searchStudents: (token: string, query: string) => request(`/users/student-directory?query=${encodeURIComponent(query)}`, {}, token),
  addStudentToCourse: (token: string, courseId: string, studentId: string) => request(`/courses/${courseId}/students`, { method: "POST", body: JSON.stringify({ studentId }) }, token),
  listAssignments: (token: string) => request("/assignments", {}, token),
  generateAssignment: (token: string, input: unknown) => request("/assignments/generate", { method: "POST", body: JSON.stringify(input) }, token),
  createAssignment: (token: string, input: unknown) => request("/assignments", { method: "POST", body: JSON.stringify(input) }, token),
  submitHomework: (token: string, input: unknown) => request("/submissions", { method: "POST", body: JSON.stringify(input) }, token),
  mySubmissions: (token: string) => request("/submissions/mine", {}, token),
  listNotifications: (token: string) => request("/notifications", {}, token),
  markNotificationRead: (token: string, id: string) => request(`/notifications/${id}/read`, { method: "PATCH" }, token),
  markAllNotificationsRead: (token: string) => request("/notifications/read-all", { method: "PATCH" }, token),
};
