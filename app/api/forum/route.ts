import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get("courseId")

    if (!courseId) {
      return NextResponse.json(
        { error: "Course ID is required" },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: messages, error } = await supabase
      .from("forum_messages")
      .select(`
        *,
        users:user_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq("course_id", courseId)
      .order("created_at", { ascending: true })

    if (error) throw error

    return NextResponse.json({ messages })
  } catch (error) {
    console.error("Error fetching forum messages:", error)
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { courseId, message } = await request.json()

    if (!courseId || !message) {
      return NextResponse.json(
        { error: "Course ID and message are required" },
        { status: 400 },
      )
    }

    // Check if user is enrolled in the course
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .single()

    if (!enrollment) {
      return NextResponse.json(
        { error: "You must be enrolled in this course to post" },
        { status: 403 },
      )
    }

    const { data: newMessage, error } = await supabase
      .from("forum_messages")
      .insert({
        course_id: courseId,
        user_id: user.id,
        message,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ message: newMessage })
  } catch (error) {
    console.error("Error posting forum message:", error)
    return NextResponse.json(
      { error: "Failed to post message" },
      { status: 500 },
    )
  }
}
