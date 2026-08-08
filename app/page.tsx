import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "@/components/LoginForm";

async function getRedirectTarget() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return null;
  }

  if (!authData.user.email_confirmed_at) {
    return null;
  }

  // Prefer user routing if the auth user is stored in users table.
  const profile = await supabase
    .from("users")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle<{ role: string }>();

  if (profile.data) {
    if (profile.data.role === "user") {
      return "/dashboard";
    }
    if (profile.data.role === "founder") {
      return "/x-founder-control-99f7jK";
    }
  }

  // If user role not present, fallback to founder table.
  const founderProfile = await supabase
    .from("founder")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle<{ role: string }>();

  if (founderProfile.data && founderProfile.data.role === "founder") {
    return "/x-founder-control-99f7jK";
  }

  return null;
}

export default async function HomePage(props: unknown) {
  const searchParams = await (props as { searchParams?: Promise<Record<string, string | string[]> | undefined> })?.searchParams;
  const searchParamsValue = searchParams as Record<string, string | string[]> | undefined;

  // If the URL contains an OAuth error (e.g. bad_oauth_state), show the login page
  // with the error instead of auto-redirecting to a dashboard.
  const hasError = !!(searchParamsValue && (searchParamsValue.error || searchParamsValue.error_description));

  if (hasError) {
    return <LoginForm />;
  }

  const target = await getRedirectTarget();

  if (target) {
    redirect(target);
  }

  return <LoginForm />;
}