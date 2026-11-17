"use client";
import { useActionState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteAccountAction, type DeleteAccountState } from "@/lib/actions/account";

const initial: DeleteAccountState = { error: null };

export function DataRightsCard() {
  const [state, formAction, isPending] = useActionState(deleteAccountAction, initial);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your data</CardTitle>
        <CardDescription>Download a copy of what we hold about you, or permanently delete your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Your profile, enrolments, progress, quiz attempts, certificates, W3TR history and more, as one file.
          </p>
          <Button asChild variant="outline">
            <a href="/api/account/export" download>
              <Download className="mr-2 h-4 w-4" /> Download my data
            </a>
          </Button>
        </div>
        <form action={formAction} className="space-y-3 rounded-md border border-destructive/40 p-4">
          <p className="text-sm font-semibold text-destructive">Delete my account</p>
          <p className="text-xs text-muted-foreground">
            This permanently removes your profile, progress, certificates and W3TR balance. It can&apos;t be undone.
            Donation records are kept but no longer linked to you.
          </p>
          <div className="space-y-2">
            <Label htmlFor="confirmEmail">Type your email address to confirm</Label>
            <Input id="confirmEmail" name="confirmEmail" type="email" autoComplete="off" required />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" variant="destructive" disabled={isPending}>
            {isPending ? "Deleting…" : "Permanently delete my account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
