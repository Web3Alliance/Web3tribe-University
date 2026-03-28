"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Bell, Heart, MessageSquare, UserPlus, Mail } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"

interface Notification {
  id: string
  type: string
  message: string
  is_read: boolean
  created_at: string
  post_id?: string
  sender: {
    id: string
    full_name: string
    profile_picture_url?: string
  }
}

export default function NotificationsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user) fetchNotifications()
  }, [user])

  const fetchNotifications = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, message, is_read, created_at, sender_id, post_id')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      if (!data || data.length === 0) { setNotifications([]); setLoading(false); return }

      const senderIds = [...new Set(data.map(n => n.sender_id))]
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, profile_picture_url')
        .in('id', senderIds)

      const usersMap = new Map(usersData?.map(u => [u.id, u]) || [])

      setNotifications(data.map(n => ({
        ...n,
        sender: usersMap.get(n.sender_id) || { id: n.sender_id, full_name: 'Unknown' }
      })))

      // Mark all as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user!.id)
        .eq('is_read', false)

    } catch (error) {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (notification.type === 'message') {
      router.push(`/messages?user=${notification.sender.id}`)
    } else if (notification.type === 'follow') {
      router.push(`/profile/${notification.sender.id}`)
    } else if (notification.type === 'like' || notification.type === 'comment') {
      if (notification.post_id) {
        router.push(`/community?post=${notification.post_id}`)
      } else {
        router.push('/community')
      }
    } else {
      router.push('/community')
    }
  }

  const getIcon = (type: string) => {
    if (type === 'follow') return <UserPlus className="h-4 w-4 text-blue-500" />
    if (type === 'like') return <Heart className="h-4 w-4 text-red-500" />
    if (type === 'comment') return <MessageSquare className="h-4 w-4 text-green-500" />
    if (type === 'message') return <Mail className="h-4 w-4 text-purple-500" />
    return <Bell className="h-4 w-4" />
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No notifications yet
            </CardContent>
          </Card>
        ) : (
          notifications.map(notification => (
            <Card
              key={notification.id}
              className={`cursor-pointer hover:bg-accent transition-colors ${!notification.is_read ? 'border-primary' : ''}`}
              onClick={() => handleNotificationClick(notification)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={notification.sender?.profile_picture_url || "/placeholder.svg"} />
                    <AvatarFallback>{notification.sender?.full_name?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {getIcon(notification.type)}
                      <p className="text-sm">{notification.message}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <Badge variant="default" className="h-2 w-2 p-0 rounded-full" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}