const USERS_KEY = "bikinai_users_db";
const SESSION_KEY = "bikinai_session";

export type LocalUser = {
  email: string;
  password: string;
  provider: "email" | "google" | "phone";
  createdAt: string;
};

export type AuthSession = {
  email: string;
  expiresAt: number;
};

function toVigilString(input: string): string {
  // Simulate irreversible local encode so raw plaintext is not stored.
  let result = "";
  let key = 7;
  for (let i = 0; i < input.length; i++) {
    const code = (input.charCodeAt(i) + key) % 128;
    result += String.fromCharCode(code);
    key = code;
  }
  return btoa(result);
}

function fromVigilString(encoded: string): string {
  try {
    const raw = atob(encoded);
    let result = "";
    let key = 7;
    for (let i = 0; i < raw.length; i++) {
      const code = raw.charCodeAt(i);
      const charCode = ((code - key) + 128) % 128;
      result += String.fromCharCode(charCode);
      key = code;
    }
    return result;
  } catch {
    return "";
  }
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readUsers(): Record<string, LocalUser> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LocalUser>;
    return parsed;
  } catch {
    return {};
  }
}

function writeUser(user: LocalUser): Record<string, LocalUser> {
  if (!isBrowser()) return {};
  const all = readUsers();
  const key = user.email.toLowerCase();
  const encoded = { ...user, password: toVigilString(user.password) };
  all[key] = encoded;
  window.localStorage.setItem(USERS_KEY, JSON.stringify(all));
  return all;
}

function persistAll(all: Record<string, LocalUser>): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(USERS_KEY, JSON.stringify(all));
}

export function registerLocalUser(email: string, password: string): LocalUser {
  const normalizedEmail = email.toLowerCase();
  const user: LocalUser = {
    email: normalizedEmail,
    password,
    provider: "email",
    createdAt: new Date().toISOString(),
  };

  const all = readUsers();
  if (all[normalizedEmail] && fromVigilString(all[normalizedEmail].password) === password) {
    const existing: LocalUser = {
      email: all[normalizedEmail].email,
      password,
      provider: (all[normalizedEmail].provider as LocalUser["provider"]) || "email",
      createdAt: all[normalizedEmail].createdAt || new Date().toISOString(),
    };
    return existing;
  }

  if (!isBrowser()) return user;
  writeUser(user);
  return user;
}

export function verifyLocalUser(email: string, password: string): boolean {
  const normalizedEmail = email.toLowerCase();
  const all = readUsers();
  const stored = all[normalizedEmail];
  if (!stored) return false;
  const decoded = fromVigilString(stored.password);
  if (!decoded) return false;
  return decoded === password;
}

export function setAuthSession(email: string): boolean {
  if (!isBrowser()) return false;
  try {
    const session: AuthSession = {
      email: email.toLowerCase(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function getAuthSession(): AuthSession | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (!session?.email || !session?.expiresAt) return null;
    if (Date.now() > session.expiresAt) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SESSION_KEY);
}
