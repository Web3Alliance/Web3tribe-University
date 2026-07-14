import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import { initials, formatW3TR } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Leaderboard" };

const MEDAL_COLORS = ["text-yellow-500", "text-slate-400", "text-amber-700"];

export default async function LeaderboardPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: leaderboard } = await supabase.from("leaderboard").select("*").order("rank").limit(50);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-bold">Leaderboard</h1>
      </div>
      <p className="text-muted-foreground">Top learners ranked by W3TR earned.</p>

      <Card>
        <CardContent className="p-2">
          {(leaderboard ?? []).map((entry) => (
            <div
              key={entry.profile_id}
              className={cn(
                "flex items-center gap-4 rounded-lg p-3",
                entry.profile_id === profile?.id && "bg-secondary"
              )}
            >
              <span
                className={cn(
                  "w-6 text-center font-bold",
                  entry.rank <= 3 ? MEDAL_COLORS[entry.rank - 1] : "text-muted-foreground"
                )}
              >
                {entry.rank}
              </span>
              <Avatar className="h-9 w-9">
                <AvatarImage src={entry.avatar_url ?? undefined} />
                <AvatarFallback>{initials(entry.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">{entry.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.total_courses_completed} courses · {entry.current_streak_days}d streak
                </p>
              </div>
              <Badge variant="accent">{formatW3TR(entry.w3tr_balance)} W3TR</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
