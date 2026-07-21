import { getCurrentProfile } from "@/lib/rbac";
import { AvatarUploadCard } from "@/components/settings/avatar-upload-card";
import { ProfileSettingsForm, ChangePasswordForm } from "@/components/settings/profile-settings-form";
import { ThemePreferenceCard } from "@/components/settings/theme-preference-card";
import { OpportunityVisibilityCard } from "@/components/settings/opportunity-visibility-card";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await getCurrentProfile();

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
      <ThemePreferenceCard />
      <ChangePasswordForm />
    </div>
  );
}