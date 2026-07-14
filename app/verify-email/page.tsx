import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Verify Email" };

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-secondary/40 p-4">
      <Link href="/" className="text-xl font-bold text-primary">
        Web3tribe University
      </Link>
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Email verified</CardTitle>
          <CardDescription>Your email has been verified. You can now log in.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Continue to login</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
