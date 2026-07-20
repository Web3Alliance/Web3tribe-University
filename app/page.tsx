import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Brain,
  ShieldCheck,
  Database,
  Cloud,
  Sprout,
  HeartPulse,
  Landmark,
  Palette,
  Rocket,
  GraduationCap,
  Award,
  Wallet,
  Users,
  Blocks,
  Code2,
} from "lucide-react";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tCommon = await getTranslations("common");

  const categories = [
    { icon: Brain, label: "Artificial Intelligence" },
    { icon: Code2, label: "Software Development" },
    { icon: ShieldCheck, label: "Cybersecurity" },
    { icon: Database, label: "Data Science" },
    { icon: Blocks, label: "Blockchain" },
    { icon: Cloud, label: "Cloud Computing" },
    { icon: Landmark, label: "Finance" },
    { icon: Sprout, label: "Agriculture" },
    { icon: HeartPulse, label: "Healthcare" },
    { icon: Palette, label: "Creative Arts" },
    { icon: Rocket, label: "Entrepreneurship" },
  ];

  const steps = [
    { step: "1", title: t("step1Title"), body: t("step1Body") },
    { step: "2", title: t("step2Title"), body: t("step2Body") },
    { step: "3", title: t("step3Title"), body: t("step3Body") },
  ];

  return (
    <main className="flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <span className="flex items-center gap-2 text-lg font-bold text-primary">
            <Logo size={40} priority />
            Web3tribe University
          </span>
          <nav className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">{tCommon("login")}</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="border-b border-border bg-gradient-to-b from-secondary/60 to-background px-4 py-20 text-center">
        <Badge variant="accent" className="mb-4">
          {t("tagline")}
        </Badge>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          {t("heroLine1")} <span className="text-primary">{t("heroLine2")}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{t("heroSubtitle")}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/register">{t("startLearningFree")}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/student/courses">{t("browseCourses")}</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-6 px-4 py-12 sm:grid-cols-4">
        {[
          { icon: GraduationCap, value: "1M+", label: "Learner goal" },
          { icon: Users, value: "36+FCT", label: "States targeted" },
          { icon: Award, value: "100%", label: "Verifiable credentials" },
          { icon: Wallet, value: "W3TR", label: "Reward economy" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <s.icon className="mx-auto mb-2 h-6 w-6 text-primary" />
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="border-y border-border bg-secondary/30 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-2xl font-bold">{t("categoriesHeading")}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((c) => (
              <Card key={c.label} className="transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                  <c.icon className="h-7 w-7 text-primary" />
                  <p className="text-sm font-medium">{c.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="mb-10 text-center text-2xl font-bold">{t("howItWorksHeading")}</h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.step} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                {s.step}
              </div>
              <h3 className="mb-2 font-semibold">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/30 px-4 py-16 text-center">
        <h2 className="mx-auto max-w-2xl text-2xl font-bold">{t("countryReadyHeading")}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{t("countryReadyBody")}</p>
      </section>

      <section className="border-t border-border bg-primary px-4 py-16 text-center text-primary-foreground">
        <h2 className="text-2xl font-bold">{t("ctaHeading")}</h2>
        <p className="mx-auto mt-2 max-w-lg text-primary-foreground/80">{t("ctaSubtitle")}</p>
        <Button size="lg" variant="accent" className="mt-6" asChild>
          <Link href="/register">{t("ctaButton")}</Link>
        </Button>
      </section>

      <footer className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Web3tribe University · A Web3.0 Alliance Ltd platform.</p>
        <p className="mt-2 flex justify-center gap-4">
          <Link href="/terms" className="hover:text-foreground hover:underline">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            Privacy Policy
          </Link>
        </p>
      </footer>
    </main>
  );
}