"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | null;
};

export function MobileNav({
  nav,
  userName,
  userEmail,
  userRole,
  unreadMessages,
  unreadNotifications,
  pendingOffers
}: {
  nav: NavItem[];
  userName?: string;
  userEmail?: string;
  userRole?: string;
  unreadMessages?: number;
  unreadNotifications?: number;
  pendingOffers?: number;
}) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button
        aria-label="Open navigation"
        className="flex h-9 w-9 items-center justify-center rounded-md border bg-white text-foreground transition hover:bg-muted dark:border-white/10 dark:bg-card dark:hover:bg-muted lg:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-4 w-4" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            ref={drawerRef}
            className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white shadow-xl dark:bg-card"
          >
            <div className="flex items-center justify-between border-b px-4 py-3 dark:border-white/8">
              <p className="text-sm font-bold">Agently</p>
              <button
                aria-label="Close navigation"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted dark:hover:bg-white/6"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-3">
              {nav.map((item) => {
                const isMessages = item.href === "/messages";
                const isNotifications = item.href === "/notifications" || item.href === "/activity";
                const msgBadge = isMessages && unreadMessages ? unreadMessages : null;
                const notifBadge = isNotifications && unreadNotifications ? unreadNotifications : null;
                const badge = msgBadge ?? notifBadge;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground dark:hover:bg-white/6 dark:hover:text-foreground"
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="flex flex-1 items-center justify-between gap-2">
                      {item.label}
                      {badge ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isMessages ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400" : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400"}`}>
                          {badge}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {(userName || userEmail) ? (
              <div className="border-t p-3 dark:border-white/8">
                <div className="rounded-lg border bg-muted p-3 dark:border-white/8 dark:bg-white/4">
                  <p className="truncate text-sm font-semibold">{userName ?? "User"}</p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                  {userRole ? <p className="mt-1 text-xs font-medium text-primary">{userRole}</p> : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
