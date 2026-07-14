import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Users, BookOpen, Wallet, Heart, ShieldCheck } from "lucide-react";
import { formatW3TR } from "@/lib/utils";

export const metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: userCount },
    { count: courseCount },
    { count: pendingReviewCount },
    { count: donationCount },
    { data: donationSum },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("courses").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("courses").select("*", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("donations").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
    supabase.from("donations").select("amount").eq("status", "confirmed"),
  ]);

  const totalDonations = (donationSum ?? []).reduce((s, d) => s + Number(d.amount), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform-wide overview.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{userCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-success/20 p-3">
              <BookOpen className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{courseCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Published courses</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-warning/20 p-3">
              <ShieldCheck className="h-5 w-5 text-warning-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingReviewCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Pending review</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-accent/20 p-3">
              <Heart className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{donationCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Donations received</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-secondary p-3">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatW3TR(totalDonations)}</p>
              <p className="text-xs text-muted-foreground">Total donation value</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
