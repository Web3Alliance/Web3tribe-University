"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { grantW3trAction } from "@/lib/actions/admin";

export function GrantRewardForm() {
  const [isPending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    const email = String(formData.get("email") || "");
    const amount = Number(formData.get("amount") || 0);
    const description = String(formData.get("description") || "");

    startTransition(async () => {
      const res = await fetch("/api/admin/users?" + new URLSearchParams({ q: email }))
        .then((r) => r.json())
        .catch(() => null);

      const userId = res?.data?.[0]?.id;
      if (!userId) {
        toast.error("No user found with that email.");
        return;
      }

      const result = await grantW3trAction(userId, amount, description);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(`${amount > 0 ? "Granted" : "Deducted"} ${Math.abs(amount)} W3TR.`);
        formRef.current?.reset();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manually grant or deduct W3TR</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">User email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (negative to deduct)</Label>
            <Input id="amount" name="amount" type="number" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Reason</Label>
            <Textarea id="description" name="description" rows={2} required />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Processing…" : "Submit"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
