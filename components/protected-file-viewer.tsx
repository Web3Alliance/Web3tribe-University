"use client"

import { useState, useEffect } from "react"
import { FileText, File, Download } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

interface ProtectedFileViewerProps {
  fileUrl: string | null
  fileName: string | null
  fileType: 'pdf' | 'txt' | 'docx' | 'video'
  moduleId: string
  courseId: string
}

export function ProtectedFileViewer({ 
  fileUrl, 
  fileName, 
  fileType,
  moduleId,
  courseId 
}: ProtectedFileViewerProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (fileUrl && fileType === 'txt') {
      loadTextContent()
    }
  }, [fileUrl, fileType])

  const loadTextContent = async () => {
    if (!fileUrl) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(fileUrl)
      if (!response.ok) throw new Error('Failed to load file')
      
      const text = await response.text()
      setContent(text)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!fileUrl) return null

  // PDF Viewer (Embedded, no download)
  if (fileType === 'pdf') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            {fileName || 'PDF Document'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
            <iframe
              src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              className="w-full h-full"
              title={fileName || 'PDF Document'}
              style={{ border: 'none' }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Protected content - Downloads disabled
          </p>
        </CardContent>
      </Card>
    )
  }

  // Text File Viewer (Read-only)
  if (fileType === 'txt') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            {fileName || 'Text Document'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-sm text-destructive py-4">{error}</div>
          ) : (
            <div className="border rounded-lg p-4 bg-muted/30 max-h-96 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-mono select-text">
                {content}
              </pre>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Protected content - Read-only mode
          </p>
        </CardContent>
      </Card>
    )
  }

  // Document Viewer (Info only, requires download to view fully)
  if (fileType === 'docx') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <File className="h-5 w-5" />
            {fileName || 'Word Document'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border rounded-lg p-6 text-center bg-muted/30">
            <File className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium mb-1">{fileName}</p>
            <p className="text-sm text-muted-foreground">
              Word document available for viewing
            </p>
          </div>
          <Button 
            className="w-full bg-transparent" 
            variant="outline"
            onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')}
          >
            <File className="h-4 w-4 mr-2" />
            Open in New Tab
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Protected content - View only access
          </p>
        </CardContent>
      </Card>
    )
  }

  // Video Player (Embedded, controls disabled for download)
  if (fileType === 'video') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Video Lesson
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <video
              src={fileUrl}
              controls
              controlsList="nodownload"
              disablePictureInPicture
              className="w-full"
              style={{ maxHeight: '400px' }}
            >
              Your browser does not support the video tag.
            </video>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Protected content - Streaming only
          </p>
        </CardContent>
      </Card>
    )
  }

  return null
}
