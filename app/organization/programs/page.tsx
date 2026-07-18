import Link from "next/link";
import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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

  const [{ data: programs }, { data: availableCourses }] = await Promise.all([
    supabase
      .from("organization_programs")
      .select("*")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false }),
    supabase.from("courses").select("id, title").eq("status", "published").order("title"),
  ]);

  async function handleCreateProgram(formData: FormData) {
    "use server";
    await createProgramAction(org!.id, formData);
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input id="startDate" name="startDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End date</Label>
                <Input id="endDate" name="endDate" type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Courses in this program</Label>
              {(availableCourses ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No published courses available yet.</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                  {(availableCourses ?? []).map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox name="courseIds" value={c.id} />
                      {c.title}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <Button type="submit">Create program</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(programs ?? []).map((p) => (
          <Link key={p.id} href={`/organization/programs/${p.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                </div>
                <Badge variant="secondary">{(p.course_ids ?? []).length} courses</Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
        {(programs ?? []).length === 0 && <p className="text-center text-muted-foreground">No programs yet.</p>}
      </div>
    </div>
  );
}