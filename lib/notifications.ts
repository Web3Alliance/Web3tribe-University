import { createClient } from "@/lib/supabase/client"

export const sendNotification = async (
  userId: string,
  senderId: string,
  type: string,
  message: string,
  postId?: string
) => {
  // Don't send notification to yourself
  if (userId === senderId) return

  try {
    const supabase = createClient()
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      sender_id: senderId,
      type,
      message,
      post_id: postId || null
    })
    if (error) {
      console.error('Notification insert error:', error.message)
    }
  } catch (error) {
    console.error('Failed to send notification:', error)
  }
}