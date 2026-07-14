import { getCurrentProfile } from "@/lib/rbac";
import { ProfileSettingsForm, ChangePasswordForm } from "@/components/settings/profile-settings-form";
import { ThemePreferenceCard } from "@/components/settings/theme-preference-card";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await getCurrentProfile();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences.</p>
      </div>
      <ProfileSettingsForm profile={profile!} />
      <ThemePreferenceCard />
      <ChangePasswordForm />
    </div>
  );
}
