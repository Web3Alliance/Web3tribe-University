import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { course_id } = body

    // Check if already enrolled
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', course_id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Already enrolled in this course' },
        { status: 400 }
      )
    }

    // Get course details
    const { data: course } = await supabase
      .from('courses')
      .select('price, instructor_id')
      .eq('id', course_id)
      .single()

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    // If paid course, deduct W3TR tokens
    if (course.price > 0) {
      const { data: userData } = await supabase
        .from('users')
        .select('w3tr_balance')
        .eq('id', user.id)
        .single()

      if (!userData || userData.w3tr_balance < course.price) {
        return NextResponse.json({ error: 'Insufficient W3TR balance' }, { status: 400 })
      }

      // Deduct tokens from student
      await supabase
        .from('users')
        .update({ w3tr_balance: userData.w3tr_balance - course.price })
        .eq('id', user.id)

      // Add tokens to instructor
      await supabase.rpc('increment_user_balance', {
        user_id: course.instructor_id,
        amount: course.price * 0.7, // 70% to instructor
      })

      // Record transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'course_purchase',
        amount: -course.price,
        description: `Purchased course: ${course_id}`,
      })
    }

    // Create enrollment
    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .insert({
        user_id: user.id,
        course_id: course_id,
      })
      .select()
      .single()

    if (error) throw error

    // Send notification
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'course_enrollment',
      title: 'Course Enrollment Successful',
      message: 'You have successfully enrolled in the course. Start learning now!',
    })

    return NextResponse.json({ enrollment })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
