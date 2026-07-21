"use client";
import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { submitBiodataAction, skipBiodataAction } from "@/lib/actions/biodata";
import type { BiodataFormState } from "@/lib/biodata-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { NIGERIAN_STATES } from "@/lib/nigerian-states";

const initial: BiodataFormState = { error: null };

/** Existing biodata used to prefill the form when editing from Settings. */
export interface ExistingBiodata {
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  state_of_origin: string | null;
  lga: string | null;
  home_address: string | null;
  next_of_kin_name: string | null;
  next_of_kin_relationship: string | null;
  next_of_kin_phone: string | null;
  next_of_kin_address: string | null;
  highest_qualification: string | null;
  occupation_or_institution: string | null;
}

/**
 * One form, two homes:
 *  - The first-time GATE (/student/biodata): pass `redirectTo` — on success
 *    the student is sent onward to enrollment.
 *  - SETTINGS (edit anytime): omit `redirectTo` and pass `existing` — fields
 *    are prefilled with what's on record and saving stays on the page.
 * submitBiodataAction is an upsert either way, so both paths share one action.
 */
export function BiodataForm({
  skipAllowed,
  redirectTo,
  existing,
}: {
  skipAllowed: boolean;
  redirectTo?: string;
  existing?: ExistingBiodata | null;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(submitBiodataAction, initial);
  const [isSkipping, setIsSkipping] = React.useState(false);
  const isEditing = !redirectTo;

  React.useEffect(() => {
    if (state.success) {
      if (redirectTo) {
        toast.success("Biodata saved — you're all set to enroll.");
        router.push(redirectTo);
      } else {
        toast.success("Biodata updated.");
        router.refresh();
      }
    }
  }, [state, redirectTo, router]);

  function handleSkip() {
    setIsSkipping(true);
    skipBiodataAction().then((res) => {
      if (res.error) {
        toast.error(res.error);
        setIsSkipping(false);
      } else {
        toast.success("Skipped for now.");
        if (redirectTo) router.push(redirectTo);
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <form action={formAction} className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Personal information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of birth</Label>
                <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={existing?.date_of_birth ?? undefined} required />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select name="gender" defaultValue={existing?.gender ?? undefined} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nationality">Nationality</Label>
                <Input id="nationality" name="nationality" defaultValue={existing?.nationality ?? "Nigerian"} required />
              </div>
              <div className="space-y-2">
                <Label>State of origin</Label>
                <Select name="stateOfOrigin" defaultValue={existing?.state_of_origin ?? undefined} required>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="lga">Local Government Area (LGA)</Label>
              <Input id="lga" name="lga" defaultValue={existing?.lga ?? undefined} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="homeAddress">Home address</Label>
              <Textarea id="homeAddress" name="homeAddress" rows={2} defaultValue={existing?.home_address ?? undefined} required />
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <h3 className="font-semibold">Next of kin</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nextOfKinName">Full name</Label>
                <Input id="nextOfKinName" name="nextOfKinName" defaultValue={existing?.next_of_kin_name ?? undefined} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextOfKinRelationship">Relationship</Label>
                <Input
                  id="nextOfKinRelationship"
                  name="nextOfKinRelationship"
                  placeholder="e.g. Parent, Sibling"
                  defaultValue={existing?.next_of_kin_relationship ?? undefined}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nextOfKinPhone">Phone number</Label>
                <Input id="nextOfKinPhone" name="nextOfKinPhone" type="tel" defaultValue={existing?.next_of_kin_phone ?? undefined} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextOfKinAddress">Address (optional)</Label>
                <Input id="nextOfKinAddress" name="nextOfKinAddress" defaultValue={existing?.next_of_kin_address ?? undefined} />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <h3 className="font-semibold">Education / occupation (optional)</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="highestQualification">Highest qualification</Label>
                <Input
                  id="highestQualification"
                  name="highestQualification"
                  placeholder="e.g. SSCE, OND, BSc"
                  defaultValue={existing?.highest_qualification ?? undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="occupationOrInstitution">Current school / employer</Label>
                <Input
                  id="occupationOrInstitution"
                  name="occupationOrInstitution"
                  defaultValue={existing?.occupation_or_institution ?? undefined}
                />
              </div>
            </div>
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEditing ? "Save changes" : "Save and continue"}
            </Button>
            {skipAllowed && !isEditing && (
              <button
                type="button"
                onClick={handleSkip}
                disabled={isSkipping}
                className="text-sm text-muted-foreground underline hover:text-foreground"
              >
                {isSkipping ? "Skipping…" : "Skip for now (testing only)"}
              </button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
