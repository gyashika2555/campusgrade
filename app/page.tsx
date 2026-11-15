"use client";

import type { ApiSession } from "@/lib/campusgrade-api";
import { CampusGradeApp } from "./campusgrade-app";

const previewSession: ApiSession = {
  token: "preview-only",
  user: {
    _id: "preview-admin",
    campusId: "A00001",
    name: "Campus Administrator",
    email: "admin@campusgrade.edu",
    role: "admin",
    department: "Academic Administration",
    active: true,
  },
};

export default function Home() {
  return <CampusGradeApp session={previewSession} onLogout={() => undefined} previewMode />;
}
