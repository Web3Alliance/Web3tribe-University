import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createCategoryAction } from "@/lib/actions/admin";
import { CategoryToggle } from "@/components/admin/category-toggle";

export const metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("*").order("display_order");

  async function handleCreate(formData: FormData) {
    "use server";
    await createCategoryAction(formData);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Course Categories</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add category</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleCreate} className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1 space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="e.g. Renewable Energy" required />
            </div>
            <div className="flex items-end">
              <Button type="submit">Add</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(categories ?? []).map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.name}</span>
                <Badge variant="outline">{c.slug}</Badge>
              </div>
              <CategoryToggle categoryId={c.id} isActive={c.is_active} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}