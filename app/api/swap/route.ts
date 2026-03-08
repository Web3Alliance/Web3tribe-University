import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EXCHANGE_RATE = 100 // 1 Pi = 100 W3TR

export async function POST(request: NextRequest) {
  try {
    const { amount, from_token } = await request.json()

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    if (!['w3tr', 'pi'].includes(from_token)) {
      return NextResponse.json(
        { error: 'Invalid token type' },
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

    // Get user's current balances
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('w3tr_balance, pi_balance')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user has sufficient balance
    if (from_token === 'w3tr' && userData.w3tr_balance < amount) {
      return NextResponse.json(
        { error: 'Insufficient W3TR balance' },
        { status: 400 }
      )
    }

    if (from_token === 'pi' && userData.pi_balance < amount) {
      return NextResponse.json(
        { error: 'Insufficient Pi balance' },
        { status: 400 }
      )
    }

    // Calculate swap amounts
    let newW3trBalance: number
    let newPiBalance: number
    let toAmount: number

    if (from_token === 'w3tr') {
      // W3TR to Pi
      toAmount = amount / EXCHANGE_RATE
      newW3trBalance = userData.w3tr_balance - amount
      newPiBalance = userData.pi_balance + toAmount
    } else {
      // Pi to W3TR
      toAmount = amount * EXCHANGE_RATE
      newPiBalance = userData.pi_balance - amount
      newW3trBalance = userData.w3tr_balance + toAmount
    }

    // Update balances
    const { error: updateError } = await supabase
      .from('users')
      .update({
        w3tr_balance: newW3trBalance,
        pi_balance: newPiBalance
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[v0] Error updating balances:', updateError)
      return NextResponse.json(
        { error: 'Failed to complete swap' },
        { status: 500 }
      )
    }

    // Record transaction
    await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'swap',
        amount: from_token === 'w3tr' ? -amount : amount,
        currency: from_token === 'w3tr' ? 'W3TR' : 'PI',
        description: `Swapped ${amount} ${from_token.toUpperCase()} to ${toAmount.toFixed(4)} ${from_token === 'w3tr' ? 'Pi' : 'W3TR'}`
      })

    return NextResponse.json({
      success: true,
      from_amount: amount,
      to_amount: toAmount,
      new_w3tr_balance: newW3trBalance,
      new_pi_balance: newPiBalance
    })
  } catch (error) {
    console.error('[v0] Swap error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
