import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAnnouncementAction } from "@/lib/actions/admin";
import { AnnouncementToggle } from "@/components/admin/announcement-toggle";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Announcements" };

export default async function AdminAnnouncementsPage() {
  const supabase = await createClient();
  const { data: announcements } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });

  async function handleCreate(formData: FormData) {
    "use server";
    await createAnnouncementAction(formData);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Announcements</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New announcement</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea id="body" name="body" rows={3} required />
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select name="audience">
                <SelectTrigger>
                  <SelectValue placeholder="Everyone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="instructor">Instructors</SelectItem>
                  <SelectItem value="organization">Organizations</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="isBanner" /> Show as site-wide banner
            </label>
            <Button type="submit">Publish announcement</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(announcements ?? []).map((a) => (
          <Card key={a.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">
                  {a.title} {a.is_banner && <Badge variant="accent">Banner</Badge>}
                </p>
                <p className="text-sm text-muted-foreground">{a.body}</p>
                <p className="text-xs text-muted-foreground">{formatDate(a.starts_at)}</p>
              </div>
              <AnnouncementToggle id={a.id} isActive={a.is_active} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
