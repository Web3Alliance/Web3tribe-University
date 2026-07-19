import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/rbac";
import { getBiodataGateStatus } from "@/lib/actions/biodata";
import { BiodataForm } from "@/components/settings/biodata-form";

export const metadata = { title: "Student Biodata" };

export default async function BiodataPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?redirectTo=/student/biodata`);
  if (profile.role !== "student") redirect("/student/dashboard");

  const status = await getBiodataGateStatus(profile.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Student Biodata</h1>
        <p className="text-muted-foreground">
          This is the standard information institutions need on record for enrolled students. It&apos;s required
          once, before you can enroll in your first course.
        </p>
        {status.skipAllowed && (
          <p className="mt-2 rounded-md bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            You&apos;re within the first {30 - status.totalThroughGate} of a limited testing window where this can
            be skipped — after that, every new student will be required to complete it.
          </p>
        )}
      </div>

      <BiodataForm skipAllowed={status.skipAllowed} redirectTo={redirectTo ?? "/student/courses"} />
    </div>
  );
}