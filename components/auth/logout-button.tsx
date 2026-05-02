"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="ghost" className="w-full justify-start" onClick={logout} disabled={loading}>
      <LogOut className="h-4 w-4" />
      {loading ? "Signing out..." : "Logout"}
    </Button>
  );
}
