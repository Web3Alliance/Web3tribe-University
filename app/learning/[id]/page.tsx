"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, ChevronRight, Award } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { mockCourses } from "@/lib/mock-data"

export default function LearningCoursePage() {
  const params = useParams()
  const [selectedModule, setSelectedModule] = useState<string | null>(null)

  const course = mockCourses.find((c) => c.id === params.id)

  if (!course) {
    return (
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
        <p className="text-center text-muted-foreground">Course not found</p>
      </div>
    )
  }

  const progress = (course.completedModules / course.totalModules) * 100
  const currentModule = selectedModule ? course.modules.find((m) => m.id === selectedModule) : course.modules[0]

  const handleCompleteModule = () => {
    // In a real app, this would update the backend
    console.log("[v0] Module completed, awarding 1 W3TR token")
    // Move to next module or completion screen
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/learning">
            <ArrowLeft className="h-4 w-4 mr-2" />
            My Learning
          </Link>
        </Button>

        {/* Course Progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{course.title}</CardTitle>
            <CardDescription>{course.instructor}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>
                {course.completedModules} of {course.totalModules} modules
              </span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </CardContent>
        </Card>

        {/* Module List */}
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Modules</h2>
          <div className="space-y-2">
            {course.modules.map((module) => (
              <Card
                key={module.id}
                className={`cursor-pointer transition-all ${
                  selectedModule === module.id ? "ring-2 ring-primary" : ""
                } ${module.locked ? "opacity-60" : "hover:shadow-md"}`}
                onClick={() => !module.locked && setSelectedModule(module.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {module.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-secondary" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{module.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{module.duration}</div>
                    </div>
                    {!module.completed && !module.locked && (
                      <Badge variant="secondary" className="text-xs">
                        +1 W3TR
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Current Module Content */}
        {currentModule && !currentModule.locked && (
          <Card className="bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">Now Learning: {currentModule.title}</CardTitle>
              <CardDescription>Watch the video and complete the quiz to earn 1 W3TR</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Video placeholder */}
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">Video Player</p>
              </div>

              {/* Complete Button */}
              {!currentModule.completed && (
                <Button size="lg" className="w-full" onClick={handleCompleteModule}>
                  <Award className="mr-2 h-5 w-5" />
                  Complete & Earn 1 W3TR
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
