"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import type { CurrentUser } from "@/lib/auth/session";

export function SentryUserContext({ user }: { user: CurrentUser }) {
  useEffect(() => {
    if (!user) {
      Sentry.setUser(null);
      return;
    }

    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.full_name,
      role: user.role
    });
  }, [user]);

  return null;
}
