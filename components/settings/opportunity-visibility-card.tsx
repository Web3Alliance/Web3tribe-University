"use client";
import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toggleOpportunityVisibilityAction } from "@/lib/actions/opportunities";

export function OpportunityVisibilityCard({ initialVisible }: { initialVisible: boolean }) {
  const [visible, setVisible] = React.useState(initialVisible);
  const [isPending, startTransition] = React.useTransition();

  function handleChange(next: boolean) {
    setVisible(next);
    startTransition(async () => {
      const res = await toggleOpportunityVisibilityAction(next);
      if (res.error) {
        toast.error(res.error);
        setVisible(!next);
      } else {
        toast.success(next ? "You're now visible to employers for matched opportunities." : "Visibility turned off.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opportunities</CardTitle>
        <CardDescription>
          Real jobs, gigs, and apprenticeships get matched to courses you&apos;ve completed. This is off by
          default — completing a course never makes you visible to anyone on its own.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <Label htmlFor="opportunity-visibility" className="cursor-pointer">
          Visible to employers for matched opportunities
        </Label>
        <Switch
          id="opportunity-visibility"
          checked={visible}
          disabled={isPending}
          onCheckedChange={handleChange}
        />
      </CardContent>
    </Card>
  );
}