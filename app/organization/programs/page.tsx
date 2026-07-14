import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createOrganizationAction, createProgramAction } from "@/lib/actions/organization";

export const metadata = { title: "Programs" };

export default async function OrganizationProgramsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: org } = await supabase.from("organizations").select("*").eq("owner_profile_id", profile!.id).maybeSingle();

  if (!org) {
    async function handleCreateOrg(formData: FormData) {
      "use server";
      await createOrganizationAction(formData);
    }

    return (
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="text-2xl font-bold">Create your organization</h1>
        <Card>
          <CardContent className="p-6">
            <form action={handleCreateOrg} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" name="industry" />
              </div>
              <Button type="submit" className="w-full">
                Create organization
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: programs } = await supabase
    .from("organization_programs")
    .select("*")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  async function handleCreateProgram(formData: FormData) {
    "use server";
    await createProgramAction(org.id, formData);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Learning Programs</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create a new program</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleCreateProgram} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Program name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <Button type="submit">Create program</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(programs ?? []).map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4">
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-muted-foreground">{p.description}</p>
            </CardContent>
          </Card>
        ))}
        {(programs ?? []).length === 0 && <p className="text-center text-muted-foreground">No programs yet.</p>}
      </div>
    </div>
  );
}
