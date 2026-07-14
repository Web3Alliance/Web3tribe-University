import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/rbac";
import { DashboardShell } from "@/components/dashboard/shell";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?redirectTo=/super-admin/dashboard");
  if (profile.role !== "super_admin") {
    redirect("/admin/dashboard");
  }

  return <DashboardShell role="super_admin">{children}</DashboardShell>;
}
