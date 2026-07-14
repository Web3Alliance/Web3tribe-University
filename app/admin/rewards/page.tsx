import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { GrantRewardForm } from "@/components/admin/grant-reward-form";
import { formatRelativeTime, formatW3TR } from "@/lib/utils";

export const metadata = { title: "Rewards" };

export default async function AdminRewardsPage() {
  const supabase = await createClient();

  const { data: recentTransactions } = await supabase
    .from("w3tr_transactions")
    .select("*, profile:profiles(full_name,email)")
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: rules } = await supabase.from("reward_rules").select("*").order("rule_key");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Reward Management</h1>
        <p className="text-muted-foreground">Monitor W3TR activity and manually adjust balances.</p>
      </div>

      <GrantRewardForm />

      {rules && rules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reward Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.label}</TableCell>
                    <TableCell>{formatW3TR(r.amount)} W3TR</TableCell>
                    <TableCell>
                      <Badge variant={r.is_active ? "success" : "outline"}>{r.is_active ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recentTransactions ?? []).map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{tx.profile?.full_name}</TableCell>
                  <TableCell className="capitalize">{tx.type.replace(/_/g, " ")}</TableCell>
                  <TableCell className={Number(tx.amount) >= 0 ? "text-success" : "text-destructive"}>
                    {Number(tx.amount) >= 0 ? "+" : ""}
                    {formatW3TR(tx.amount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatRelativeTime(tx.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
