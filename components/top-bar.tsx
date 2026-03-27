"use client"
import Link from "next/link"
import { Shield } from "lucide-react"
import { NotificationsMenu } from "@/components/notifications-menu"
import { ProfileMenu } from "@/components/profile-menu"
import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
export function TopBar() {
  const { user, profile } = useAuth()
  // Don't show top bar if user is not logged in
  if (!user) {
    return null
  }
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
          <NotificationsMenu />
          <ProfileMenu />
        </div>
      </div>
    </header>
  )
}