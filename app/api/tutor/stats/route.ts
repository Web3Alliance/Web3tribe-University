import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get tutor's courses
    const { data: courses } = await supabase
      .from('courses')
      .select('id, price, status')
      .eq('instructor_id', userId)

    if (!courses || courses.length === 0) {
      return NextResponse.json({
        totalRevenue: 0,
        totalStudents: 0,
        publishedCourses: 0,
        pendingCourses: 0,
        draftCourses: 0,
      })
    }

    const courseIds = courses.map(c => c.id)

    // Get total enrollments across all courses
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id')
      .in('course_id', courseIds)

    const totalStudents = enrollments?.length || 0

    // Calculate total revenue (30% of course prices for paid completions)
    const { data: completions } = await supabase
      .from('certificates')
      .select('course_id')
      .in('course_id', courseIds)

    let totalRevenue = 0
    if (completions) {
      for (const completion of completions) {
        const course = courses.find(c => c.id === completion.course_id)
        if (course && course.price > 0) {
          totalRevenue += course.price * 0.3 // Tutor gets 30%
        } else {
          totalRevenue += 0.2 // Free course completion reward
        }
      }
    }

    // Count courses by status
    const publishedCourses = courses.filter(c => c.status === 'published').length
    const pendingCourses = courses.filter(c => c.status === 'pending').length
    const draftCourses = courses.filter(c => c.status === 'draft').length

    return NextResponse.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalStudents,
      publishedCourses,
      pendingCourses,
      draftCourses,
    })
  } catch (error) {
    console.error('[v0] Tutor stats API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tutor statistics' },
      { status: 500 }
    )
  }
}
