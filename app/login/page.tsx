import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Log In" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-secondary/40 p-4">
      <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary">
        <Logo size={36} priority />
        Web3tribe University
      </Link>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}