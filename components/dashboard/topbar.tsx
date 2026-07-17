"use client";
import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun, LogOut, Settings, Bell } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import { initials, formatW3TR } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

export function DashboardTopbar({ role, w3trBalance }: { role: UserRole; w3trBalance?: number }) {
  const { theme, setTheme } = useTheme();
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-border bg-card/80 px-3 backdrop-blur sm:gap-4 sm:px-4">
      <div className="flex items-center gap-2">
        <MobileNav role={role} />
        <Link href="/" className="flex items-center gap-2 truncate font-bold text-primary">
          <Logo size={32} priority />
          <span className="sm:hidden">W3tribe</span>
          <span className="hidden sm:inline">Web3tribe University</span>
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {typeof w3trBalance === "number" && (
          <Badge variant="accent" className="hidden sm:flex">
            {formatW3TR(w3trBalance)} W3TR
          </Badge>
        )}

        <Button variant="ghost" size="icon" asChild>
          <Link href="/student/notifications" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.full_name ?? "User"} />
                <AvatarFallback>{initials(profile?.full_name)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{profile?.full_name}</span>
                <span className="text-xs font-normal text-muted-foreground">{profile?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/student/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={logoutAction}>
              <button type="submit" className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-destructive">
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}