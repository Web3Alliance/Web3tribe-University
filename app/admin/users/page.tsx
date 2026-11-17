import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserRow } from "@/components/admin/user-row";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  // Full user rows (email, phone, status) come only from the admin-gated staff_profiles() function.
  const { data: users } = await supabase.rpc("staff_profiles", { p_query: q ?? null, p_limit: 100 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-muted-foreground">{(users ?? []).length} users shown</p>
      </div>

      <form className="relative max-w-sm" method="get">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" aria-label="Search users by name" defaultValue={q} placeholder="Search by name…" className="pl-9" />
      </form>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users as Profile[] | null)?.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
