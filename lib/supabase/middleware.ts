import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/student",
  "/instructor",
  "/organization",
  "/admin",
  "/super-admin",
];

// Course browsing is genuinely meant to be public — the course detail page
// already has an `if (profile)` guard specifically to handle a logged-out
// visitor gracefully, and the homepage's own category links point straight
// here for anyone, logged in or not. But because these routes sit under the
// blanket-protected /student prefix, an anonymous visitor (including every
// search engine crawler) was being redirected to /login before ever
// reaching them — making the entire course catalog invisible to Google, no
// matter how good its metadata is. This carves out exactly those two
// routes (the list, and a single course's detail page) as public, while
// everything else under /student — the dashboard, wallet, settings,
// enrollment actions, discussion threads, etc. — stays protected exactly
// as before.
const PUBLIC_EXCEPTIONS = [/^\/student\/courses$/, /^\/student\/courses\/[^/]+$/];

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicException = PUBLIC_EXCEPTIONS.some((re) => re.test(path));
  const isProtected = !isPublicException && PROTECTED_PREFIXES.some((p) => path.startsWith(p));

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
    // Include the search string (e.g. ?category=X) too — dropping it here
    // silently throws away a homepage category filter the moment an
    // unauthenticated visitor logs in.
    const intendedPath = path + request.nextUrl.search;
    redirectUrl.searchParams.set("redirectTo", intendedPath);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
