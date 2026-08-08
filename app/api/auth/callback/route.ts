import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const errorParam = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  if (!code) {
    if (errorParam) {
      const redirectParams = new URLSearchParams();
      redirectParams.set('error', errorParam);
      if (errorDescription) {
        redirectParams.set('error_description', errorDescription);
      }
      return NextResponse.redirect(new URL(`/login?${redirectParams.toString()}`, request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const cookieStore = await cookies();
  
  // Create response first so we can set cookies on it
  const response = NextResponse.redirect(new URL('/auth/confirm', request.url));
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error('OAuth callback exchangeCodeForSession failed:', exchangeError);
    const redirectParams = new URLSearchParams();
    redirectParams.set('error', exchangeError.message || 'OAuth callback gagal');
    return NextResponse.redirect(new URL(`/login?${redirectParams.toString()}`, request.url));
  }

  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (getUserError) {
    console.error('OAuth callback getUser failed:', getUserError);
  }

  if (user?.email) {
    try {
      const { data: profile, error: profileReadError } = await supabase
        .from('users_profile')
        .select('email')
        .eq('email', user.email)
        .maybeSingle();

      if (profileReadError) {
        console.error('Failed to read users_profile for OAuth user:', profileReadError);
      }

      if (!profile) {
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
        const { error: insertError } = await supabase
          .from('users_profile')
          .insert({
            email: user.email,
            full_name: fullName,
            quota_balance: 50000,
          });

        if (insertError) {
          console.error('Failed to create users_profile for OAuth user:', insertError);
        }
      }
    } catch (error) {
      console.error('Unexpected error while syncing OAuth profile:', error);
    }
  }

  return response;
}