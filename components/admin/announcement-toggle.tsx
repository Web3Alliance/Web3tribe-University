"use client";
import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { toggleAnnouncementActiveAction } from "@/lib/actions/admin";

export function AnnouncementToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const [checked, setChecked] = React.useState(isActive);
  const [, startTransition] = React.useTransition();

  return (
    <Switch
      checked={checked}
      onCheckedChange={(v) => {
        setChecked(v);
        startTransition(async () => {
          await toggleAnnouncementActiveAction(id, v);
        });
      }}
    />
  );
}
