import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that never require auth. /forgot-password and /reset-password are
// part of the password-recovery flow; /auth/callback is where Supabase lands
// the user after they click the recovery email link (it then exchanges the
// code for a session). All three must skip the auth gate or the flow dead-
// ends with a redirect back to /login.
const publicRoutes = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/privacy",
  "/terms",
  "/data-deletion"
]);
const blockedSessionEmails = new Set([
  "admin@agently.demo",
  "brand@agently.demo",
  "creator@agently.demo",
  "freelancer@agently.demo"
]);
const creatorRoutes = ["/creator-home", "/activity", "/notifications", "/messages", "/profile", "/intake", "/demo-guide", "/feedback", "/creators", "/freelancers", "/brands", "/offers", "/freelancer-home", "/ai-insights", "/payments", "/campaigns/discover", "/contracts"];
const freelancerRoutes = ["/freelancer-home", "/activity", "/notifications", "/messages", "/profile", "/intake", "/demo-guide", "/feedback", "/creators", "/freelancers", "/brands", "/offers", "/ai-insights", "/payments", "/campaigns/discover", "/contracts"];
const brandRoutes = ["/brand-home", "/activity", "/notifications", "/messages", "/profile", "/intake", "/demo-guide", "/feedback", "/brand-insights", "/campaigns", "/deals", "/creators", "/freelancers", "/brands", "/payments", "/contracts"];
const adminRoutes = [
  "/dashboard",
  "/ops",
  "/analytics",
  "/engine-room",
  "/outcome-ledger",
  "/rate-benchmarks",
  "/activity",
  "/notifications",
  "/creators",
  "/freelancers",
  "/brands",
  "/campaigns",
  "/deals",
  "/messages",
  "/contracts",
  "/payments",
  "/ai-insights",
  "/offers",
  "/profile",
  "/demo-guide",
  "/feedback",
  "/creator-home",
  "/brand-home",
  "/brand-insights",
  "/freelancer-home",
  "/audits",
  "/intake"
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isStaticOrApi(pathname) || publicRoutes.has(pathname)) {
    return NextResponse.next({ request });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof response.cookies.set>[2];
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return redirectTo(request, "/login");
  }

  if (blockedSessionEmails.has(String(data.user.email ?? "").toLowerCase())) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "This test login has been retired.");
    return NextResponse.redirect(url);
  }

  if (pathname === "/app") return response;

  const role = String(data.user.user_metadata?.role ?? "admin");
  if (isAllowed(role, pathname)) return response;

  return redirectTo(request, homeForRole(role));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

function isStaticOrApi(pathname: string) {
  return pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.includes(".");
}

function isAllowed(role: string, pathname: string) {
  if (role === "admin") return startsWithAny(pathname, adminRoutes);
  if (role === "creator") return startsWithAny(pathname, creatorRoutes);
  if (role === "freelancer") return startsWithAny(pathname, freelancerRoutes);
  if (role === "brand") return startsWithAny(pathname, brandRoutes);
  return false;
}

function startsWithAny(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function homeForRole(role: string) {
  if (role === "creator") return "/creator-home";
  if (role === "brand") return "/brand-home";
  if (role === "freelancer") return "/freelancer-home";
  return "/dashboard";
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}
