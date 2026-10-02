import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusGrade · Academic Assessment Platform",
  description:
    "AI-powered assignment creation, GitHub submission, intelligent evaluation, and actionable academic feedback.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
