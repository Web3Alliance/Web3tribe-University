import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { receiver_id, content } = await request.json()

    if (!receiver_id || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check sender has enough W3TR tokens (1 per message)
    const { data: senderProfile, error: profileError } = await supabase
      .from('users')
      .select('w3tr_balance')
      .eq('id', user.id)
      .single()

    if (profileError || !senderProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (senderProfile.w3tr_balance < 1) {
      return NextResponse.json({ error: 'Insufficient W3TR tokens' }, { status: 400 })
    }

    // Deduct 1 W3TR from sender
    const { error: deductError } = await supabase
      .from('users')
      .update({ w3tr_balance: senderProfile.w3tr_balance - 1 })
      .eq('id', user.id)

    if (deductError) {
      return NextResponse.json({ error: 'Failed to deduct tokens' }, { status: 500 })
    }

    // Create message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id,
        content,
      })
      .select()
      .single()

    if (messageError) {
      // Refund the token if message creation fails
      await supabase
        .from('users')
        .update({ w3tr_balance: senderProfile.w3tr_balance })
        .eq('id', user.id)
      
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    return NextResponse.json({ message, success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
