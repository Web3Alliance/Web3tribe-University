"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Wallet,
  Award,
  Bell,
  Settings,
  Heart,
  Trophy,
  PlusCircle,
  BarChart3,
  Users,
  ShieldCheck,
  Gift,
  FolderTree,
  FileClock,
  Megaphone,
  Flag,
  Server,
  Building2,
  ClipboardList,
  GraduationCap,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  student: [
    { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/student/courses", label: "Browse Courses", icon: BookOpen },
    { href: "/student/opportunities", label: "Opportunities", icon: Briefcase },
    { href: "/student/wishlist", label: "Wishlist", icon: Heart },
    { href: "/student/wallet", label: "W3TR Wallet", icon: Wallet },
    { href: "/student/certificates", label: "Certificates", icon: Award },
    { href: "/student/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/student/notifications", label: "Notifications", icon: Bell },
    { href: "/student/settings", label: "Settings", icon: Settings },
  ],
  instructor: [
    { href: "/instructor/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/instructor/courses", label: "My Courses", icon: BookOpen },
    { href: "/instructor/courses/new", label: "Create Course", icon: PlusCircle },
    { href: "/instructor/cohorts/new", label: "Start a Cohort", icon: Users },
    { href: "/instructor/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/student/settings", label: "Settings", icon: Settings },
  ],
  organization: [
    { href: "/organization/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/organization/programs", label: "Programs", icon: ClipboardList },
    { href: "/organization/opportunities", label: "Opportunities", icon: Briefcase },
    { href: "/organization/learners", label: "Learners", icon: GraduationCap },
    { href: "/student/settings", label: "Settings", icon: Settings },
  ],
  moderator: [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/courses", label: "Course Moderation", icon: ShieldCheck },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/courses", label: "Course Moderation", icon: ShieldCheck },
    { href: "/admin/categories", label: "Categories", icon: FolderTree },
    { href: "/admin/rewards", label: "Rewards", icon: Gift },
    { href: "/admin/donations", label: "Donations", icon: Building2 },
    { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
    { href: "/admin/audit-logs", label: "Audit Logs", icon: FileClock },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ],
  super_admin: [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/courses", label: "Course Moderation", icon: ShieldCheck },
    { href: "/admin/categories", label: "Categories", icon: FolderTree },
    { href: "/admin/rewards", label: "Rewards", icon: Gift },
    { href: "/admin/donations", label: "Donations", icon: Building2 },
    { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
    { href: "/admin/audit-logs", label: "Audit Logs", icon: FileClock },
    { href: "/super-admin/feature-flags", label: "Feature Flags", icon: Flag },
    { href: "/super-admin/system", label: "System", icon: Server },
  ],
};

export function DashboardSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role] ?? [];

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}