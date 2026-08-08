import type { Metadata } from "next";
import "./globals.css";
import { createAdminClient } from "@/lib/supabase/admin";

async function getConfig(): Promise<{ platform_name: string; platform_logo: string; seo_hashtags: string }> {
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (admin as any).from("founder_config").select("key_name,key_value");
    if (!response.error && Array.isArray(response.data)) {
      const config: Record<string, string> = {};
      (response.data as Array<{ key_name: string; key_value: string | null }>).forEach((item) => {
        if (item.key_name) {
          config[item.key_name] = item.key_value ?? "";
        }
      });
      return {
        platform_name: String(config.platform_name || "BIKIN AI"),
        platform_logo: String(config.platform_logo || ""),
        seo_hashtags: String(config.seo_hashtags || "AI Indonesia, GPT Indonesia, AI Nusantara"),
      };
    }
  } catch {
    // ignore and use defaults
  }

  return {
    platform_name: "BIKIN AI",
    platform_logo: "",
    seo_hashtags: "AI Indonesia, GPT Indonesia, AI Nusantara",
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getConfig();
  return {
    title: config.platform_name,
    description: `Platform agregator AI nomor satu di Indonesia untuk Guru, Mahasiswa, dan UMKM. ${config.platform_name} - Solusi AI cerdas untuk pendidikan dan bisnis.`,
    keywords: config.seo_hashtags,
    other: {
      keywords: config.seo_hashtags,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await getConfig();
  const hashtags = config.seo_hashtags;
  const logo = config.platform_logo;

  return (
    <html lang="id">
      <head>
        <meta name="keywords" content={hashtags} />
        {logo ? <link rel="icon" href={logo} type="image/x-icon" /> : null}
        {logo ? <link rel="apple-touch-icon" href={logo} /> : null}
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}