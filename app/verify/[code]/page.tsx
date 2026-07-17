import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Award } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = { title: "Verify Certificate" };

export default async function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // Public verification legitimately needs to look up a certificate by anyone,
  // including logged-out visitors, so this uses the admin client for the lookup
  // (read-only, and only exposes the specific non-sensitive fields selected below).
  const supabase = createAdminClient();

  const { data: cert } = await supabase
    .from("certificates")
    .select("certificate_code,student_name_snapshot,course_title_snapshot,instructor_name_snapshot,issued_at,revoked,final_score")
    .eq("certificate_code", code.toUpperCase())
    .maybeSingle();

  if (!cert) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-secondary/40 p-4">
      <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary">
        <Logo size={36} priority />
        Web3tribe University
      </Link>
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-6 p-8 text-center">
          {cert.revoked ? (
            <>
              <XCircle className="mx-auto h-14 w-14 text-destructive" />
              <h1 className="text-xl font-bold">Certificate Revoked</h1>
              <p className="text-sm text-muted-foreground">This certificate is no longer valid.</p>
            </>
          ) : (
            <>
              <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
              <h1 className="text-xl font-bold">Certificate Verified</h1>
              <Badge variant="success">Authentic Web3tribe University Credential</Badge>
            </>
          )}

          <div className="space-y-2 rounded-lg border border-border bg-card p-6 text-left">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Award className="h-5 w-5 text-accent" />
              <span className="font-semibold">{cert.course_title_snapshot}</span>
            </div>
            <p className="text-sm">
              <span className="text-muted-foreground">Awarded to:</span> <strong>{cert.student_name_snapshot}</strong>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Instructor:</span> {cert.instructor_name_snapshot}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Issued:</span> {formatDate(cert.issued_at)}
            </p>
            {cert.final_score != null && (
              <p className="text-sm">
                <span className="text-muted-foreground">Final score:</span> {cert.final_score}%
              </p>
            )}
            <p className="text-xs font-mono text-muted-foreground">Certificate ID: {cert.certificate_code}</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}