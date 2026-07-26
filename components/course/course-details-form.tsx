"use client";
import * as React from "react";
import { toast } from "sonner";
import { updateCourseDetailsAction } from "@/lib/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUploadField } from "@/components/course/file-upload-field";
import type { Category, Course } from "@/lib/types";

export function CourseDetailsForm({ course, categories }: { course: Course; categories: Category[] }) {
  const [isPending, startTransition] = React.useTransition();
  const [thumbnailUrl, setThumbnailUrl] = React.useState(course.thumbnail_url ?? "");
  const [deliveryMode, setDeliveryMode] = React.useState<"online" | "hybrid" | "in_person">(
    course.delivery_mode ?? "online"
  );

  function handleSubmit(formData: FormData) {
    formData.set("thumbnailUrl", thumbnailUrl);
    formData.set("deliveryMode", deliveryMode);
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
            <Label>Cover image</Label>
            <p className="text-xs text-muted-foreground">
              Optional — this is what students see on the course catalog and detail page. Upload your own artwork,
              or leave it blank and we&apos;ll generate an official on-brand cover automatically once your course
              is approved.
            </p>
            <p className="text-xs text-muted-foreground">
              Recommended size: <strong>1280 &times; 720px</strong> (16:9 ratio), JPG/PNG/WebP. A cover you upload
              here is yours to keep &mdash; approval will never replace it with an auto-generated design.
            </p>
            {thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- instructor-provided cover images come from arbitrary Supabase Storage URLs, not a fixed local asset set
              <img
                src={thumbnailUrl}
                alt="Course cover preview"
                className="aspect-video w-full max-w-sm rounded-lg border border-border object-cover"
              />
            )}
            <FileUploadField
              bucket="course-images"
              accept="image/png,image/jpeg,image/webp"
              label={thumbnailUrl ? "Replace cover image" : "Upload a cover image"}
              onUploaded={(url) => setThumbnailUrl(url)}
            />
          </div>
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
            <Label>Delivery mode</Label>
            <RadioGroup
              value={deliveryMode}
              onValueChange={(v) => setDeliveryMode(v as "online" | "hybrid" | "in_person")}
              className="flex flex-wrap gap-4"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="online" id="delivery-online" />
                Fully online
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="hybrid" id="delivery-hybrid" />
                Hybrid
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="in_person" id="delivery-in-person" />
                In-person
              </label>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              This decides what location instructors have to provide when they start a cohort to teach this
              course — they inherit whatever you set here and can&apos;t override it. Fully online means every
              cohort is location-free and visible to every student regardless of where they are.
            </p>
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