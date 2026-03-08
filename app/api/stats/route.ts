import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get total courses count
    const { count: coursesCount } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')

    // Get total users count
    const { count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    // Get total W3TR tokens distributed
    const { data: tokenData } = await supabase
      .from('users')
      .select('w3tr_balance')

    const totalTokensEarned = tokenData?.reduce((sum, user) => sum + (user.w3tr_balance || 0), 0) || 0

    // Get total enrollments
    const { count: enrollmentsCount } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      courses: coursesCount || 0,
      learners: usersCount || 0,
      tokensEarned: totalTokensEarned,
      enrollments: enrollmentsCount || 0,
    })
  } catch (error) {
    console.error('[v0] Stats API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}
