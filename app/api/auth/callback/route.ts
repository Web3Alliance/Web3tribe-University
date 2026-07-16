import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") || "/student/dashboard";

  // Google (or Supabase's own authorize step) can redirect back here with an
  // error instead of a code, e.g. if the user denies consent, or if the
  // redirect URL isn't registered in Supabase's Auth > URL Configuration
  // allow list yet. Surface whatever detail is available rather than
  // silently falling through to a generic failure.
  const upstreamError = searchParams.get("error_description") || searchParams.get("error");
  if (upstreamError) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed&detail=${encodeURIComponent(upstreamError)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
    return NextResponse.redirect(`${origin}/login?error=oauth_failed&detail=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(
    `${origin}/login?error=oauth_failed&detail=${encodeURIComponent("No authorization code was returned.")}`
  );
}