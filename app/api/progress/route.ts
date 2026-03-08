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
    const { course_id, module_id } = body

    // Check enrollment
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', course_id)
      .single()

    if (!enrollment) {
      return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 400 })
    }

    // Check if already completed
    const { data: existing } = await supabase
      .from('module_progress')
      .select('id')
      .eq('enrollment_id', enrollment.id)
      .eq('module_id', module_id)
      .single()

    if (existing) {
      return NextResponse.json(
        { message: 'Module already completed' },
        { status: 200 }
      )
    }

    // Mark module as completed
    await supabase.from('module_progress').insert({
      enrollment_id: enrollment.id,
      module_id: module_id,
      completed: true,
    })

    // Award 1 W3TR token
    await supabase.rpc('increment_user_balance', {
      user_id: user.id,
      amount: 1,
    })

    // Record transaction
    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'module_completion',
      amount: 1,
      description: `Completed module: ${module_id}`,
    })

    // Send notification
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'token_earned',
      title: 'Module Completed!',
      message: 'You earned 1 W3TR token for completing this module.',
    })

    // Check if all modules completed for certificate
    const { data: courseModules } = await supabase
      .from('course_modules')
      .select('id')
      .eq('course_id', course_id)

    const { data: completedModules } = await supabase
      .from('module_progress')
      .select('module_id')
      .eq('enrollment_id', enrollment.id)

    if (
      courseModules &&
      completedModules &&
      completedModules.length + 1 === courseModules.length
    ) {
      // All modules completed - generate certificate
      const { data: certificate } = await supabase
        .from('certificates')
        .insert({
          user_id: user.id,
          course_id: course_id,
          status: 'pending',
        })
        .select()
        .single()

      // Send notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'certificate_ready',
        title: 'Course Completed!',
        message: 'Congratulations! Your certificate is being generated.',
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
