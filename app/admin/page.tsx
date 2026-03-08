"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Shield, CheckCircle, XCircle, Clock, Eye, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

interface Course {
  id: string
  title: string
  description: string
  category: string
  level: string
  status: string
  tutor_id: string
  tutor_name: string
  tutor_email: string
  total_modules: number
  created_at: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!profile) return

    if (!profile.is_admin) {
      toast({
        title: "Access Denied",
        description: "You don't have admin permissions",
        variant: "destructive",
      })
      router.push("/")
      return
    }

    fetchCourses()
  }, [profile])

  const fetchCourses = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          tutor:users!tutor_id(full_name, email)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const coursesWithTutorInfo = data.map((course: any) => ({
        ...course,
        tutor_name: course.tutor?.full_name || 'Unknown',
        tutor_email: course.tutor?.email || ''
      }))

      setCourses(coursesWithTutorInfo)
    } catch (error: any) {
      console.error('[v0] Error fetching courses:', error)
      toast({
        title: "Error loading courses",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (course: Course) => {
    setProcessing(true)
    try {
      const supabase = createClient()

      // Update course status
      const { error: updateError } = await supabase
        .from('courses')
        .update({ status: 'approved' })
        .eq('id', course.id)

      if (updateError) throw updateError

      // Create review record
      await supabase.from('course_reviews').insert({
        course_id: course.id,
        reviewer_id: user?.id,
        action: 'approved'
      })

      // Send approval email
      await fetch('/api/admin/notify-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorEmail: course.tutor_email,
          tutorName: course.tutor_name,
          courseTitle: course.title,
          action: 'approved'
        })
      })

      toast({
        title: "Course Approved",
        description: "The tutor has been notified",
      })

      fetchCourses()
    } catch (error: any) {
      console.error('[v0] Error approving course:', error)
      toast({
        title: "Error approving course",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedCourse || !rejectionReason.trim()) {
      toast({
        title: "Rejection reason required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    try {
      const supabase = createClient()

      // Update course status and add rejection reason
      const { error: updateError } = await supabase
        .from('courses')
        .update({ 
          status: 'rejected',
          rejection_reason: rejectionReason
        })
        .eq('id', selectedCourse.id)

      if (updateError) throw updateError

      // Create review record
      await supabase.from('course_reviews').insert({
        course_id: selectedCourse.id,
        reviewer_id: user?.id,
        action: 'rejected',
        reason: rejectionReason
      })

      // Send rejection email
      await fetch('/api/admin/notify-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorEmail: selectedCourse.tutor_email,
          tutorName: selectedCourse.tutor_name,
          courseTitle: selectedCourse.title,
          action: 'rejected',
          reason: rejectionReason
        })
      })

      toast({
        title: "Course Rejected",
        description: "The tutor has been notified with the reason",
      })

      setShowRejectDialog(false)
      setRejectionReason("")
      setSelectedCourse(null)
      fetchCourses()
    } catch (error: any) {
      console.error('[v0] Error rejecting course:', error)
      toast({
        title: "Error rejecting course",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const CourseCard = ({ course }: { course: Course }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{course.title}</CardTitle>
            <CardDescription className="mt-1">
              by {course.tutor_name} • {course.category} • {course.level}
            </CardDescription>
          </div>
          <Badge variant={
            course.status === 'approved' ? 'default' : 
            course.status === 'rejected' ? 'destructive' : 
            'secondary'
          }>
            {course.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {course.description}
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{course.total_modules} modules</span>
          <span>•</span>
          <span>{new Date(course.created_at).toLocaleDateString()}</span>
        </div>
        {course.status === 'pending' && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => handleApprove(course)}
              disabled={processing}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => {
                setSelectedCourse(course)
                setShowRejectDialog(true)
              }}
              disabled={processing}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-full bg-transparent"
          onClick={() => router.push(`/courses/${course.id}`)}
        >
          <Eye className="h-4 w-4 mr-2" />
          View Details
        </Button>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile?.is_admin) {
    return null
  }

  const pendingCourses = courses.filter(c => c.status === 'pending')
  const approvedCourses = courses.filter(c => c.status === 'approved')
  const rejectedCourses = courses.filter(c => c.status === 'rejected')

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Course Review & Management</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 text-center">
              <Clock className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
              <div className="text-xl font-bold">{pendingCourses.length}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <div className="text-xl font-bold">{approvedCourses.length}</div>
              <div className="text-xs text-muted-foreground">Approved</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <XCircle className="h-5 w-5 mx-auto mb-1 text-red-500" />
              <div className="text-xl font-bold">{rejectedCourses.length}</div>
              <div className="text-xs text-muted-foreground">Rejected</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              Pending ({pendingCourses.length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved ({approvedCourses.length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({rejectedCourses.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3 mt-4">
            {pendingCourses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No pending courses to review
                </CardContent>
              </Card>
            ) : (
              pendingCourses.map(course => (
                <CourseCard key={course.id} course={course} />
              ))
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-3 mt-4">
            {approvedCourses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No approved courses yet
                </CardContent>
              </Card>
            ) : (
              approvedCourses.map(course => (
                <CourseCard key={course.id} course={course} />
              ))
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-3 mt-4">
            {rejectedCourses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No rejected courses
                </CardContent>
              </Card>
            ) : (
              rejectedCourses.map(course => (
                <CourseCard key={course.id} course={course} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Course</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting "{selectedCourse?.title}". 
              This will be sent to the tutor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Rejection Reason</Label>
            <Textarea
              id="reason"
              placeholder="Explain why this course doesn't meet our standards..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false)
                setRejectionReason("")
                setSelectedCourse(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing || !rejectionReason.trim()}
            >
              {processing ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Rejecting...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Rejection
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
