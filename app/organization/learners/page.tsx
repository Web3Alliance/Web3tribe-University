import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inviteLearnerAction } from "@/lib/actions/organization";

export const metadata = { title: "Learners" };

export default async function OrganizationLearnersPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: org } = await supabase.from("organizations").select("*").eq("owner_profile_id", profile!.id).maybeSingle();
  if (!org) {
    return <p className="text-muted-foreground">Create your organization first from the Programs page.</p>;
  }

  const { data: members } = await supabase
    .from("organization_members")
    .select("*, profile:profiles(full_name,email)")
    .eq("organization_id", org.id)
    .order("joined_at", { ascending: false });

  async function handleInvite(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "");
    if (email) await inviteLearnerAction(org!.id, email);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Learners</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite a learner</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleInvite} className="flex flex-col gap-2 sm:flex-row">
            <Input name="email" type="email" placeholder="learner@example.com" required />
            <Button type="submit">Invite</Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name / Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(members ?? []).map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.profile?.full_name ?? m.invited_email}</TableCell>
                <TableCell>
                  <Badge variant={m.status === "active" ? "success" : "outline"} className="capitalize">
                    {m.status}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(m.joined_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
            {(members ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  No learners invited yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}