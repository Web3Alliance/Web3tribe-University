"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Users, TrendingUp, FileText, CheckCircle, Clock } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"

interface TutorCourse {
  id: string
  title: string
  status: "published" | "pending" | "draft"
  enrollments: number
  revenue: number
  rating: number
  modules: number
}

export default function TutorPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalStudents, setTotalStudents] = useState(0)
  const [courses, setCourses] = useState<TutorCourse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const fetchTutorData = async () => {
      if (!user?.id) return

      try {
        // Fetch tutor stats
        const statsResponse = await fetch(`/api/tutor/stats?userId=${user.id}`)
        if (statsResponse.ok) {
          const stats = await statsResponse.json()
          setTotalRevenue(stats.totalRevenue)
          setTotalStudents(stats.totalStudents)
        }

        // Fetch tutor courses
        const supabase = createClient()
        const { data: coursesData } = await supabase
          .from('courses')
          .select('*')
          .eq('instructor_id', user.id)

        if (coursesData) {
          // Fetch enrollment counts for each course
          const coursesWithStats = await Promise.all(
            coursesData.map(async (course) => {
              const { count: enrollments } = await supabase
                .from('enrollments')
                .select('*', { count: 'exact', head: true })
                .eq('course_id', course.id)

              const { count: completions } = await supabase
                .from('certificates')
                .select('*', { count: 'exact', head: true })
                .eq('course_id', course.id)

              let revenue = 0
              if (completions) {
                if (course.price > 0) {
                  revenue = completions * course.price * 0.3
                } else {
                  revenue = completions * 0.2
                }
              }

              return {
                id: course.id,
                title: course.title,
                status: course.status,
                enrollments: enrollments || 0,
                revenue: Math.round(revenue * 100) / 100,
                rating: 0, // TODO: Implement ratings system
                modules: 0, // TODO: Get from course modules
              }
            })
          )

          setCourses(coursesWithStats)
        }
      } catch (error) {
        console.error('[v0] Error fetching tutor data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTutorData()
  }, [user?.id])

  const publishedCourses = courses.filter((c) => c.status === "published")
  const pendingCourses = courses.filter((c) => c.status === "pending")
  const draftCourses = courses.filter((c) => c.status === "draft")

  if (authLoading || !user) {
    return null
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Tutor Dashboard</h1>
            <p className="text-muted-foreground">Manage your courses and earnings</p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-secondary" />
                <div>
                  <div className="text-2xl font-bold">{loading ? '...' : totalRevenue.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">W3TR Earned</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-2xl font-bold">{loading ? '...' : totalStudents}</div>
                  <div className="text-xs text-muted-foreground">Total Students</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create Course Button */}
        <Button size="lg" className="w-full" asChild>
          <Link href="/tutor/create">
            <Plus className="mr-2 h-5 w-5" />
            Create New Course
          </Link>
        </Button>

        {/* Courses Tabs */}
        <Tabs defaultValue="published" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="published" className="flex-1">
              Published ({publishedCourses.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex-1">
              Pending ({pendingCourses.length})
            </TabsTrigger>
            <TabsTrigger value="draft" className="flex-1">
              Drafts ({draftCourses.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="published" className="space-y-3 mt-4">
            {publishedCourses.map((course) => (
              <Link key={course.id} href={`/tutor/courses/${course.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg leading-tight">{course.title}</CardTitle>
                      <Badge variant="secondary" className="flex-shrink-0">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Live
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs">Students</div>
                        <div className="font-medium">{course.enrollments}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Revenue</div>
                        <div className="font-medium text-secondary">{course.revenue} W3TR</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Rating</div>
                        <div className="font-medium">{course.rating}/5.0</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span>{course.modules} modules</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {publishedCourses.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No published courses yet</div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-3 mt-4">
            {pendingCourses.map((course) => (
              <Link key={course.id} href={`/tutor/courses/${course.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg leading-tight">{course.title}</CardTitle>
                      <Badge variant="outline" className="flex-shrink-0">
                        <Clock className="h-3 w-3 mr-1" />
                        Review
                      </Badge>
                    </div>
                    <CardDescription className="text-sm">Awaiting admin approval</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span>{course.modules} modules</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {pendingCourses.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No courses pending review</div>
            )}
          </TabsContent>

          <TabsContent value="draft" className="space-y-3 mt-4">
            {draftCourses.map((course) => (
              <Link key={course.id} href={`/tutor/courses/${course.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg leading-tight">{course.title}</CardTitle>
                      <Badge variant="outline" className="flex-shrink-0">
                        Draft
                      </Badge>
                    </div>
                    <CardDescription className="text-sm">Continue editing to publish</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span>{course.modules} modules</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {draftCourses.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No draft courses</div>
            )}
          </TabsContent>
        </Tabs>

        {/* Revenue Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tutor Rewards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground leading-relaxed">
              You earn W3TR tokens when students complete your courses. The reward is calculated based on course pricing
              and completion rates.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Free Course Completion</span>
                <Badge variant="secondary">0.2 W3TR</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Paid Course Revenue</span>
                <Badge variant="secondary">30% of price</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
