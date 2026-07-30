import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Users } from "lucide-react";
import type { Course } from "@/lib/types";

export function CourseCard({ course }: { course: Course }) {
  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <Link href={`/student/courses/${course.slug}`}>
        {course.thumbnail_url ? (
          <div className="relative aspect-video w-full">
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="aspect-video w-full bg-gradient-to-br from-primary/20 to-accent/20" />
        )}
      </Link>
      <CardHeader className="flex-1 pb-2">
        <div className="mb-1 flex flex-wrap gap-1">
          {course.category?.name && <Badge variant="secondary">{course.category.name}</Badge>}
          <Badge variant="outline" className="capitalize">
            {course.level.replace("_", " ")}
          </Badge>
        </div>
        <CardTitle className="line-clamp-2 text-base">
          <Link href={`/student/courses/${course.slug}`} className="hover:underline">
            {course.title}
          </Link>
        </CardTitle>
        <p className="line-clamp-2 text-sm text-muted-foreground">{course.subtitle}</p>
      </CardHeader>
      <CardContent className="flex items-center justify-between pt-0 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-accent text-accent" />
          {Number(course.average_rating).toFixed(1)} ({course.rating_count})
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {course.enrollment_count}
        </span>
        <span className="font-semibold text-foreground">
          {course.price_w3tr > 0 ? `${course.price_w3tr} W3TR` : "Free"}
        </span>
      </CardContent>
    </Card>
  );
}