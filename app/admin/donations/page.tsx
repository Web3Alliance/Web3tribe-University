import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ConfirmDonationButton } from "@/components/admin/confirm-donation-button";

export const metadata = { title: "Donations" };

export default async function AdminDonationsPage() {
  const supabase = await createClient();

  const { data: donations } = await supabase
    .from("donations")
    .select("*, campaign:donation_campaigns(title)")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: campaigns } = await supabase.from("donation_campaigns").select("*").eq("is_active", true);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Donations</h1>
        <p className="text-muted-foreground">Track incoming donations and campaign progress.</p>
      </div>

      {campaigns && campaigns.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => {
            const pct = c.goal_amount > 0 ? Math.min(100, (Number(c.raised_amount) / Number(c.goal_amount)) * 100) : 0;
            return (
              <Card key={c.id}>
                <CardContent className="p-6">
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.currency} {Number(c.raised_amount).toLocaleString()} of {Number(c.goal_amount).toLocaleString()}
                  </p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Donor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(donations ?? []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.is_anonymous ? "Anonymous" : d.donor_name ?? d.donor_email}</TableCell>
                  <TableCell>
                    {d.currency} {Number(d.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="capitalize">{d.method.replace("_", " ")}</TableCell>
                  <TableCell>
                    <Badge
                      variant={d.status === "confirmed" ? "success" : d.status === "pending" ? "warning" : "destructive"}
                      className="capitalize"
                    >
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                  <TableCell className="text-right">
                    {d.status === "pending" && <ConfirmDonationButton donationId={d.id} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
