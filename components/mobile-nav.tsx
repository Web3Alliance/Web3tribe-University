"use client"

import { BookOpen, GraduationCap, Wallet, Upload, Home, ArrowRightLeft, Award, Shield, User, Users, MessageCircle } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/auth-context"

export function MobileNav() {
  const pathname = usePathname()
  const { user, profile } = useAuth()

  // Don't show nav if user is not logged in
  if (!user) {
    return null
  }

  const mainNavItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/courses", icon: BookOpen, label: "Courses" },
    { href: "/community", icon: Users, label: "Community" },
  ]

  const moreItems = [
    { href: "/profile", icon: User, label: "Profile" },
    { href: "/messages", icon: MessageCircle, label: "Messages" },
    { href: "/wallet", icon: Wallet, label: "Wallet" },
    { href: "/swap", icon: ArrowRightLeft, label: "Swap" },
    { href: "/certificates", icon: Award, label: "Certificates" },
    { href: "/learning", icon: GraduationCap, label: "Learning" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
        {mainNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}

        {/* More Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors outline-none",
              ["/profile", "/messages", "/wallet", "/swap", "/certificates", "/learning"].includes(pathname) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <User className="h-5 w-5" />
            <span className="text-xs font-medium">More</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {moreItems.map((item) => {
              const Icon = item.icon
              return (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tutor or Admin */}
        {profile?.is_admin ? (
          <Link
            href="/admin"
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
              pathname.startsWith("/admin") ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Shield className="h-5 w-5" />
            <span className="text-xs font-medium">Admin</span>
          </Link>
        ) : (
          <Link
            href="/tutor"
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
              pathname.startsWith("/tutor") ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Upload className="h-5 w-5" />
            <span className="text-xs font-medium">Tutor</span>
          </Link>
        )}
      </div>
    </nav>
  )
}
