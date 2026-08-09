import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { Session, SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";

type MockUser = SupabaseUser;
type SupabaseMockSession = { data: { session: { user: MockUser } | null }; error: null };
type SupabaseMockUserResponse = { data: { user: MockUser | null }; error: null };

type SupabaseMockAuth = {
  getSession(): Promise<SupabaseMockSession>;
  getUser(): Promise<SupabaseMockUserResponse>;
  onAuthStateChange(
    cb: (event: string, session: Session | null) => void,
  ): { data: { subscription: { unsubscribe: () => void } } };
  signInWithOAuth(_opts: Record<string, unknown>): Promise<{ data: null; error: null }>;
  signOut(): Promise<{ error: null }>;
  resetPasswordForEmail(_email: string, _opts?: Record<string, unknown>): Promise<{ error: null }>;
  signInWithPassword(_creds: Record<string, unknown>): Promise<{ data: null; error: { message: string } }>;
};

type MockClient = { auth: SupabaseMockAuth; from: (table: string) => unknown };
type RuntimeClient = SupabaseClient;

// Lightweight mockable supabase client for Playwright tests.
function createMockClient(mockUser: unknown): MockClient {
  const user = (mockUser as MockUser) ?? null;
  const stubQuery = () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }) }) }),
    update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
    insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
    upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
  });
  return {
    auth: {
      async getSession() {
        return { data: { session: user ? { user } : null }, error: null };
      },
      async getUser() {
        return { data: { user: user ?? null }, error: null };
      },
      onAuthStateChange(cb: (event: string, session: Session | null) => void) {
        // Immediately invoke callback to simulate signed-in state
        if (user && typeof cb === "function") {
          try {
            cb("SIGNED_IN", { user } as Session);
          } catch {
            // ignore
          }
        }
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      async signInWithOAuth(_opts: Record<string, unknown>) {
        return { data: null, error: null };
      },
      async signOut() {
        return { error: null };
      },
      async resetPasswordForEmail(_email: string, _opts?: Record<string, unknown>) {
        return { error: null };
      },
      async signInWithPassword(_creds: Record<string, unknown>) {
        return { data: null, error: { message: "not implemented in mock" } };
      },
    },
    from: stubQuery,
  };
}

function createRuntimeClient(): RuntimeClient {
  if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).__PLAYWRIGHT_MOCK_USER) {
    return createMockClient((window as unknown as Record<string, unknown>).__PLAYWRIGHT_MOCK_USER) as unknown as RuntimeClient;
  }

  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const supabase = createRuntimeClient();

export function createBrowserClient() {
  return createRuntimeClient();
}

export function createClient() {
  return createRuntimeClient();
}
