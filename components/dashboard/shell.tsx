import * as React from "react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import type { UserRole } from "@/lib/types";

export function DashboardShell({
  role,
  actualRole,
  w3trBalance,
  children,
}: {
  role: UserRole;
  actualRole?: UserRole;
  w3trBalance?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <DashboardTopbar role={role} actualRole={actualRole} w3trBalance={w3trBalance} />
      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:block">
          <DashboardSidebar role={role} actualRole={actualRole} />
        </aside>
        <main className="w-full min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}