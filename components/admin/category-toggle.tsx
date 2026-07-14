"use client";
import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { toggleCategoryActiveAction } from "@/lib/actions/admin";

export function CategoryToggle({ categoryId, isActive }: { categoryId: string; isActive: boolean }) {
  const [checked, setChecked] = React.useState(isActive);
  const [, startTransition] = React.useTransition();

  return (
    <Switch
      checked={checked}
      onCheckedChange={(v) => {
        setChecked(v);
        startTransition(async () => {
          await toggleCategoryActiveAction(categoryId, v);
        });
      }}
    />
  );
}
