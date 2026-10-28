#!/usr/bin/env node
/**
 * LIVE RETEST — replays the BugBunny findings against your real Supabase project, SAFELY.
 *
 * Safe means: nothing here can create, change or delete data, even if a hole were still open.
 *   - every data probe is a read (GET / storage list), and
 *   - every "can I call this function?" probe uses a random id that does not exist, so a function
 *     that is still reachable fails harmlessly (foreign-key / "not found" error) and a function that
 *     has been locked answers "permission denied". (Verified on a replica of the schema: before the
 *     fix these calls errored without writing; after the fix they are refused.)
 * It does NOT create accounts, enrol, donate or sign up. Those checks are in
 * supabase/security/verify-0022-applied.sql (run in the Supabase SQL editor) and in the manual
 * smoke tests in docs/SECURITY_REMEDIATION_2026-10.md.
 *
 * Run from the project root (uses your own .env.local; the key is never printed or sent anywhere
 * except to your own Supabase project):
 *
 *   node --env-file=.env.local supabase/security/live-retest.mjs
 *
 * Exit code 0 = every check passed. Needs Node 20+.
 */
import { randomUUID } from "node:crypto";

const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!BASE || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.\n" +
    "Run from the project root:  node --env-file=.env.local supabase/security/live-retest.mjs");
  process.exit(2);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function call(method, path, body) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, json, text };
  } catch (e) {
    return { status: 0, json: null, text: String(e && e.message ? e.message : e) };
  }
}

const results = [];
const record = (id, title, pass, detail) => results.push({ id, title, pass, detail });

const refused = (r) => r.status === 401 || r.status === 403;
const rowsReturned = (r) => Array.isArray(r.json) && r.json.length > 0;

// ---------------------------------------------------------------- reads a logged-out visitor must NOT get
async function mustNotReadRows(id, title, path) {
  const r = await call("GET", path);
  if (r.status === 0) return record(id, title, false, `network error: ${r.text}`);
  if (rowsReturned(r)) return record(id, title, false, `STILL EXPOSED: ${r.json.length} row(s) returned (HTTP ${r.status})`);
  record(id, title, true, refused(r) ? `refused (HTTP ${r.status})` : `no rows returned (HTTP ${r.status})`);
}

await mustNotReadRows("F4-email", "Anonymous cannot read user e-mail addresses (profiles.email)", "/rest/v1/profiles?select=email&limit=1");
await mustNotReadRows("F4-role", "Anonymous cannot read user roles / ban flags (profiles.role)", "/rest/v1/profiles?select=role,is_banned&limit=1");
await mustNotReadRows("F4-leaderboard", "Anonymous cannot read the leaderboard (names + balances)", "/rest/v1/leaderboard?select=*&limit=1");
await mustNotReadRows("F4-certificates", "Anonymous cannot list certificates", "/rest/v1/certificates?select=certificate_code&limit=1");
await mustNotReadRows("F4-system_settings", "Anonymous cannot read system_settings", "/rest/v1/system_settings?select=*&limit=1");
await mustNotReadRows("F4-feature_flags", "Anonymous cannot read feature_flags", "/rest/v1/feature_flags?select=*&limit=1");
await mustNotReadRows("F4-reward_rules", "Anonymous cannot read reward_rules", "/rest/v1/reward_rules?select=*&limit=1");
await mustNotReadRows("F4-instructor-docs", "Anonymous cannot read instructor verification documents/notes", "/rest/v1/instructor_profiles?select=verification_notes,verification_document_url&limit=1");

