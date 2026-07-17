import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Reset Password" };

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-secondary/40 p-4">
      <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary">
        <Logo size={36} priority />
        Web3tribe University
      </Link>
      <ResetPasswordForm />
    </main>
  );
}