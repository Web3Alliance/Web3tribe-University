import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/rbac";
import { generateCertificatePdf } from "@/lib/certificate";

interface GenerateCertBody {
  courseId: string;
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { courseId } = (await request.json()) as GenerateCertBody;
  const supabase = await createClient();

  const [{ data: enrollment }, { data: course }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("*")
      .eq("student_id", profile.id)
      .eq("course_id", courseId)
      .single(),
    supabase.from("courses").select("*, instructor:profiles!courses_instructor_id_fkey(full_name)").eq("id", courseId).single(),
  ]);

  if (!enrollment || enrollment.status !== "completed") {
    return NextResponse.json({ data: null, error: "Course not yet completed." }, { status: 400 });
  }
  if (!course) return NextResponse.json({ data: null, error: "Course not found." }, { status: 404 });

  const { data: existing } = await supabase
    .from("certificates")
    .select("*")
    .eq("student_id", profile.id)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ data: existing, error: null });
  }

  const { data: created, error: insertError } = await supabase
    .from("certificates")
    .insert({
      student_id: profile.id,
      course_id: courseId,
      enrollment_id: enrollment.id,
      instructor_name_snapshot: (course.instructor as { full_name?: string } | { full_name?: string }[] | null) instanceof Array
        ? (course.instructor as { full_name?: string }[])[0]?.full_name
        : (course.instructor as { full_name?: string } | null)?.full_name,
      course_title_snapshot: course.title,
      student_name_snapshot: profile.full_name,
    })
    .select()
    .single();

  if (insertError || !created) {
    return NextResponse.json({ data: null, error: insertError?.message ?? "Failed to create certificate." }, { status: 500 });
  }

  const verificationUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/verify/${created.certificate_code}`;
  const pdfBytes = await generateCertificatePdf({
    studentName: profile.full_name ?? "Student",
    courseTitle: course.title,
    instructorName: created.instructor_name_snapshot ?? "Instructor",
    certificateCode: created.certificate_code,
    issuedAt: new Date(created.issued_at),
    verificationUrl,
  });

  const admin = createAdminClient();
  const filePath = `certificates/${created.certificate_code}.pdf`;
  const { error: uploadError } = await admin.storage.from("certificates").upload(filePath, Buffer.from(pdfBytes), {
    contentType: "application/pdf",
    upsert: true,
  });

  if (!uploadError) {
    const { data: publicUrl } = admin.storage.from("certificates").getPublicUrl(filePath);
    await supabase
      .from("certificates")
      .update({ pdf_url: publicUrl.publicUrl, qr_verification_url: verificationUrl })
      .eq("id", created.id);
  }

  return NextResponse.json({ data: created, error: null });
}
