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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NIGERIAN_STATES } from "@/lib/nigerian-states";
import { PAY_CURRENCIES, PAY_PERIODS, formatPay } from "@/lib/currencies";
import { createOpportunityAction } from "@/lib/actions/opportunities";

export const metadata = { title: "Opportunities" };

export default async function OrganizationOpportunitiesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: org } = await supabase.from("organizations").select("*").eq("owner_profile_id", profile!.id).maybeSingle();
  if (!org) {
    return (
      <p className="text-muted-foreground">
        Create your organization first from the{" "}
        <Link href="/organization/programs" className="text-primary hover:underline">
          Programs
        </Link>{" "}
        page.
      </p>
    );
  }

  const [{ data: opportunities }, { data: availableCourses }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("*, opportunity_applications(id)")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false }),
    supabase.from("courses").select("id, title").eq("status", "published").order("title"),
  ]);

  async function handleCreate(formData: FormData) {
    "use server";
    await createOpportunityAction(org!.id, formData);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Opportunities</h1>
        <p className="text-muted-foreground">
          Post real jobs, gigs, or apprenticeships tied to specific courses — students who have genuinely
          completed those courses (and opted in to being visible) can express interest.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Post a new opportunity</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" placeholder="e.g. Phone Repair Technician" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select name="opportunityType" defaultValue="job">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job">Job</SelectItem>
                    <SelectItem value="gig">Gig</SelectItem>
                    <SelectItem value="apprenticeship">Apprenticeship</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location (leave blank for remote/anywhere)</Label>
                <Select name="locationState">
                  <SelectTrigger>
                    <SelectValue placeholder="Remote / anywhere" />
                  </SelectTrigger>
                  <SelectContent>
                    {NIGERIAN_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Expected pay (required — shown to students in your country&apos;s currency)</Label>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input name="payAmount" type="number" min="1" step="0.01" placeholder="e.g. 150000" required />
                <Select name="payCurrency" defaultValue="NGN">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAY_CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select name="payPeriod" defaultValue="month">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAY_PERIODS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="applicationMethod">How should students apply?</Label>
              <Input id="applicationMethod" name="applicationMethod" placeholder="Email, phone number, or a link" />
            </div>
            <div className="space-y-2">
              <Label>Required courses (students must have completed all of these to be matched)</Label>
              {(availableCourses ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No published courses available yet.</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                  {(availableCourses ?? []).map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox name="requiredCourseIds" value={c.id} />
                      {c.title}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <Button type="submit">Post opportunity</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(opportunities ?? []).map((o) => (
          <Link key={o.id} href={`/organization/opportunities/${o.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{o.title}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {o.opportunity_type} · {o.location_state ?? "Remote/anywhere"}
                    {formatPay(o.pay_amount, o.pay_currency, o.pay_period) ? ` · ${formatPay(o.pay_amount, o.pay_currency, o.pay_period)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{(o.opportunity_applications ?? []).length} interested</Badge>
                  <Badge variant={o.status === "open" ? "success" : "outline"} className="capitalize">
                    {o.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {(opportunities ?? []).length === 0 && <p className="text-center text-muted-foreground">No opportunities posted yet.</p>}
      </div>
    </div>
  );
}