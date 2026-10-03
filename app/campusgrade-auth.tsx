"use client";

import { FormEvent, useEffect, useState } from "react";
import { GraduationCap, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { campusGradeApi, type ApiSession } from "@/lib/campusgrade-api";
import { CampusGradeApp } from "./campusgrade-app";

const SESSION_KEY = "campusgrade-session";

export function CampusGradeAuth() {
  const [session, setSession] = useState<ApiSession | null>(null);
  const [screen, setScreen] = useState<"loading" | "setup" | "login">("loading");
  const [form, setForm] = useState({ name: "", email: "", password: "", department: "Academic Administration" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    async function initialize() {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as ApiSession;
          const user = await campusGradeApi.me(parsed.token);
          if (active) setSession({ token: parsed.token, user });
          return;
        } catch {
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
      try {
        const status = await campusGradeApi.setupStatus();
        if (active) setScreen(status.needsSetup ? "setup" : "login");
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "The CampusGrade API is unavailable");
          setScreen("login");
        }
      }
    }
    void initialize();
    return () => { active = false; };
  }, []);

  const saveSession = (nextSession: ApiSession) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const nextSession = screen === "setup"
        ? await campusGradeApi.setupAdmin(form)
        : await campusGradeApi.login(form.email, form.password);
      saveSession(nextSession);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to continue");
    } finally {
      setSubmitting(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setForm({ name: "", email: "", password: "", department: "Academic Administration" });
    setScreen("login");
  };

  if (session) return <CampusGradeApp session={session} onLogout={logout} />;

  return <main className="grid min-h-screen place-items-center bg-[#f4f7fb] px-4 py-10 text-[#14213d]">
    <section className="w-full max-w-md overflow-hidden rounded-3xl border bg-white shadow-[0_22px_60px_rgba(16,33,74,0.13)]">
      <div className="bg-[#10214a] px-7 py-7 text-white">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[#315fe3]"><GraduationCap className="size-6" /></span>
          <div><h1 className="text-xl font-extrabold tracking-[-0.03em]">CampusGrade</h1><p className="text-xs font-semibold text-[#aabcf0]">Academic workspace</p></div>
        </div>
      </div>
      <div className="p-7">
        {screen === "loading" ? <div className="grid min-h-56 place-items-center text-center"><div><LoaderCircle className="mx-auto size-7 animate-spin text-[#315fe3]" /><p className="mt-3 text-sm font-semibold text-[#647187]">Connecting to CampusGrade…</p></div></div> : <>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-[#e9efff] text-[#2457e6]">{screen === "setup" ? <ShieldCheck className="size-5" /> : <LockKeyhole className="size-5" />}</span>
            <div><h2 className="text-xl font-extrabold tracking-[-0.02em]">{screen === "setup" ? "Create the first administrator" : "Sign in"}</h2><p className="mt-1 text-sm leading-5 text-[#69758a]">{screen === "setup" ? "Your database is empty. This one-time setup creates the account that will manage professors and students." : "Use your CampusGrade email and password."}</p></div>
          </div>
          <form className="mt-6 grid gap-4" onSubmit={submit}>
            {screen === "setup" && <><label className="grid gap-1.5 text-sm font-semibold">Full name<Input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoFocus /></label><label className="grid gap-1.5 text-sm font-semibold">Department<Input required minLength={2} value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label></>}
            <label className="grid gap-1.5 text-sm font-semibold">Email<Input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoFocus={screen === "login"} /></label>
            <label className="grid gap-1.5 text-sm font-semibold">Password<Input required type="password" minLength={screen === "setup" ? 12 : 8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><span className="text-xs font-normal text-[#7b8799]">{screen === "setup" ? "Use at least 12 characters." : "Passwords are checked securely by the backend."}</span></label>
            {error && <div role="alert" className="rounded-xl border border-[#f2c2bf] bg-[#fff2f1] p-3 text-sm font-semibold text-[#a8322d]">{error}</div>}
            <Button type="submit" className="mt-1 h-11" disabled={submitting}>{submitting && <LoaderCircle className="animate-spin" />}{screen === "setup" ? "Create administrator" : "Sign in"}</Button>
          </form>
        </>}
      </div>
    </section>
  </main>;
}
