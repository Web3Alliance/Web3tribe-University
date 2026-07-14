"use client";
import * as React from "react";
import { toast } from "sonner";
import { updateCourseDetailsAction } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Category, Course } from "@/lib/types";

export function CourseDetailsForm({ course, categories }: { course: Course; categories: Category[] }) {
  const [isPending, startTransition] = React.useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await updateCourseDetailsAction(course.id, formData);
      if (res.error) toast.error(res.error);
      else toast.success("Course details saved.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={course.title} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input id="subtitle" name="subtitle" defaultValue={course.subtitle ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={5} defaultValue={course.description ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select name="categoryId" defaultValue={course.category_id ?? undefined}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Level</Label>
              <Select name="level" defaultValue={course.level}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="all_levels">All levels</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceW3tr">Price (W3TR)</Label>
              <Input id="priceW3tr" name="priceW3tr" type="number" min={0} defaultValue={course.price_w3tr} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimatedHours">Estimated hours</Label>
            <Input id="estimatedHours" name="estimatedHours" type="number" min={0} step={0.5} defaultValue={course.estimated_hours ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="requirements">Requirements (one per line)</Label>
            <Textarea id="requirements" name="requirements" rows={3} defaultValue={(course.requirements ?? []).join("\n")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="learningOutcomes">What you&apos;ll learn (one per line)</Label>
            <Textarea id="learningOutcomes" name="learningOutcomes" rows={3} defaultValue={(course.learning_outcomes ?? []).join("\n")} />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save details"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
