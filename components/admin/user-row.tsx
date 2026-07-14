"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { banUserAction, updateUserRoleAction } from "@/lib/actions/admin";
import type { Profile, UserRole } from "@/lib/types";

export function UserRow({ user }: { user: Profile }) {
  const [isPending, startTransition] = React.useTransition();
  const [banReason, setBanReason] = React.useState("");
  const [banDialogOpen, setBanDialogOpen] = React.useState(false);

  function handleRoleChange(role: UserRole) {
    startTransition(async () => {
      const res = await updateUserRoleAction(user.id, role);
      if (res?.error) toast.error(res.error);
      else toast.success(`Role updated to ${role}.`);
    });
  }

  function handleUnban() {
    startTransition(async () => {
      const res = await banUserAction(user.id, false, "");
      if (res?.error) toast.error(res.error);
      else toast.success("User unbanned.");
    });
  }

  function handleBan() {
    startTransition(async () => {
      const res = await banUserAction(user.id, true, banReason);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("User banned.");
        setBanDialogOpen(false);
      }
    });
  }

  return (
    <tr className="border-b border-border text-sm">
      <td className="p-2">
        <p className="font-medium">{user.full_name}</p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </td>
      <td className="p-2">
        <Select value={user.role} onValueChange={(v) => handleRoleChange(v as UserRole)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="instructor">Instructor</SelectItem>
            <SelectItem value="organization">Organization</SelectItem>
            <SelectItem value="moderator">Moderator</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="p-2">
        {user.is_banned ? <Badge variant="destructive">Banned</Badge> : <Badge variant="success">Active</Badge>}
      </td>
      <td className="p-2 text-right">
        {user.is_banned ? (
          <Button size="sm" variant="outline" onClick={handleUnban} disabled={isPending}>
            Unban
          </Button>
        ) : (
          <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="destructive">
                Ban
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ban {user.full_name}?</DialogTitle>
              </DialogHeader>
              <Textarea placeholder="Reason for ban…" value={banReason} onChange={(e) => setBanReason(e.target.value)} />
              <DialogFooter>
                <Button variant="destructive" onClick={handleBan} disabled={isPending || !banReason.trim()}>
                  Confirm ban
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </td>
    </tr>
  );
}
