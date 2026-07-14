import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/rbac";
import { DashboardShell } from "@/components/dashboard/shell";

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?redirectTo=/instructor/dashboard");
  if (!["instructor", "admin", "super_admin"].includes(profile.role)) {
    redirect("/student/dashboard");
  }

  return <DashboardShell role={profile.role === "instructor" ? "instructor" : profile.role}>{children}</DashboardShell>;
}
