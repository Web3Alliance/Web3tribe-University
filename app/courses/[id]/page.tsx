"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Clock, Users, Award, Lock, CheckCircle2, Play, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { mockCourses } from "@/lib/mock-data"
import Link from "next/link"

export default function CourseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [enrolled, setEnrolled] = useState(false)

  const course = mockCourses.find((c) => c.id === params.id)

  if (!course) {
    return (
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
        <p className="text-center text-muted-foreground">Course not found</p>
      </div>
    )
  }

  const progress = (course.completedModules / course.totalModules) * 100

  const handleEnroll = () => {
    if (course.isPaid) {
      // Navigate to payment
      router.push(`/courses/${course.id}/payment`)
    } else {
      setEnrolled(true)
    }
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/courses">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Link>
        </Button>

        {/* Course Header */}
        <div className="space-y-4">
          <div className="aspect-video w-full overflow-hidden rounded-lg">
            <img
              src={course.thumbnail || "/placeholder.svg"}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{course.category}</Badge>
              <Badge variant="outline">{course.level}</Badge>
              {course.isPaid ? (
                <Badge className="bg-accent text-accent-foreground">{course.price} W3TR</Badge>
              ) : (
                <Badge variant="outline">Free</Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold leading-tight">{course.title}</h1>
            <p className="text-muted-foreground leading-relaxed">{course.description}</p>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{course.totalModules} modules</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{course.enrollmentCount.toLocaleString()} enrolled</span>
            </div>
          </div>

          <div className="text-sm">
            <span className="text-muted-foreground">Instructor: </span>
            <span className="font-medium">{course.instructor}</span>
          </div>
        </div>

        {/* Progress Card */}
        {enrolled && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {course.completedModules} of {course.totalModules} modules completed
                </span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
              <div className="flex items-center gap-2 text-sm text-secondary">
                <Award className="h-4 w-4" />
                <span>Earn {course.totalModules} W3TR tokens upon completion</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modules */}
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Course Modules</h2>
          <div className="space-y-2">
            {course.modules.map((module, index) => (
              <Card key={module.id} className={module.locked && !enrolled ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {module.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-secondary" />
                      ) : module.locked && !enrolled ? (
                        <Lock className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Play className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm leading-tight">{module.title}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                        <span>{module.duration}</span>
                        {!module.locked && enrolled && (
                          <Badge variant="secondary" className="text-xs">
                            +1 W3TR
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Enroll Button */}
        {!enrolled && (
          <Button size="lg" className="w-full" onClick={handleEnroll}>
            {course.isPaid ? `Enroll for ${course.price} W3TR` : "Enroll for Free"}
          </Button>
        )}

        {enrolled && (
          <div className="space-y-2">
            <Button size="lg" className="w-full" asChild>
              <Link href={`/learning/${course.id}`}>Continue Learning</Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full bg-transparent" asChild>
              <Link href={`/courses/${course.id}/forum`}>
                <MessageCircle className="h-4 w-4 mr-2" />
                Classroom Forum
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
