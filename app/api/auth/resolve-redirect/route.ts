import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(_cookiesToSet: unknown) {
          // noop on purpose for this read-only check
        },
      },
    }
  );

  try {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      console.error('resolve-redirect getUser error:', userErr);
      return NextResponse.json({ target: '/login' });
    }

    if (!user) {
      return NextResponse.json({ target: '/login' });
    }

    if (!user.email_confirmed_at) {
      return NextResponse.json({ target: '/login' });
    }

    // Priority 1: Check users table FIRST (regular users)
    const profileRes = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<{ role: string }>();

    if (profileRes.data) {
      if (profileRes.data.role === 'user') {
        return NextResponse.json({ target: '/dashboard' });
      }
      if (profileRes.data.role === 'founder') {
        return NextResponse.json({ target: '/x-founder-control-99f7jK' });
      }
    }

    // Priority 2: Check founder table for founder access
    const founderRes = await supabase
      .from('founder')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<{ role: string }>();

    if (founderRes.data?.role === 'founder') {
      return NextResponse.json({ target: '/x-founder-control-99f7jK' });
    }

    // Default to dashboard for authenticated users
    return NextResponse.json({ target: '/dashboard' });
  } catch (err) {
    console.error('resolve-redirect unexpected error:', err);
    return NextResponse.json({ target: '/dashboard' });
  }
}
