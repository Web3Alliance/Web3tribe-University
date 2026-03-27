"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Trash2, Upload, FileText, Video, X } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"

interface Module {
  id: string
  title: string
  duration: string
  pdfFile?: File | null
  videoFile?: File | null
  txtFile?: File | null
  docxFile?: File | null
  pdfUrl?: string
  videoUrl?: string
  txtUrl?: string
  docxUrl?: string
}

export default function CreateCoursePage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [uploadingModule, setUploadingModule] = useState<string | null>(null)

  const [courseData, setCourseData] = useState({
    title: "",
    description: "",
    category: "",
    level: "",
    isPaid: false,
    price: 0,
    thumbnailFile: null as File | null,
  })

  const [modules, setModules] = useState<Module[]>([{ 
    id: "1", 
    title: "", 
    duration: "",
    pdfFile: null,
    videoFile: null
  }])

  const addModule = () => {
    setModules([...modules, { 
      id: Date.now().toString(), 
      title: "", 
      duration: "",
      pdfFile: null,
      videoFile: null
    }])
  }

  const removeModule = (id: string) => {
    setModules(modules.filter((m) => m.id !== id))
  }

  const updateModule = (id: string, field: keyof Module, value: any) => {
    setModules(modules.map((m) => (m.id === id ? { ...m, [field]: value } : m)))
  }

  const handlePdfUpload = (moduleId: string, file: File) => {
    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file",
        variant: "destructive",
      })
      return
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast({
        title: "File too large",
        description: "PDF must be less than 50MB",
        variant: "destructive",
      })
      return
    }

    updateModule(moduleId, 'pdfFile', file)
  }

  const handleVideoUpload = (moduleId: string, file: File) => {
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg']
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload MP4, WebM, or OGG video",
        variant: "destructive",
      })
      return
    }

    if (file.size > 500 * 1024 * 1024) { // 500MB limit
      toast({
        title: "File too large",
        description: "Video must be less than 500MB",
        variant: "destructive",
      })
      return
    }

    updateModule(moduleId, 'videoFile', file)
  }

  const handleTxtUpload = (moduleId: string, file: File) => {
    if (file.type !== 'text/plain') {
      toast({
        title: "Invalid file type",
        description: "Please upload a TXT file",
        variant: "destructive",
      })
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File too large",
        description: "Text file must be less than 10MB",
        variant: "destructive",
      })
      return
    }

    updateModule(moduleId, 'txtFile', file)
  }

  const handleDocxUpload = (moduleId: string, file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ]
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a DOCX file",
        variant: "destructive",
      })
      return
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast({
        title: "File too large",
        description: "Document must be less than 50MB",
        variant: "destructive",
      })
      return
    }

    updateModule(moduleId, 'docxFile', file)
  }

  const uploadFileToStorage = async (file: File, bucket: string, path: string): Promise<string | null> => {
    const supabase = createClient()
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('[v0] Upload error:', error)
      return null
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path)

    return urlData.publicUrl
  }

  const handleSubmit = async () => {
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to create a course",
        variant: "destructive",
      })
      return
    }

    if (!courseData.title || !courseData.description || !courseData.category || !courseData.level) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    if (modules.some((m) => !m.title || !m.duration)) {
      toast({
        title: "Incomplete modules",
        description: "Please complete all module details",
        variant: "destructive",
      })
      return
    }

    setUploading(true)

    try {
      const supabase = createClient()

      // 1. Create course
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .insert({
          tutor_id: user.id,
          title: courseData.title,
          description: courseData.description,
          category: courseData.category,
          level: courseData.level,
          price: courseData.isPaid ? courseData.price : 0,
          is_free: !courseData.isPaid,
          status: 'pending',
          total_modules: modules.length
        })
        .select()
        .single()

      if (courseError) throw courseError

      // 2. Upload files and create modules
      for (let i = 0; i < modules.length; i++) {
        const module = modules[i]
        setUploadingModule(module.id)

        let pdfUrl = null
        let videoUrl = null
        let txtUrl = null
        let docxUrl = null

        // Upload PDF if exists
        if (module.pdfFile) {
          const pdfPath = `courses/${course.id}/modules/${module.id}/${module.pdfFile.name}`
          pdfUrl = await uploadFileToStorage(module.pdfFile, 'course-materials', pdfPath)
        }

        // Upload video if exists
        if (module.videoFile) {
          const videoPath = `courses/${course.id}/modules/${module.id}/${module.videoFile.name}`
          videoUrl = await uploadFileToStorage(module.videoFile, 'course-materials', videoPath)
        }

        // Upload TXT if exists
        if (module.txtFile) {
          const txtPath = `courses/${course.id}/modules/${module.id}/${module.txtFile.name}`
          txtUrl = await uploadFileToStorage(module.txtFile, 'course-materials', txtPath)
        }

        // Upload DOCX if exists
        if (module.docxFile) {
          const docxPath = `courses/${course.id}/modules/${module.id}/${module.docxFile.name}`
          docxUrl = await uploadFileToStorage(module.docxFile, 'course-materials', docxPath)
        }

        // Create module in database
        const { error: moduleError } = await supabase
          .from('modules')
          .insert({
            course_id: course.id,
            title: module.title,
            duration_minutes: parseInt(module.duration) || 0,
            order_index: i,
            pdf_url: pdfUrl,
            video_file_url: videoUrl,
            txt_file_url: txtUrl,
            docx_file_url: docxUrl,
            pdf_filename: module.pdfFile?.name,
            video_filename: module.videoFile?.name,
            txt_filename: module.txtFile?.name,
            docx_filename: module.docxFile?.name,
            reward_w3tr: 1.0
          })

        if (moduleError) throw moduleError
      }

      toast({
        title: "Course created successfully",
        description: "Your course has been submitted for review",
      })

      router.push("/tutor")
    } catch (error: any) {
      console.error('[v0] Error creating course:', error)
      toast({
        title: "Error creating course",
        description: error.message || "Please try again",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      setUploadingModule(null)
    }
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/tutor">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>

        <div>
          <h1 className="text-3xl font-bold mb-2">Create New Course</h1>
          <p className="text-muted-foreground">Share your knowledge and earn W3TR tokens</p>
        </div>

        {/* Course Details */}
        <Card>
          <CardHeader>
            <CardTitle>Course Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Course Title</Label>
              <Input
                id="title"
                placeholder="e.g., Introduction to Blockchain"
                value={courseData.title}
                onChange={(e) => setCourseData({ ...courseData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What will students learn in this course?"
                value={courseData.description}
                onChange={(e) => setCourseData({ ...courseData, description: e.target.value })}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={courseData.category}
                  onValueChange={(value) => setCourseData({ ...courseData, category: value })}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Blockchain">Blockchain</SelectItem>
                    <SelectItem value="Software Development">Software Development</SelectItem>
                    <SelectItem value="Data Analysis">Data Analysis</SelectItem>
                    <SelectItem value="Cyber Security">Cyber Security</SelectItem>
                    <SelectItem value="Hardware">Hardware</SelectItem>
                    <SelectItem value="Artificial Intelligence">Artificial Intelligence</SelectItem>
                    <SelectItem value="Digital Marketing">Digital Marketing</SelectItem>
                    <SelectItem value="Graphic Design">Graphic Design</SelectItem>
                    <SelectItem value="Development">Development</SelectItem>
                    <SelectItem value="DeFi">DeFi</SelectItem>
                    <SelectItem value="NFTs">NFTs</SelectItem>
                    <SelectItem value="Security">Security</SelectItem>
                    <SelectItem value="Economics">Economics</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="level">Level</Label>
                <Select
                  value={courseData.level}
                  onValueChange={(value) => setCourseData({ ...courseData, level: value })}
                >
                  <SelectTrigger id="level">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Set a price or offer it for free</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Paid Course</Label>
                <p className="text-sm text-muted-foreground">Students pay W3TR to enroll</p>
              </div>
              <Switch
                checked={courseData.isPaid}
                onCheckedChange={(checked) => setCourseData({ ...courseData, isPaid: checked })}
              />
            </div>

            {courseData.isPaid && (
              <div className="space-y-2">
                <Label htmlFor="price">Price (W3TR)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={courseData.price || ""}
                  onChange={(e) => setCourseData({ ...courseData, price: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">You will earn 30% of the course price per enrollment</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modules */}
        <Card>
          <CardHeader>
            <CardTitle>Course Modules</CardTitle>
            <CardDescription>Add modules with learning materials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {modules.map((module, index) => (
              <div key={module.id} className="space-y-3 p-4 border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Module {index + 1}</Label>
                  {modules.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeModule(module.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Module Title */}
                <div className="space-y-2">
                  <Label htmlFor={`module-title-${module.id}`}>Module Title</Label>
                  <Input
                    id={`module-title-${module.id}`}
                    placeholder="e.g., Introduction to Smart Contracts"
                    value={module.title}
                    onChange={(e) => updateModule(module.id, "title", e.target.value)}
                  />
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <Label htmlFor={`module-duration-${module.id}`}>Duration (minutes)</Label>
                  <Input
                    id={`module-duration-${module.id}`}
                    type="number"
                    placeholder="e.g., 30"
                    value={module.duration}
                    onChange={(e) => updateModule(module.id, "duration", e.target.value)}
                  />
                </div>

                {/* PDF Upload */}
                <div className="space-y-2">
                  <Label htmlFor={`pdf-${module.id}`}>PDF Materials (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`pdf-${module.id}`}
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handlePdfUpload(module.id, file)
                      }}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById(`pdf-${module.id}`)?.click()}
                      className="w-full bg-transparent"
                      disabled={uploading}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {module.pdfFile ? module.pdfFile.name : 'Upload PDF'}
                    </Button>
                    {module.pdfFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => updateModule(module.id, 'pdfFile', null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {module.pdfFile && (
                    <p className="text-xs text-muted-foreground">
                      {(module.pdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                </div>

                {/* Video Upload */}
                <div className="space-y-2">
                  <Label htmlFor={`video-${module.id}`}>Video Lesson (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`video-${module.id}`}
                      type="file"
                      accept="video/mp4,video/webm,video/ogg"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleVideoUpload(module.id, file)
                      }}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById(`video-${module.id}`)?.click()}
                      className="w-full bg-transparent"
                      disabled={uploading}
                    >
                      <Video className="h-4 w-4 mr-2" />
                      {module.videoFile ? module.videoFile.name : 'Upload Video'}
                    </Button>
                    {module.videoFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => updateModule(module.id, 'videoFile', null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {module.videoFile && (
                    <p className="text-xs text-muted-foreground">
                      {(module.videoFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Supported formats: MP4, WebM, OGG (Max 500MB)
                  </p>
                </div>

                {uploadingModule === module.id && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Uploading files...
                  </div>
                )}
              </div>
            ))}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={addModule} 
              className="w-full bg-transparent"
              disabled={uploading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Module
            </Button>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="space-y-3">
          <Button 
            size="lg" 
            className="w-full" 
            onClick={handleSubmit}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating Course...
              </>
            ) : (
              'Submit for Review'
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Your course will be reviewed by our team before going live
          </p>
        </div>
      </div>
    </div>
  )
}
