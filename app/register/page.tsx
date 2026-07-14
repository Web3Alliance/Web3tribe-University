import type { Metadata } from "next";
import Link from "next/link";
import { RegistrationForm } from "@/components/registration-form";

export const metadata: Metadata = { title: "Sign Up" };

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-secondary/40 p-4">
      <Link href="/" className="text-xl font-bold text-primary">
        Web3tribe University
      </Link>
      <RegistrationForm />
    </main>
  );
}
