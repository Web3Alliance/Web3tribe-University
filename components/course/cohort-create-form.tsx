"use client";
import * as React from "react";
import { useActionState } from "react";
import { createCohortAction, type CohortFormState } from "@/lib/actions/cohorts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { NIGERIAN_STATES } from "@/lib/nigerian-states";

const initial: CohortFormState = { error: null };

interface CourseOption {
  id: string;
  title: string;
  authorName: string;
  deliveryMode: "online" | "hybrid" | "in_person";
}

const DELIVERY_LABEL: Record<CourseOption["deliveryMode"], string> = {
  online: "Fully online",
  hybrid: "Hybrid",
  in_person: "In-person",
};

export function CohortCreateForm({ courses }: { courses: CourseOption[] }) {
  const [state, formAction, isPending] = useActionState(createCohortAction, initial);
  const [selectedCourseId, setSelectedCourseId] = React.useState<string>("");

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const requiresLocation = selectedCourse && selectedCourse.deliveryMode !== "online";

  if (courses.length === 0) {
    return <p className="text-sm text-muted-foreground">No published courses are available to teach yet.</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label>Course</Label>
        <Select name="courseId" required onValueChange={setSelectedCourseId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a course to teach" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title} — by {c.authorName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCourse && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          Delivery mode: <Badge variant="secondary">{DELIVERY_LABEL[selectedCourse.deliveryMode]}</Badge>
          <span>— set by the course&apos;s author, applies to every cohort automatically.</span>
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">Cohort title (optional)</Label>
        <Input id="title" name="title" placeholder="e.g. August 2026 Jos Cohort" />
      </div>

      {requiresLocation && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>State</Label>
            <Select name="stateRegion" required>
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {NIGERIAN_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address (optional)</Label>
            <Input id="address" name="address" placeholder="Venue / street address" />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End date (optional)</Label>
          <Input id="endDate" name="endDate" type="date" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="maxStudents">Max students (optional)</Label>
        <Input id="maxStudents" name="maxStudents" type="number" min={1} placeholder="No limit" />
      </div>

      <p className="rounded-md bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
        Once the start date arrives, this cohort automatically stops accepting new enrollments.
      </p>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-success">Cohort created!</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Start cohort"}
      </Button>
    </form>
  );
}