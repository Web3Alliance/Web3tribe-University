"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { Logo } from "@/components/logo";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * A left-side slide-in drawer for dashboard navigation on small screens
 * (below the `md` breakpoint), where the persistent sidebar in
 * DashboardShell is hidden. Built directly on the Radix Dialog primitive
 * (rather than the centered components/ui/dialog.tsx) since a full-height,
 * edge-anchored sheet needs different positioning/animation than a centered
 * modal.
 */
export function MobileNav({ role }: { role: UserRole }) {
  const [open, setOpen] = React.useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Open navigation menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-secondary md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 md:hidden" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 left-0 z-50 h-full w-72 max-w-[85vw] overflow-y-auto border-r border-border bg-card pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-lg duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
            "md:hidden"
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <span className="flex items-center gap-2 font-bold text-primary">
              <Logo size={28} />
              Web3tribe University
            </span>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Close navigation menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogPrimitive.Close>
          </div>
          {/* Closing on navigation: DashboardSidebar's links are plain <Link>
              elements; wrapping them in a click handler here closes the sheet
              the moment any nav item is tapped, without modifying that
              shared component (which is also used unwrapped in the desktop
              persistent sidebar). */}
          <div onClick={() => setOpen(false)}>
            <DashboardSidebar role={role} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}