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
      // Check if user exists in users table
      const { data: profile, error: profileReadError } = await supabase
        .from('users')
        .select('email')
        .eq('email', user.email)
        .maybeSingle();

      if (profileReadError) {
        console.error('Failed to read users for OAuth user:', profileReadError);
      }

      // If user doesn't exist, create with default 'user' role
      if (!profile) {
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            email: user.email,
            role: 'user',
          });

        if (insertError) {
          console.error('Failed to create user for OAuth user:', insertError);
        }
      }
    } catch (_error) {
      console.error('Unexpected error while syncing OAuth profile:', _error);
    }
  }

  return response;
}