"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveUserRole } from "@/lib/auth";

export function useRoleGuard(allowedRole: "user" | "founder") {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const checkRole = async () => {
      try {
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        const role = await resolveUserRole(user.id);

        if (role === "user") {
          if (allowedRole === "user") {
            if (active) setReady(true);
            return;
          }
          router.replace("/dashboard");
          return;
        }

        if (role === "founder") {
          if (allowedRole === "founder") {
            if (active) setReady(true);
            return;
          }
          router.replace("/x-founder-control-99f7jK");
          return;
        }

        router.replace("/login");
      } catch {
        router.replace("/login");
      }
    };

    void checkRole();
    return () => {
      active = false;
    };
  }, [allowedRole, router]);

  return ready;
}
