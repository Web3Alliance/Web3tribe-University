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

export function BiodataForm({ skipAllowed, redirectTo }: { skipAllowed: boolean; redirectTo: string }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(submitBiodataAction, initial);
  const [isSkipping, setIsSkipping] = React.useState(false);

  React.useEffect(() => {
    if (state.success) {
      toast.success("Biodata saved — you're all set to enroll.");
      router.push(redirectTo);
    }
  }, [state.success, redirectTo, router]);

  function handleSkip() {
    setIsSkipping(true);
    skipBiodataAction().then((res) => {
      if (res.error) {
        toast.error(res.error);
        setIsSkipping(false);
      } else {
        toast.success("Skipped for now.");
        router.push(redirectTo);
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
                <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select name="gender" required>
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
                <Input id="nationality" name="nationality" defaultValue="Nigerian" required />
              </div>
              <div className="space-y-2">
                <Label>State of origin</Label>
                <Select name="stateOfOrigin" required>
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
              <Input id="lga" name="lga" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="homeAddress">Home address</Label>
              <Textarea id="homeAddress" name="homeAddress" rows={2} required />
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <h3 className="font-semibold">Next of kin</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nextOfKinName">Full name</Label>
                <Input id="nextOfKinName" name="nextOfKinName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextOfKinRelationship">Relationship</Label>
                <Input id="nextOfKinRelationship" name="nextOfKinRelationship" placeholder="e.g. Parent, Sibling" required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nextOfKinPhone">Phone number</Label>
                <Input id="nextOfKinPhone" name="nextOfKinPhone" type="tel" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextOfKinAddress">Address (optional)</Label>
                <Input id="nextOfKinAddress" name="nextOfKinAddress" />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <h3 className="font-semibold">Education / occupation (optional)</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="highestQualification">Highest qualification</Label>
                <Input id="highestQualification" name="highestQualification" placeholder="e.g. SSCE, OND, BSc" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="occupationOrInstitution">Current school / employer</Label>
                <Input id="occupationOrInstitution" name="occupationOrInstitution" />
              </div>
            </div>
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save and continue"}
            </Button>
            {skipAllowed && (
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