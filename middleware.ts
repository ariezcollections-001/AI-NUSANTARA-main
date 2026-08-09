import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Parameters<typeof res.cookies.set>[2] }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const pathname = req.nextUrl.pathname;
  const isFounderArea = pathname.startsWith('/x-founder-control-99f7jK');
  const isDashboardArea = pathname.startsWith('/dashboard');
  const isFounderLoginPage = pathname === '/founder-login' || pathname.startsWith('/founder-login/');
  const isRoot = pathname === '/';

  // Not authenticated yet.
  if (userError || !user) {
    if (isFounderLoginPage) {
      return res; // Show founder login page
    }
    if (isFounderArea) {
      return NextResponse.redirect(new URL('/founder-login', req.url));
    }
    if (isDashboardArea) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Homepage "/" and everything else: show the regular USER login page
    return res;
  }

  if (!user.email_confirmed_at) {
    if (isFounderLoginPage) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    if (isFounderArea) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    if (isDashboardArea) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Homepage "/" and everything else: show the regular USER login page
    return res;
  }

  const profileRes = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();

  // Check founder table FIRST (authoritative source)
  const founderRes = await supabase
    .from('founder')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();

  const isFounder = founderRes.data?.role === 'founder';

  // Check users table for regular user role
  const isUser = profileRes.data?.role === 'user';

  // Route protection logic
  if (isFounderArea) {
    // Only founders can access founder area
    if (!isFounder) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return res;
  }

  if (isFounderLoginPage) {
    // If already authenticated as founder, redirect to founder panel
    if (isFounder) {
      return NextResponse.redirect(new URL('/x-founder-control-99f7jK', req.url));
    }
    // If authenticated as regular user, redirect to user homepage (login page)
    if (isUser) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Allow access to founder login page for unclassified users
    return res;
  }

  // HOMEPAGE (root "/") and "/login": ALWAYS show the regular USER login page.
  // Do NOT auto-redirect authenticated users away from the homepage so that
  // visiting the site root always lands on the user login form.
  if (isRoot) {
    return res;
  }

  if (isDashboardArea) {
    // Founders accessing dashboard should be redirected to founder panel
    if (isFounder) {
      return NextResponse.redirect(new URL('/x-founder-control-99f7jK', req.url));
    }
    // Regular users and unclassified users can access dashboard
    return res;
  }

  // Default: redirect to homepage (user login) for unauthenticated or unmatched routes
  return NextResponse.redirect(new URL('/', req.url));
}

export const config = {
  matcher: [
    '/',
    '/dashboard',
    '/dashboard/:path*',
    '/x-founder-control-99f7jK',
    '/x-founder-control-99f7jK/:path*',
    '/founder-login',
    '/founder-login/:path*',
  ],
};
