import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EnrollButton, WishlistButton } from "@/components/course/enroll-button";
import { CourseResourcesList } from "@/components/course/course-resources-list";
import { CertificateClaimButton } from "@/components/course/certificate-claim-button";
import { Star, Users, Clock, PlayCircle, FileText, Lock, MessageSquare } from "lucide-react";
import { initials } from "@/lib/utils";

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: course } = await supabase
    .from("courses")
    .select("*, category:categories(name), instructor:profiles!courses_instructor_id_fkey(id,full_name,avatar_url,username)")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!course) notFound();

  const [{ data: sections }, { data: resources }] = await Promise.all([
    supabase
      .from("course_sections")
      .select("*, lessons(id,title,content_type,duration_seconds,is_preview,display_order)")
      .eq("course_id", course.id)
      .order("display_order"),
    supabase.from("course_resources").select("*").eq("course_id", course.id).order("display_order"),
  ]);

  let isEnrolled = false;
  let isActive = false;
  let isWishlisted = false;
  let isCompleted = false;
  let hasCertificate = false;

  if (profile) {
    const [{ data: enrollment }, { data: wish }] = await Promise.all([
      supabase.from("enrollments").select("id,status").eq("student_id", profile.id).eq("course_id", course.id).maybeSingle(),
      supabase.from("wishlists").select("id").eq("student_id", profile.id).eq("course_id", course.id).maybeSingle(),
    ]);
    // A dropped enrollment shouldn't count as "enrolled" — otherwise a
    // student who drops a course could never see the "Enroll Now" button
    // again to re-join it later if they change their mind.
    isEnrolled = !!enrollment && enrollment.status !== "dropped";
    isActive = enrollment?.status === "active";
    isWishlisted = !!wish;
    isCompleted = enrollment?.status === "completed";

    if (isCompleted) {
      const { data: cert } = await supabase
        .from("certificates")
        .select("id")
        .eq("student_id", profile.id)
        .eq("course_id", course.id)
        .maybeSingle();
      hasCertificate = !!cert;
    }
  }

  interface LessonSummary {
    id: string;
    title: string;
    content_type: string;
    duration_seconds: number;
    is_preview: boolean;
    display_order: number;
  }

  const firstLesson = (sections?.[0]?.lessons as LessonSummary[] | undefined)?.sort(
    (a, b) => a.display_order - b.display_order
  )[0];
  const totalLessons = (sections ?? []).reduce((sum, s) => sum + (s.lessons?.length ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            {course.category?.name && <Badge variant="secondary">{course.category.name}</Badge>}
            <Badge variant="outline" className="capitalize">
              {course.level.replace("_", " ")}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold">{course.title}</h1>
          <p className="text-lg text-muted-foreground">{course.subtitle}</p>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-accent text-accent" />
              {Number(course.average_rating).toFixed(1)} ({course.rating_count} ratings)
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" /> {course.enrollment_count} students
            </span>
            {course.estimated_hours && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" /> {course.estimated_hours}h
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Avatar>
              <AvatarImage src={course.instructor?.avatar_url ?? undefined} />
              <AvatarFallback>{initials(course.instructor?.full_name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{course.instructor?.full_name}</p>
              <p className="text-xs text-muted-foreground">Instructor</p>
            </div>
          </div>

          {course.description && (
            <div className="prose prose-sm dark:prose-invert max-w-none pt-4">
              <p>{course.description}</p>
            </div>
          )}

          {course.learning_outcomes?.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="mb-3 font-semibold">What you&apos;ll learn</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {course.learning_outcomes.map((o: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-success">✓</span> {o}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div>
            <h3 className="mb-3 font-semibold">Course content · {totalLessons} lessons</h3>
            <Accordion type="multiple" className="rounded-lg border border-border">
              {(sections ?? []).map((section) => (
                <AccordionItem key={section.id} value={section.id} className="px-4">
                  <AccordionTrigger>{section.title}</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2">
                      {(section.lessons ?? [])
                        .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
                        .map((lesson: { id: string; title: string; content_type: string; is_preview: boolean; duration_seconds: number }) => (
                          <li key={lesson.id} className="flex items-center justify-between text-sm text-muted-foreground">
                            <span className="flex items-center gap-2">
                              {lesson.content_type === "video" ? (
                                <PlayCircle className="h-4 w-4" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                              {lesson.title}
                              {lesson.is_preview && <Badge variant="outline">Preview</Badge>}
                            </span>
                            {!lesson.is_preview && !isEnrolled && <Lock className="h-3.5 w-3.5" />}
                          </li>
                        ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {isEnrolled && <CourseResourcesList resources={resources ?? []} />}
          {isEnrolled && (
            <Button variant="outline" asChild className="w-full">
              <Link href={`/student/courses/${course.slug}/discussion`}>
                <MessageSquare className="h-4 w-4" /> Go to course discussion
              </Link>
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <Card className="sticky top-20">
            {course.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- course covers come from arbitrary instructor-uploaded Supabase Storage URLs
              <img
                src={course.thumbnail_url}
                alt={course.title}
                className="aspect-video w-full rounded-t-xl object-cover"
              />
            ) : (
              <div className="aspect-video w-full rounded-t-xl bg-gradient-to-br from-primary/30 to-accent/30" />
            )}
            <CardContent className="space-y-4 p-6">
              <p className="text-2xl font-bold">{course.price_w3tr > 0 ? `${course.price_w3tr} W3TR` : "Free"}</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <EnrollButton
                    courseId={course.id}
                    courseSlug={course.slug}
                    isEnrolled={isEnrolled}
                    isActive={isActive}
                    firstLessonId={firstLesson?.id}
                  />
                </div>
                <WishlistButton courseId={course.id} courseSlug={course.slug} isWishlisted={isWishlisted} />
              </div>

              {isCompleted && (
                <CertificateClaimButton courseId={course.id} alreadyIssued={hasCertificate} />
              )}

              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>{totalLessons} lessons</li>
                <li className="capitalize">{course.level.replace("_", " ")} level</li>
                <li>Certificate on completion</li>
                <li>Earn W3TR as you learn</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}