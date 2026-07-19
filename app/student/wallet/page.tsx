import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatW3TR, formatRelativeTime } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BuyW3trBundles } from "@/components/wallet/buy-w3tr-bundles";

export const metadata = { title: "W3TR Wallet" };

const TYPE_LABELS: Record<string, string> = {
  lesson_complete: "Lesson completed",
  quiz_pass: "Quiz passed",
  exam_pass: "Exam passed",
  course_complete: "Course completed",
  daily_login: "Daily login",
  streak_bonus: "Streak bonus",
  referral_bonus: "Referral bonus",
  helping_learner: "Helped a learner",
  special_event: "Special event",
  course_publish_bonus: "Course published",
  high_rating_bonus: "High rating bonus",
  instructor_milestone: "Instructor milestone",
  community_contribution: "Community contribution",
  admin_grant: "Admin grant",
  admin_deduction: "Admin deduction",
  spend: "Spent",
  donation_conversion: "Donation conversion",
  token_purchase: "Purchased",
  adjustment: "Adjustment",
};

export default async function WalletPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data: wallet }, { data: transactions }] = await Promise.all([
    supabase.from("w3tr_wallets").select("*").eq("profile_id", profile!.id).single(),
    supabase
      .from("w3tr_transactions")
      .select("*")
      .eq("profile_id", profile!.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">W3TR Wallet</h1>
        <p className="text-muted-foreground">
          W3TR is your in-app reward asset — not a cryptocurrency. Earn it by learning, teaching, and contributing.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{formatW3TR(wallet?.balance ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lifetime Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">{formatW3TR(wallet?.lifetime_earned ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lifetime Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-muted-foreground">{formatW3TR(wallet?.lifetime_spent ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buy W3TR</CardTitle>
          <p className="text-sm text-muted-foreground">
            Need more W3TR for a premium course? Top up with a card or bank transfer via Paystack.
          </p>
        </CardHeader>
        <CardContent>
          <BuyW3trBundles />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {(transactions ?? []).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet. Start learning to earn W3TR!</p>
          )}
          {(transactions ?? []).map((tx) => (
            <div key={tx.id} className="flex items-center justify-between border-b border-border py-3 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-2 ${Number(tx.amount) >= 0 ? "bg-success/15" : "bg-destructive/15"}`}>
                  {Number(tx.amount) >= 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-success" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-destructive" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{TYPE_LABELS[tx.type] ?? tx.type}</p>
                  <p className="text-xs text-muted-foreground">{tx.description ?? formatRelativeTime(tx.created_at)}</p>
                </div>
              </div>
              <Badge variant={Number(tx.amount) >= 0 ? "success" : "secondary"}>
                {Number(tx.amount) >= 0 ? "+" : ""}
                {formatW3TR(tx.amount)}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}