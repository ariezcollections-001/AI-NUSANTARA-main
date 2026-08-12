export function getAppUrl(req?: Request): string {
  // Defender: saat modal development (next dev) paksa localhost selalu,
  // jadi redirect_to yang dikirim ke Supabase tidak pernah salah ke Vercel
  // meskipun header origin/host hilang atau aneh.
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }
  if (req) {
    const origin = req.headers.get("origin");
    if (origin) return origin;
    const host = req.headers.get("host");
    if (host) return host.includes("localhost") ? `http://${host}` : `https://${host}`;
  }
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
