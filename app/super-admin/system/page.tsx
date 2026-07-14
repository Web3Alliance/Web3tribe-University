import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MaintenanceModeToggle } from "@/components/admin/maintenance-mode-toggle";
import { Database, Server, ShieldAlert } from "lucide-react";

export const metadata = { title: "System" };

export default async function SystemPage() {
  const supabase = await createClient();

  const { data: maintenanceSetting } = await supabase
    .from("system_settings")
    .select("*")
    .eq("key", "maintenance_mode")
    .maybeSingle();

  const maintenanceEnabled = (maintenanceSetting?.value as { enabled?: boolean } | null)?.enabled ?? false;

  // A lightweight connectivity check using the privileged client, to surface
  // basic platform health without requiring a separate monitoring service.
  let dbHealthy = true;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").select("id", { count: "exact", head: true }).limit(1);
    dbHealthy = !error;
  } catch {
    dbHealthy = false;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System</h1>
        <p className="text-muted-foreground">Platform-level configuration and health.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" /> Maintenance Mode
          </CardTitle>
          <CardDescription>
            When enabled, non-admin users should see a maintenance page (enforce this in your proxy.ts or a
            top-level layout check against this setting).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <span className="text-sm font-medium">Maintenance mode is currently {maintenanceEnabled ? "ON" : "OFF"}</span>
            <MaintenanceModeToggle enabled={maintenanceEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" /> Database Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant={dbHealthy ? "success" : "destructive"}>{dbHealthy ? "Connected" : "Connection issue"}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" /> Environment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Deployment target: Netlify</p>
          <p>Database: Supabase (PostgreSQL)</p>
          <p>Framework: Next.js (App Router)</p>
        </CardContent>
      </Card>
    </div>
  );
}
