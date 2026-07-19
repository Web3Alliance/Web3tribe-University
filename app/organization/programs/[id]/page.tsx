import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, CheckCircle2, Clock, ArrowLeft } from "lucide-react";
import { assignLearnerToProgramAction, checkAndMarkProgramCompletionAction } from "@/lib/actions/organization";

export const metadata = { title: "Program" };

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: programId } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: program } = await supabase.from("organization_programs").select("*").eq("id", programId).single();
  if (!program) notFound();

  const { data: org } = await supabase.from("organizations").select("*").eq("id", program.organization_id).single();
  if (!org || org.owner_profile_id !== profile!.id) notFound();

  const courseIds: string[] = program.course_ids ?? [];

  const [{ data: courses }, { data: assignments }, { data: allMembers }] = await Promise.all([
    courseIds.length
      ? supabase.from("courses").select("id, title, slug, thumbnail_url, enrollment_count").in("id", courseIds)
      : Promise.resolve({ data: [] as { id: string; title: string; slug: string; thumbnail_url: string | null; enrollment_count: number }[] }),
    supabase
      .from("organization_program_assignments")
      .select("*, profile:profiles(id, full_name, email)")
      .eq("program_id", programId)
      .order("assigned_at", { ascending: false }),
    supabase
      .from("organization_members")
      .select("*, profile:profiles(id, full_name, email)")
      .eq("organization_id", org.id)
      .eq("status", "active"),
  ]);

  // Refresh completion status for every currently-assigned learner whenever
  // this page is viewed, so an org manager always sees accurate progress
  // rather than a stale snapshot from whenever they were last assigned.
  const assignedProfileIds = new Set((assignments ?? []).map((a) => a.profile_id));
  await Promise.all(
    [...assignedProfileIds].map((pid) => checkAndMarkProgramCompletionAction(programId, pid))
  );
  const { data: freshAssignments } = await supabase
    .from("organization_program_assignments")
    .select("*, profile:profiles(id, full_name, email)")
    .eq("program_id", programId)
    .order("assigned_at", { ascending: false });

  const assignedIds = new Set((freshAssignments ?? []).map((a) => a.profile_id));
  const unassignedMembers = (allMembers ?? []).filter((m) => m.profile_id && !assignedIds.has(m.profile_id));

  async function handleAssign(formData: FormData) {
    "use server";
    const profileId = String(formData.get("profileId") || "");
    if (profileId) await assignLearnerToProgramAction(programId, program!.organization_id, profileId);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/organization/programs" className="flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Programs
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{program.name}</h1>
        <p className="text-muted-foreground">{program.description}</p>
        {(program.start_date || program.end_date) && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {program.start_date ?? "—"} → {program.end_date ?? "—"}
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" /> Courses in this program ({courses?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(courses ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No courses were selected for this program.</p>
          ) : (
            (courses ?? []).map((c) => (
              <Link
                key={c.id}
                href={`/student/courses/${c.slug}`}
                className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-secondary/50"
              >
                <span className="font-medium">{c.title}</span>
                <span className="text-xs text-muted-foreground">{c.enrollment_count} total students</span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assign a learner</CardTitle>
        </CardHeader>
        <CardContent>
          {unassignedMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All active members are already assigned, or you have no active members yet — invite some from the
              Learners page first.
            </p>
          ) : (
            <form action={handleAssign} className="flex flex-col gap-2 sm:flex-row">
              <Select name="profileId" required>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose a learner" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedMembers.map((m) => (
                    <SelectItem key={m.profile_id} value={m.profile_id}>
                      {m.profile?.full_name ?? m.profile?.email ?? m.invited_email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit">Assign</Button>
            </form>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Assigning a learner automatically enrolls them in every course above.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assigned learners ({freshAssignments?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(freshAssignments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No learners assigned yet.</p>
          ) : (
            (freshAssignments ?? []).map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <span>{a.profile?.full_name ?? a.profile?.email}</span>
                {a.completed_at ? (
                  <Badge variant="success" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Completed
                  </Badge>
                ) : (
                  <Badge variant="outline">In progress</Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}