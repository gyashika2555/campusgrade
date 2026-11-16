"use client";

import { useState } from "react";
import type { ApiSession } from "@/lib/campusgrade-api";
import { CampusGradeApp } from "./campusgrade-app";

type Role = "admin" | "professor" | "student";

const demoSessions: Record<Role, ApiSession> = {
  admin: { token: "preview-only", user: { _id: "preview-admin", campusId: "A00001", name: "Campus Administrator", email: "admin@campusgrade.edu", role: "admin", department: "Academic Administration", active: true } },
  professor: { token: "preview-only", user: { _id: "preview-professor", campusId: "P10421", name: "Dr. Maya Chen", email: "maya.chen@campusgrade.edu", role: "professor", department: "Computer Science", active: true } },
  student: { token: "preview-only", user: { _id: "preview-student", campusId: "S20845", name: "Jordan Lee", email: "jordan.lee@campusgrade.edu", role: "student", department: "Computer Science", active: true } },
};

export default function Home() {
  const [role, setRole] = useState<Role>("admin");
  return <CampusGradeApp session={demoSessions[role]} onLogout={() => undefined} previewMode onPreviewRoleChange={setRole} />;
}
