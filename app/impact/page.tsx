import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { createAdminClient } from "@/lib/supabase/admin";
import { Users, GraduationCap, Award, BookOpen, MapPin, Landmark } from "lucide-react";

export const metadata = {
  title: "Our Impact | Web3tribe University",
  description: "Real, live numbers from the Web3tribe University platform — learners, completions, and certificates issued.",
};

// Revalidate periodically rather than on every single request — these are
// slow-moving aggregate counts, not per-user data, so a public visitor
// doesn't need millisecond freshness and the platform doesn't need to
// re-run four count queries on every single page view.
export const revalidate = 300; // 5 minutes

/**
 * Deliberately public — no login required. This page exists specifically so
 * these numbers are visible proof, not something only checkable via a raw
 * SQL query against the database.
 *
 * Uses the admin (service-role) client rather than the regular per-request
 * client because some of these counts (completed enrollments, in
 * particular) are correctly RLS-restricted to the owning student/instructor
 * for row-level access — an anonymous visitor's own client would see 0, not
 * the real total. The queries here are pure aggregate counts with no
 * row-level or personally identifiable data returned at all, which is
 * exactly the narrow, safe exception the admin client's own usage
 * guidance calls for.
 */
export default async function ImpactPage() {
  const admin = createAdminClient();

  const [
    { count: totalLearners },
    { count: totalCompletions },
    { count: totalCertificates },
    { count: totalPublishedCourses },
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    admin.from("enrollments").select("*", { count: "exact", head: true }).eq("status", "completed"),
    admin.from("certificates").select("*", { count: "exact", head: true }),
    admin.from("courses").select("*", { count: "exact", head: true }).eq("status", "published"),
  ]);

  const stats = [
    { icon: Users, value: totalLearners ?? 0, label: "Registered learners" },
    { icon: GraduationCap, value: totalCompletions ?? 0, label: "Course completions" },
    { icon: Award, value: totalCertificates ?? 0, label: "Certificates issued" },
    { icon: BookOpen, value: totalPublishedCourses ?? 0, label: "Published courses" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-3 sm:p-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-primary">
            <Logo size={36} priority />
            <span className="sm:hidden">W3tribe</span>
            <span className="hidden sm:inline">Web3tribe University</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">Our Impact</h1>
          <p className="mt-3 text-muted-foreground">
            Real numbers, pulled directly from the platform — not a target, not a projection. This is what&apos;s
            actually happened so far.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                <s.icon className="h-7 w-7 text-primary" />
                <p className="text-3xl font-bold">{s.value.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-border bg-card p-8 sm:p-10">
          <h2 className="text-xl font-semibold">Where this started</h2>
          <p className="mt-2 text-muted-foreground">
            Before Web3tribe University existed as a platform, we ran the Digital Inclusion Project — a hybrid
            mobile-and-community-hub pilot in partnership with Plateau State Polytechnic, launched November 2025.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">600+ beneficiaries</p>
                <p className="text-sm text-muted-foreground">trained through the pilot program</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">\u20A624,000,000 grant</p>
                <p className="text-sm text-muted-foreground">awarded by the World Bank through the IDEAS project</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">Plateau State Polytechnic</p>
                <p className="text-sm text-muted-foreground">Jos, Nigeria \u2014 our founding training site</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-xl font-semibold">Be part of the next number</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Every learner above started exactly where you are now.
          </p>
          <Button size="lg" className="mt-6" asChild>
            <Link href="/register">Start learning free</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
