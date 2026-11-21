import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/login"]);

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return new NextResponse("Supabase configuration is required.", { status: 503 });
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if (!user && !PUBLIC_PATHS.has(pathname)) {
    return redirectWithCookies(request, response, "/login");
  }
  if (user && pathname === "/login") {
    return redirectWithCookies(request, response, "/dashboard");
  }
  return response;
}

// Carry any cookies Supabase wrote during getUser() onto the redirect. When a
// stale refresh token is rejected, Supabase clears the session cookies via
// setAll; dropping them here would leave the dead cookie in the browser and
// re-trigger "refresh_token_not_found" on every request.
function redirectWithCookies(request: NextRequest, source: NextResponse, pathname: string) {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  const redirect = NextResponse.redirect(target);
  source.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
