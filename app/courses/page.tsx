"use client"

import { useState, useEffect, useMemo, memo } from "react"
import { useRouter } from "next/navigation"
import { Search, Clock, Users } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Course } from "@/lib/mock-data"

// Memoize course card to prevent unnecessary re-renders
const CourseCard = memo(({ course }: { course: Course }) => (
  <Link key={course.id} href={`/courses/${course.id}`}>
    <Card className="hover:shadow-md transition-shadow">
      <div className="aspect-video w-full overflow-hidden rounded-t-lg">
        <img
          src={course.thumbnail || "/placeholder.svg"}
          alt={course.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge variant="secondary" className="text-xs">
            {course.category}
          </Badge>
          {course.isPaid ? (
            <Badge className="bg-accent text-accent-foreground text-xs">{course.price} W3TR</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Free
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg leading-tight">{course.title}</CardTitle>
        <CardDescription className="text-sm line-clamp-2">{course.description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{course.totalModules} modules</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{course.enrollmentCount.toLocaleString()}</span>
          </div>
        </div>
        <div className="mt-2 text-sm font-medium">{course.instructor}</div>
        <Badge variant="outline" className="mt-2 text-xs">
          {course.level}
        </Badge>
      </CardContent>
    </Card>
  </Link>
))
CourseCard.displayName = 'CourseCard'

export default function CoursesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("courses")
          .select("*")
          .eq("status", "published")

        if (error) throw error

        // Transform database courses to match Course type
        const transformedCourses: Course[] = (data || []).map((course: any) => ({
          id: course.id,
          title: course.title,
          description: course.description,
          category: course.category,
          level: course.level,
          modules: [],
          totalModules: 0,
          completedModules: 0,
          instructor: course.instructor_name,
          price: course.price,
          isPaid: course.price > 0,
          thumbnail: course.thumbnail_url || "/placeholder.svg?height=200&width=400",
          enrollmentCount: 0,
        }))

        setCourses(transformedCourses)
      } catch (error) {
        // Silent error
      } finally {
        setLoading(false)
      }
    }

    loadCourses()
  }, [])

  const categories = ["all", "Blockchain", "Software Development", "Data Analysis", "Cyber Security", "Hardware", "Artificial Intelligence", "Digital Marketing", "Graphic Design"]

  // Memoize filtered courses to prevent recalculation on every render
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch =
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory === "all" || course.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [courses, searchQuery, selectedCategory])

  if (authLoading || !user) {
    return null
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Search */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">Explore Courses</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="overflow-x-auto -mx-4 px-4">
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
            <TabsList className="w-full justify-start">
              {categories.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="capitalize">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Course Grid */}
        <div className="space-y-4">
          {loading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading courses...</p>
            </div>
          )}
          
          {!loading && filteredCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>

        {!loading && courses.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No courses available yet. Tutors can upload courses from the Tutor Dashboard.</p>
          </div>
        )}

        {!loading && courses.length > 0 && filteredCourses.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No courses found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  )
}
