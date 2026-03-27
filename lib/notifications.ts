import { createClient } from "@/lib/supabase/client"

export const sendNotification = async (
  userId: string,
  senderId: string,
  type: string,
  message: string,
  postId?: string
) => {
  try {
    const supabase = createClient()
    await supabase.from('notifications').insert({
      user_id: userId,
      sender_id: senderId,
      type,
      message,
      post_id: postId || null
    })
  } catch (error) {
    console.error('Failed to send notification', error)
  }
}