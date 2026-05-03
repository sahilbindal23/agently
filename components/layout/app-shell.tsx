import Link from "next/link";
import { Activity, BarChart3, Bell, Bot, BriefcaseBusiness, ClipboardList, CreditCard, FileText, HelpCircle, Home, LayoutDashboard, MessageSquare, MessageSquareText, Palette, Users } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { HomeLogo } from "@/components/layout/home-logo";
import { GuidedWalkthrough } from "@/components/onboarding/guided-walkthrough";
import { WalkthroughLaunchButton } from "@/components/onboarding/walkthrough-launch-button";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkflowNudges } from "@/lib/workflow/nudges";

const adminNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tour: "dashboard" },
  { href: "/creators", label: "Creators", icon: Users, tour: "creators" },
  { href: "/freelancers", label: "Freelancers", icon: Palette, tour: "freelancers" },
  { href: "/campaigns", label: "Campaigns", icon: ClipboardList, tour: "campaigns" },
  { href: "/deals", label: "Deals", icon: BriefcaseBusiness, tour: "offers" },
  { href: "/messages", label: "Messages", icon: MessageSquare, tour: "messages" },
  { href: "/activity", label: "Activity", icon: Activity, tour: "activity" },
  { href: "/contracts", label: "Contracts", icon: FileText, tour: "contracts" },
  { href: "/payments", label: "Payments", icon: CreditCard, tour: "payments" },
  { href: "/ai-insights", label: "AI Insights", icon: Bot, tour: "ai" },
  { href: "/demo-guide", label: "Walkthrough", icon: HelpCircle, tour: "walkthrough" },
  { href: "/feedback", label: "Feedback", icon: MessageSquareText, tour: "feedback" }
];

const creatorNav = [
  { href: "/creator-home", label: "Home", icon: Home, tour: "home" },
  { href: "/profile", label: "Edit Profile", icon: Users, tour: "profile" },
  { href: "/offers", label: "Offers", icon: BriefcaseBusiness, tour: "offers" },
  { href: "/messages", label: "Messages", icon: MessageSquare, tour: "messages" },
  { href: "/activity", label: "Activity", icon: Activity, tour: "activity" },
  { href: "/freelancer-home", label: "Freelancer Profile", icon: Palette, tour: "freelancers" },
  { href: "/ai-insights", label: "AI Tools", icon: Bot, tour: "ai" },
  { href: "/payments", label: "Payments", icon: CreditCard, tour: "payments" },
  { href: "/demo-guide", label: "Walkthrough", icon: HelpCircle, tour: "walkthrough" },
  { href: "/feedback", label: "Feedback", icon: MessageSquareText, tour: "feedback" }
];

const brandNav = [
  { href: "/brand-home", label: "Home", icon: Home, tour: "home" },
  { href: "/profile", label: "Edit Profile", icon: Users, tour: "profile" },
  { href: "/campaigns", label: "Campaigns", icon: ClipboardList, tour: "campaigns" },
  { href: "/brand-insights", label: "Insights", icon: BarChart3, tour: "insights" },
  { href: "/deals", label: "Offers", icon: BriefcaseBusiness, tour: "offers" },
  { href: "/messages", label: "Messages", icon: MessageSquare, tour: "messages" },
  { href: "/activity", label: "Activity", icon: Activity, tour: "activity" },
  { href: "/payments", label: "Payments", icon: CreditCard, tour: "payments" },
  { href: "/demo-guide", label: "Walkthrough", icon: HelpCircle, tour: "walkthrough" },
  { href: "/feedback", label: "Feedback", icon: MessageSquareText, tour: "feedback" }
];

const freelancerNav = [
  { href: "/freelancer-home", label: "Home", icon: Home, tour: "home" },
  { href: "/profile", label: "Edit Profile", icon: Users, tour: "profile" },
  { href: "/offers", label: "Offers", icon: BriefcaseBusiness, tour: "offers" },
  { href: "/messages", label: "Messages", icon: MessageSquare, tour: "messages" },
  { href: "/activity", label: "Activity", icon: Activity, tour: "activity" },
  { href: "/ai-insights", label: "AI Tools", icon: Bot, tour: "ai" },
  { href: "/payments", label: "Payments", icon: CreditCard, tour: "payments" },
  { href: "/demo-guide", label: "Walkthrough", icon: HelpCircle, tour: "walkthrough" },
  { href: "/feedback", label: "Feedback", icon: MessageSquareText, tour: "feedback" }
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const [nudges, unreadMessages] = user && admin ? await Promise.all([getWorkflowNudges(admin, user), getUnreadMessageCount(user.id)]) : [[], 0];
  const notification = nudges[0] ?? null;
  const nav = user?.role === "creator" ? creatorNav : user?.role === "brand" ? brandNav : user?.role === "freelancer" ? freelancerNav : adminNav;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b bg-white/85 backdrop-blur lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="px-3 py-3"><HomeLogo className="w-full px-2" /></div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={`nav-${item.tour}`}
                className="flex min-w-fit items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                <span className="flex flex-1 items-center justify-between gap-2">
                  {item.label}
                  {item.href === "/messages" && unreadMessages > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{unreadMessages}</span>
                  ) : null}
                  {item.href === "/activity" && nudges.length > 0 ? (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">{nudges.length}</span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden p-3 lg:block">
          <div className="rounded-lg border bg-white p-3">
            <div className="mb-3">
              <p className="truncate text-sm font-semibold">{user?.full_name ?? "Prototype user"}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email ?? "Not signed in"}</p>
              <Badge className="mt-2" tone="blue">{user?.role ?? "guest"}</Badge>
            </div>
            <WalkthroughLaunchButton className="mb-2 w-full" label="Start walkthrough" />
            {user ? <LogoutButton /> : (
              <Link href="/login" className="text-sm font-medium text-primary">Login</Link>
            )}
          </div>
        </div>
      </aside>
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 space-y-2">
          {unreadMessages > 0 ? (
            <Link className="flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900" href="/messages">
              <span className="inline-flex items-center gap-2"><MessageSquare className="h-4 w-4" /> {unreadMessages} unread message{unreadMessages === 1 ? "" : "s"} in campaign conversations.</span>
              <span className="font-semibold">Open</span>
            </Link>
          ) : null}
          {notification ? (
            <Link className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" href={notification.href}>
              <span className="inline-flex items-center gap-2"><Bell className="h-4 w-4" /> {notification.title}: {notification.description}</span>
              <span className="font-semibold">{notification.cta}</span>
            </Link>
          ) : null}
        </div>
        {children}
      </main>
      <GuidedWalkthrough role={user?.role ?? "admin"} />
    </div>
  );
}

async function getUnreadMessageCount(profileId: string) {
  const admin = createAdminClient();
  if (!admin) return 0;

  const { data: participants } = await admin
    .from("message_thread_participants")
    .select("thread_id, last_read_at")
    .eq("profile_id", profileId);
  const rows = participants ?? [];
  const threadIds = rows.map((row) => String(row.thread_id));
  if (!threadIds.length) return 0;

  const { data: messages } = await admin
    .from("messages")
    .select("thread_id, sender_profile_id, created_at")
    .in("thread_id", threadIds)
    .neq("sender_profile_id", profileId);

  return (messages ?? []).filter((message) => {
    const participant = rows.find((row) => row.thread_id === message.thread_id);
    const lastReadAt = participant?.last_read_at ? new Date(String(participant.last_read_at)).getTime() : 0;
    return new Date(String(message.created_at)).getTime() > lastReadAt;
  }).length;
}
