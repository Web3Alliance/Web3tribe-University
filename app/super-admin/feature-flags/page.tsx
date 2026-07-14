import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createFeatureFlagAction } from "@/lib/actions/super-admin";
import { FeatureFlagToggle } from "@/components/admin/feature-flag-toggle";

export const metadata = { title: "Feature Flags" };

export default async function FeatureFlagsPage() {
  const supabase = await createClient();
  const { data: flags } = await supabase.from("feature_flags").select("*").order("flag_key");

  async function handleCreate(formData: FormData) {
    "use server";
    await createFeatureFlagAction(formData);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Feature Flags</h1>
        <p className="text-muted-foreground">
          Toggle experimental or in-progress features platform-wide, including future integrations such as an
          on-chain W3TR adapter, without a code deploy.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New feature flag</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="flagKey">Key</Label>
                <Input id="flagKey" name="flagKey" placeholder="blockchain_adapter_enabled" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input id="label" name="label" placeholder="On-chain W3TR Adapter" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" />
            </div>
            <Button type="submit">Create flag</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(flags ?? []).map((f) => (
          <Card key={f.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-mono text-sm font-medium">{f.flag_key}</p>
                <p className="text-xs text-muted-foreground">{f.description}</p>
              </div>
              <FeatureFlagToggle flagId={f.id} isEnabled={f.is_enabled} />
            </CardContent>
          </Card>
        ))}
        {(flags ?? []).length === 0 && <p className="text-center text-muted-foreground">No feature flags yet.</p>}
      </div>
    </div>
  );
}
