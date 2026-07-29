"use client";
import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { LogOut, Settings, Sun, Moon, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/contexts/auth-context";
import { logoutAction } from "@/lib/actions/auth";
import { setLocaleAction } from "@/lib/actions/locale";
import { SUPPORTED_LOCALES, LOCALE_LABELS, type SupportedLocale } from "@/i18n/locales";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { initials, formatW3TR } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

export function DashboardTopbar({ role, actualRole, w3trBalance }: { role: UserRole; actualRole?: UserRole; w3trBalance?: number }) {
  const { profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations("languageSwitcher");

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-2 border-b border-border bg-card/80 px-3 pt-[env(safe-area-inset-top)] backdrop-blur sm:gap-4 sm:px-4">
      <div className="flex items-center gap-2">
        <MobileNav role={role} actualRole={actualRole} />
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

        {/* Below sm (~640px), the topbar only has room for one icon plus the
            avatar without crowding or overflow on smaller phones — Language
            and Theme move into the avatar dropdown below instead of sitting
            as separate top-level buttons. */}
        <div className="hidden items-center gap-1 sm:flex sm:gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <NotificationBell />

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

            {/* Mobile-only duplicates of the quick-access icons hidden above,
                so nothing is actually lost on small screens — just moved
                somewhere that doesn't crowd the header. */}
            <div className="sm:hidden">
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTheme(theme === "dark" ? "light" : "dark"); }}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Languages className="h-4 w-4" /> {t("label")}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {SUPPORTED_LOCALES.map((code) => (
                      <DropdownMenuItem
                        key={code}
                        onSelect={(e) => {
                          e.preventDefault();
                          if (code !== locale) setLocaleAction(code).then(() => window.location.reload());
                        }}
                        className={code === locale ? "font-semibold text-primary" : ""}
                      >
                        {LOCALE_LABELS[code]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </div>

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