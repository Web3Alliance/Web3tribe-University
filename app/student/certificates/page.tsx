import Link from "next/link";
import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Download, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Certificates" };

export default async function CertificatesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: certificates } = await supabase
    .from("certificates")
    .select("*, course:courses(title,thumbnail_url)")
    .eq("student_id", profile!.id)
    .order("issued_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Certificates</h1>
        <p className="text-muted-foreground">Verifiable proof of the skills you&apos;ve completed.</p>
      </div>

      {(certificates ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Award className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Complete a course to earn your first certificate.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(certificates ?? []).map((cert) => (
            <Card key={cert.id}>
              <CardContent className="space-y-3 p-6">
                <Award className="h-8 w-8 text-accent" />
                <div>
                  <p className="font-semibold">{cert.course_title_snapshot ?? cert.course?.title}</p>
                  <p className="text-xs text-muted-foreground">Issued {formatDate(cert.issued_at)}</p>
                  <p className="text-xs font-mono text-muted-foreground">Code: {cert.certificate_code}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild className="flex-1">
                    <a href={cert.pdf_url ?? "#"} download>
                      <Download className="h-3.5 w-3.5" /> PDF
                    </a>
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/verify/${cert.certificate_code}`} target="_blank">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
