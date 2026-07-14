"use client";
import * as React from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleFeatureFlagAction } from "@/lib/actions/super-admin";

export function FeatureFlagToggle({ flagId, isEnabled }: { flagId: string; isEnabled: boolean }) {
  const [checked, setChecked] = React.useState(isEnabled);
  const [, startTransition] = React.useTransition();

  return (
    <Switch
      checked={checked}
      onCheckedChange={(v) => {
        setChecked(v);
        startTransition(async () => {
          const res = await toggleFeatureFlagAction(flagId, v);
          if (res?.error) {
            toast.error(res.error);
            setChecked(!v);
          }
        });
      }}
    />
  );
}
