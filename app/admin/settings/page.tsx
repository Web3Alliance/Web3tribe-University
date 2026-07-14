import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: settings } = await supabase.from("system_settings").select("*");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-muted-foreground">Current configuration values (read-only for Admins).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current settings</CardTitle>
          <CardDescription>Only Super Admins can modify these values.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(settings ?? []).length === 0 && <p className="text-sm text-muted-foreground">No custom settings configured yet.</p>}
          {(settings ?? []).map((s) => (
            <div key={s.key} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-mono text-sm">{s.key}</p>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </div>
              <Badge variant="outline">{JSON.stringify(s.value)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {profile?.role === "super_admin" && (
        <Button asChild>
          <Link href="/super-admin/system">Manage system settings →</Link>
        </Button>
      )}
    </div>
  );
}
