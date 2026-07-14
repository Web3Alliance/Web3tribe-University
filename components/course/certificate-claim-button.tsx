"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Award, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CertificateClaimButton({ courseId, alreadyIssued }: { courseId: string; alreadyIssued: boolean }) {
  const [isPending, startTransition] = React.useTransition();
  const [issued, setIssued] = React.useState(alreadyIssued);

  if (issued) {
    return (
      <Button asChild className="w-full">
        <Link href="/student/certificates">
          <Award className="h-4 w-4" /> View your certificate
        </Link>
      </Button>
    );
  }

  function handleClaim() {
    startTransition(async () => {
      const res = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error ?? "Failed to generate certificate.");
        return;
      }
      setIssued(true);
      toast.success("Certificate generated!");
    });
  }

  return (
    <Button onClick={handleClaim} disabled={isPending} className="w-full">
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
      {isPending ? "Generating…" : "Claim your certificate"}
    </Button>
  );
}