// ---------------------------------------------------------------- something the public site NEEDS must still work
{
  const r = await call("GET", "/rest/v1/profiles?select=id,full_name,avatar_url,username&limit=1");
  record("R-public-profile", "Public pages can still read instructor name/avatar (must keep working)",
    r.status === 200 && Array.isArray(r.json),
    r.status === 200 ? "works (HTTP 200)" : `BROKEN: HTTP ${r.status} ${String(r.text).slice(0, 90)} — the course catalogue may be missing instructor names`);
}
{
  const r = await call("GET", "/rest/v1/courses?select=id,title,instructor:profiles!courses_instructor_id_fkey(id,full_name,avatar_url)&status=eq.published&limit=1");
  record("R-catalogue-join", "Course catalogue query (course + instructor join) still works",
    r.status === 200 && Array.isArray(r.json),
    r.status === 200 ? `works (HTTP 200, ${r.json.length} course row(s))` : `BROKEN: HTTP ${r.status} ${String(r.text).slice(0, 90)}`);
}

// ---------------------------------------------------------------- RPCs must be refused for the public key
// Random ids that do not exist => harmless even if the function is still callable.
async function mustBeRefused(id, title, fn, args) {
  const r = await call("POST", `/rest/v1/rpc/${fn}`, args);
  if (r.status === 0) return record(id, title, false, `network error: ${r.text}`);
  if (refused(r)) return record(id, title, true, `refused (HTTP ${r.status}) — locked to the server`);
  record(id, title, false, `STILL CALLABLE by the public key (HTTP ${r.status}: ${String(r.text).slice(0, 80)})`);
}
const ghost = () => randomUUID();
await mustBeRefused("F3-award", "Anonymous cannot call award_w3tr (mint W3TR)", "award_w3tr",
  { p_profile_id: ghost(), p_type: "admin_grant", p_amount: 0.01, p_description: "live-retest probe (nonexistent id)" });
await mustBeRefused("F3-spend", "Anonymous cannot call spend_w3tr (debit W3TR)", "spend_w3tr",
  { p_profile_id: ghost(), p_amount: 0.01, p_description: "live-retest probe (nonexistent id)" });
await mustBeRefused("F3-login", "Anonymous cannot call record_daily_login", "record_daily_login", { p_profile_id: ghost() });
await mustBeRefused("F3-complete", "Anonymous cannot call complete_lesson (forge progress)", "complete_lesson",
  { p_enrollment_id: ghost(), p_lesson_id: ghost() });
await mustBeRefused("F3-campaign", "Anonymous cannot call increment_campaign_raised", "increment_campaign_raised",
  { p_campaign_id: ghost(), p_amount: 0 });

// ---------------------------------------------------------------- storage listing must be closed
for (const bucket of ["course-documents", "certificates", "avatars", "course-images"]) {
  const r = await call("POST", `/storage/v1/object/list/${bucket}`, { prefix: "", limit: 1, offset: 0 });
  const id = `F4-storage-${bucket}`;
  const title = `Anonymous cannot list files in the '${bucket}' bucket`;
  if (r.status === 0) record(id, title, false, `network error: ${r.text}`);
  else if (rowsReturned(r)) record(id, title, false, `STILL LISTABLE: ${r.json.length} object(s) returned`);
  else record(id, title, true, refused(r) ? `refused (HTTP ${r.status})` : `empty listing (HTTP ${r.status})`);
}

// ---------------------------------------------------------------- report
const w = Math.max(...results.map((r) => r.title.length));
console.log(`\nLive retest against ${BASE.replace(/^https?:\/\//, "")}\n`);
for (const r of results) {
  console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.title.padEnd(w)}  ${r.detail}`);
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) {
  console.log("\nFAILED:\n" + failed.map((f) => `  - ${f.id}: ${f.title}\n      ${f.detail}`).join("\n"));
  console.log("\nIf several F3/F4 checks fail, migration 0022 has probably not been applied to THIS Supabase project yet" +
    "\n(or was applied to a different project). Run supabase/security/verify-0022-applied.sql in the SQL editor to see which part is missing.");
} else {
  console.log("All public-key attack paths from the audit are closed, and the public pages' reads still work.");
}
console.log("\nNot covered here (needs a logged-in session or would create data): self-promotion via profiles, forged enrolments,\n" +
  "signup role injection, admin pages for students, storage moves. Use verify-0022-applied.sql + the smoke tests, and re-run BugBunny.");
process.exit(failed.length ? 1 : 0);
