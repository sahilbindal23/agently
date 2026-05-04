"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

type WorkflowNotification = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

export function WorkflowNotificationLink({ notification }: { notification: WorkflowNotification }) {
  const pathname = usePathname();
  if (pathname === "/activity") return null;

  return (
    <Link className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" href={notification.href}>
      <span className="inline-flex items-center gap-2"><Bell className="h-4 w-4" /> {notification.title}: {notification.description}</span>
      <span className="font-semibold">{notification.cta}</span>
    </Link>
  );
}
