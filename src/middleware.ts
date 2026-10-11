import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { safeNextPath, sessionCookieOptions } from '@/lib/auth-navigation';

const PUBLIC_ROUTES = [
  "/",
  "/pricing",
  "/help",
  "/status",
  "/changelog",
  "/ecosystem",
  "/how-it-works",
  "/offline",
  "/privacy",
  "/terms",
  "/signup",
  "/reset-password",
  "/mentions-legales",
  "/politique-confidentialite",
  "/cgv",
  "/cgu",
  "/aide",
  "/partenariat",
  "/partenaires",
  "/impact",
  "/contact",
  "/financer",
  "/confidentialite",
  "/devenir-influenceur",
  "/devenir-ambassadeur",
  "/confirmation",
];

const PUBLIC_PREFIXES = [
  "/legal",
  "/go/",
  "/api/",
  "/_next/",
  "/auth/callback",
  "/scan/",
  "/p/",
  "/partenariat/",
];

const AUTH_ROUTES = ["/login", "/forgot-password"];

const SUPER_ADMIN_EMAIL = "matiss.frasne@gmail.com";

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.includes(pathname);
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

function isInfluencerRoute(pathname: string): boolean {
  return pathname.startsWith("/influencer");
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/images") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".woff") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // Sur Vercel, la plateforme intercepte /_vercel/* AVANT le middleware.
  // En local / self-host, on sert un stub JS vide : sans lui, les balises
  // script d'Analytics/SpeedInsights recevraient la page /login en HTML
  // (pageerror « Unexpected token '<' ») — ou un 404 console.
  if (pathname.startsWith("/_vercel/")) {
    return new NextResponse(
      "/* stub local — servi par la plateforme Vercel en production */",
      {
        status: 200,
        headers: { "Content-Type": "application/javascript; charset=utf-8" },
      }
    );
  }

  // Public pages do not need a remote auth round trip. API handlers authenticate
  // their own requests; the callback exchanges its own one-time code.
  if (isPublicRoute(pathname)) return NextResponse.next();

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: process.env.NEXT_PUBLIC_APP_SCHEMA || "sutra" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, sessionCookieOptions(options, request.cookies.get('sutra_persist')?.value))
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  function redirect(url: URL) {
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
    return response;
  }

  if (isAuthRoute(pathname)) {
    if (user) {
      return redirect(new URL(safeNextPath(request.nextUrl.searchParams.get('next')), request.url));
    }
    return supabaseResponse;
  }

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return redirect(redirectUrl);
  }

  if (isAdminRoute(pathname) || isInfluencerRoute(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, email")
      .eq("id", user.id)
      .single();

    if (isAdminRoute(pathname)) {
      const isAuthorized =
        profile?.is_admin === true &&
        profile?.email === SUPER_ADMIN_EMAIL;

      if (!isAuthorized) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/dashboard";
        redirectUrl.search = "";
        return redirect(redirectUrl);
      }
    }

    if (isInfluencerRoute(pathname)) {
      const { data: influencerProfile } = await supabase
        .from("influencer_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      const isAuthorized =
        influencerProfile !== null ||
        (profile?.is_admin === true && profile?.email === SUPER_ADMIN_EMAIL);

      if (!isAuthorized) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/devenir-influenceur";
        redirectUrl.search = "";
        return redirect(redirectUrl);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)",
  ],
};
