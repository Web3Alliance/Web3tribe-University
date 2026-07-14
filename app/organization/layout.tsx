import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/rbac";
import { DashboardShell } from "@/components/dashboard/shell";

export default async function OrganizationLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?redirectTo=/organization/dashboard");
  if (!["organization", "admin", "super_admin"].includes(profile.role)) {
    redirect("/student/dashboard");
  }

  return <DashboardShell role="organization">{children}</DashboardShell>;
}
