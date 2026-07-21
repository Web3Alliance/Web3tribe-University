import { getCurrentProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { AvatarUploadCard } from "@/components/settings/avatar-upload-card";
import { ProfileSettingsForm, ChangePasswordForm } from "@/components/settings/profile-settings-form";
import { ThemePreferenceCard } from "@/components/settings/theme-preference-card";
import { OpportunityVisibilityCard } from "@/components/settings/opportunity-visibility-card";
import { BiodataForm, type ExistingBiodata } from "@/components/settings/biodata-form";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await getCurrentProfile();

  // Students can review and update their biodata at any time from Settings —
  // previously it was only reachable through the one-time enrollment gate.
  let biodata: (ExistingBiodata & { skipped: boolean }) | null = null;
  if (profile?.role === "student") {
    const supabase = await createClient();
    const { data } = await supabase.from("student_biodata").select("*").eq("profile_id", profile.id).maybeSingle();
    biodata = data;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences.</p>
      </div>
      <AvatarUploadCard avatarUrl={profile!.avatar_url} fullName={profile!.full_name} />
      <ProfileSettingsForm profile={profile!} />
      {profile?.role === "student" && (
        <OpportunityVisibilityCard initialVisible={profile.visible_for_opportunities} />
      )}
      {profile?.role === "student" && (
        <Accordion type="single" collapsible className="rounded-lg border border-border px-4">
          <AccordionItem value="biodata" className="border-none">
            <AccordionTrigger className="hover:no-underline">
              <div className="text-left">
                <p className="font-semibold">Student biodata</p>
                <p className="text-sm font-normal text-muted-foreground">
                  {biodata && !biodata.skipped
                    ? "Review and update the information institutions and organizations see on record."
                    : "You haven't completed your biodata yet — fill it in here."}
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <BiodataForm skipAllowed={false} existing={biodata && !biodata.skipped ? biodata : null} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      <ThemePreferenceCard />
      <ChangePasswordForm />
    </div>
  );
}