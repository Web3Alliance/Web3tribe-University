import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Log In" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-secondary/40 p-4">
      <Link href="/" className="text-xl font-bold text-primary">
        Web3tribe University
      </Link>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
