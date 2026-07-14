import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata: Metadata = { title: "Forgot Password" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-secondary/40 p-4">
      <Link href="/" className="text-xl font-bold text-primary">
        Web3tribe University
      </Link>
      <ForgotPasswordForm />
    </main>
  );
}
