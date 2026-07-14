import Link from "next/link";
import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ClipboardList, Building2 } from "lucide-react";

export const metadata = { title: "Organization Dashboard" };

export default async function OrganizationDashboardPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: org } = await supabase.from("organizations").select("*").eq("owner_profile_id", profile!.id).maybeSingle();

  if (!org) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Set up your organization</h1>
        <p className="text-muted-foreground">
          Create your organization profile to start assigning courses and tracking staff progress.
        </p>
        <Button asChild>
          <Link href="/organization/programs">Get started</Link>
        </Button>
      </div>
    );
  }

  const [{ count: memberCount }, { count: programCount }] = await Promise.all([
    supabase.from("organization_members").select("*", { count: "exact", head: true }).eq("organization_id", org.id),
    supabase.from("organization_programs").select("*", { count: "exact", head: true }).eq("organization_id", org.id),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{org.name}</h1>
        <p className="text-muted-foreground">Organization dashboard</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{memberCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Learners</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-accent/20 p-3">
              <ClipboardList className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{programCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Programs</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
