import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/student",
  "/instructor",
  "/organization",
  "/admin",
  "/super-admin",
];

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  // getUser() makes a real network round-trip to Supabase's Auth server on
  // every call — that's the whole point, it's a live revalidation rather
  // than trusting a locally-decoded JWT, which is deliberately safer. But
  // that safety cost was previously being paid on EVERY request site-wide,
  // including the public homepage and marketing pages that never make an
  // auth-gated decision at all. Skipping the entire Supabase client
  // creation + getUser() call for non-protected paths removes a real,
  // unconditional round-trip from every page that never needed it.
  if (!isProtected) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run any code between createServerClient and getUser().
  // A simple mistake here can cause a hard-to-debug session refresh bug.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", path);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
