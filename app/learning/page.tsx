"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Clock, Award } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { mockCourses } from "@/lib/mock-data"

export default function LearningPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
    }
  }, [user, authLoading, router])

  if (authLoading || !user) {
    return null
  }

  // Filter enrolled courses (for demo, showing first 3)
  const enrolledCourses = mockCourses.slice(0, 3)

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Learning</h1>
          <p className="text-muted-foreground">Continue where you left off</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-2xl font-bold">{enrolledCourses.length}</div>
                  <div className="text-xs text-muted-foreground">Active Courses</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Award className="h-5 w-5 text-secondary" />
                <div>
                  <div className="text-2xl font-bold">12</div>
                  <div className="text-xs text-muted-foreground">W3TR Earned</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enrolled Courses */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Continue Learning</h2>
          {enrolledCourses.map((course) => {
            const progress = (course.completedModules / course.totalModules) * 100
            return (
              <Link key={course.id} href={`/learning/${course.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {course.category}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {course.level}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg leading-tight">{course.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        {course.completedModules} of {course.totalModules} modules
                      </span>
                    </div>
                    <Progress value={progress} />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{Math.round(progress)}% complete</span>
                      <div className="flex items-center gap-1 text-sm text-secondary">
                        <Award className="h-4 w-4" />
                        <span>+{course.totalModules - course.completedModules} W3TR</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {enrolledCourses.length === 0 && (
          <div className="text-center py-12 space-y-4">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="text-lg font-medium mb-2">No enrolled courses yet</p>
              <p className="text-muted-foreground mb-4">Start learning and earning W3TR tokens</p>
              <Button asChild>
                <Link href="/courses">Browse Courses</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
