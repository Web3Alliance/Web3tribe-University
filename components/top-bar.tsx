"use client"
import Link from "next/link"
import { Shield, Bell } from "lucide-react"
import { ProfileMenu } from "@/components/profile-menu"
import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function TopBar() {
  const { user, profile } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [user])

  const fetchUnreadCount = async () => {
    try {
      const supabase = createClient()
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_read', false)
      setUnreadCount(count || 0)
    } catch (error) {}
  }

  if (!user) return null

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <img src="/logo.jpg" alt="Web3Tribe Logo" className="h-8 w-8 rounded-lg object-cover" />
          <div>
            <h1 className="text-sm font-bold leading-tight">Web3Tribe Uni</h1>
            <p className="text-xs text-muted-foreground leading-tight">Learn & Earn</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile?.is_admin && (
            <Link href="/admin">
              <Badge variant="secondary" className="flex items-center gap-1 cursor-pointer">
                <Shield className="h-3 w-3" />
                Admin
              </Badge>
            </Link>
          )}
          <Link href="/notifications" className="relative h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent transition-colors">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          <ProfileMenu />
        </div>
      </div>
    </header>
  )
}