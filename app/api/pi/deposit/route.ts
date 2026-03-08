import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { amount, pi_payment_id } = await request.json()

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Update user's Pi balance
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        pi_balance: supabase.raw(`pi_balance + ${amount}`)
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[v0] Error updating Pi balance:', updateError)
      return NextResponse.json(
        { error: 'Failed to update balance' },
        { status: 500 }
      )
    }

    // Record transaction
    await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'deposit',
        amount,
        currency: 'PI',
        description: 'Pi Network deposit',
        reference_id: pi_payment_id
      })

    // Get updated balance
    const { data: userData } = await supabase
      .from('users')
      .select('pi_balance')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      success: true,
      new_balance: userData?.pi_balance || 0
    })
  } catch (error) {
    console.error('[v0] Pi deposit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
