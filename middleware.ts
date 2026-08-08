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

  if (userError || !user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (!user.email_confirmed_at) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const profileRes = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();

  if (profileRes.data) {
    if (profileRes.data.role === 'founder' && isDashboardArea) {
      return NextResponse.redirect(new URL('/x-founder-control-99f7jK', req.url));
    }
    if (profileRes.data.role === 'user' && isFounderArea) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return res;
  }

  const founderRes = await supabase
    .from('founder')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();

  if (founderRes.data?.role === 'founder') {
    if (isDashboardArea) {
      return NextResponse.redirect(new URL('/x-founder-control-99f7jK', req.url));
    }
    return res;
  }

  if (isFounderArea) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  if (isDashboardArea) {
    return res;
  }

  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/x-founder-control-99f7jK',
    '/x-founder-control-99f7jK/:path*',
  ],
};