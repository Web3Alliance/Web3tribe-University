import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/shell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?redirectTo=/student/dashboard");

  // Every role can access the student learning area (instructors, admins, etc. may
  // also want to take courses), but we only fetch a W3TR balance if a wallet exists.
  const supabase = await createClient();
  const { data: wallet } = await supabase
    .from("w3tr_wallets")
    .select("balance")
    .eq("profile_id", profile!.id)
    .single();

  return (
    <DashboardShell role={profile!.role} w3trBalance={wallet ? Number(wallet.balance) : undefined}>
      {children}
    </DashboardShell>
  );
}
