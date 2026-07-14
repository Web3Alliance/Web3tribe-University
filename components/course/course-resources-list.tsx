import { FileText, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ResourceItem {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
}

export function CourseResourcesList({ resources }: { resources: ResourceItem[] }) {
  if (resources.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Course Resources</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {resources.map((r) => (
          <a
            key={r.id}
            href={r.file_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-md border border-border p-3 text-sm transition-colors hover:bg-secondary/50"
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>
                <span className="font-medium">{r.title}</span>
                {r.description && <span className="block text-xs text-muted-foreground">{r.description}</span>}
              </span>
            </span>
            <Download className="h-4 w-4 text-muted-foreground" />
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
