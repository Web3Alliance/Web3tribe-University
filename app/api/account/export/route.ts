import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Personal-data export: everything the platform holds about the signed-in person, as one JSON file.
 * Reads go through the person's OWN session, so database access rules guarantee they can only ever
 * receive their own rows. Tables that don't exist yet or can't be read are skipped, never fatal.
 */
const OWN_TABLES: Array<{ table: string; column: string }> = [
  { table: "student_profiles", column: "profile_id" },
  { table: "student_biodata", column: "profile_id" },
  { table: "enrollments", column: "student_id" },
  { table: "lesson_progress", column: "student_id" },
  { table: "quiz_attempts", column: "student_id" },
  { table: "assignment_submissions", column: "student_id" },
  { table: "certificates", column: "student_id" },
  { table: "w3tr_wallets", column: "profile_id" },
  { table: "w3tr_transactions", column: "profile_id" },
  { table: "w3tr_purchases", column: "profile_id" },
  { table: "notifications", column: "profile_id" },
  { table: "course_reviews", column: "student_id" },
  { table: "discussion_threads", column: "author_id" },
  { table: "discussion_replies", column: "author_id" },
  { table: "opportunity_applications", column: "student_id" },
  { table: "organization_members", column: "profile_id" },
  { table: "donations", column: "donor_id" },
];

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit("account-export", profile.id, 5, 3600);
  if (limited) return limited;

  const supabase = await createClient();
  const data: Record<string, unknown> = { profile };
  for (const { table, column } of OWN_TABLES) {
    const { data: rows, error } = await supabase.from(table).select("*").eq(column, profile.id).limit(5000);
    if (!error && rows && rows.length > 0) data[table] = rows;
  }

  const body = JSON.stringify(
    { exported_at: new Date().toISOString(), platform: "Web3tribe University", note: "Your personal data held by the platform.", data },
    null,
    2
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="web3tribe-my-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
