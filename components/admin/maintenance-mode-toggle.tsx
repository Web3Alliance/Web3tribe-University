"use client";
import * as React from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleMaintenanceModeAction } from "@/lib/actions/super-admin";

export function MaintenanceModeToggle({ enabled }: { enabled: boolean }) {
  const [checked, setChecked] = React.useState(enabled);
  const [, startTransition] = React.useTransition();

  return (
    <Switch
      checked={checked}
      onCheckedChange={(v) => {
        setChecked(v);
        startTransition(async () => {
          const res = await toggleMaintenanceModeAction(v);
          if (res?.error) {
            toast.error(res.error);
            setChecked(!v);
          } else {
            toast.success(v ? "Maintenance mode enabled." : "Maintenance mode disabled.");
          }
        });
      }}
    />
  );
}
