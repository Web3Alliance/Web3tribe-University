import { getCurrentProfile } from "@/lib/rbac";
import { WalletView } from "@/components/wallet/wallet-view";

export const metadata = { title: "W3TR Wallet" };

export default async function InstructorWalletPage() {
  const profile = await getCurrentProfile();
  return <WalletView profileId={profile!.id} />;
}
