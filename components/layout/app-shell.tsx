import Link from "next/link";
import { Activity, AlertOctagon, BarChart3, Bell, Bot, BrainCircuit, BriefcaseBusiness, ClipboardList, CreditCard, FileText, HelpCircle, Home, LayoutDashboard, MessageSquare, MessageSquareText, Palette, ScrollText, ShieldAlert, Siren, Trash2, Users } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { HomeLogo } from "@/components/layout/home-logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SentryUserContext } from "@/components/monitoring/sentry-user-context";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { GuidedWalkthrough } from "@/components/onboarding/guided-walkthrough";
import { WalkthroughLaunchButton } from "@/components/onboarding/walkthrough-launch-button";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureNotificationsForUser, getUnreadNotificationCount, getUserNotifications } from "@/lib/notifications/workflow-notifications";
import { creatorCompleteness, freelancerCompleteness } from "@/lib/profile/completeness";
import { createAdminClient } from "@/lib/supabase/admin";

const adminNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tour: "dashboard" },
  { href: "/ops", label: "Ops Center", icon: Activity, tour: "activity" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, tour: "insights" },
  { href: "/engine-room", label: "Engine Room", icon: BrainCircuit, tour: "ai" },
  { href: "/outcome-ledger", label: "Outcome Ledger", icon: ClipboardList, tour: "insights" },
  { href: "/rate-benchmarks", label: "Rate Benchmarks", icon: BarChart3, tour: "insights" },
  { href: "/creators", label: "Creators", icon: Users, tour: "creators" },
  { href: "/freelancers", label: "Freelancers", icon: Palette, tour: "freelancers" },
  { href: "/campaigns", label: "Campaigns", icon: ClipboardList, tour: "campaigns" },
  { href: "/deals", label: "Deals", icon: BriefcaseBusiness, tour: "offers" },
  { href: "/messages", label: "Messages", icon: MessageSquare, tour: "messages" },
  { href: "/notifications", label: "Notifications", icon: Bell, tour: "activity" },
  { href: "/activity", label: "Activity", icon: Activity, tour: "activity" },
  { href: "/contracts", label: "Contracts", icon: FileText, tour: "contracts" },
  { href: "/disputes", label: "Disputes", icon: AlertOctagon, tour: "disputes" },
  { href: "/benchmarks/anomalies", label: "Anomalies", icon: ShieldAlert, tour: "anomalies" },
  { href: "/admin/audit-logs", label: "Audit logs", icon: ScrollText, tour: "audit_logs" },
  { href: "/admin/deletion-requests", label: "Deletion requests", icon: Trash2, tour: "deletion_requests" },
  { href: "/admin/emergency-tools", label: "Emergency tools", icon: Siren, tour: "emergency_tools" },
  { href: "/payments", label: "Payments", icon: CreditCard, tour: "payments" },
  { href: "/ai-insights", label: "AI Insights", icon: Bot, tour: "ai" },
  { href: "/demo-guide", label: "Walkthrough", icon: HelpCircle, tour: "walkthrough" },
  { href: "/feedback", label: "FAQ", icon: MessageSquareText, tour: "feedback" }
];

const creatorNav = [
  { href: "/creator-home", label: "Home", icon: Home, tour: "home" },
  { href: "/profile", label: "Edit Profile", icon: Users, tour: "profile" },
  { href: "/offers", label: "Offers", icon: BriefcaseBusiness, tour: "offers" },
  { href: "/campaigns/discover", label: "Open Campaigns", icon: ClipboardList, tour: "campaigns" },
  // /creators is reachable via the "Creators" tab on /creator-home and
  // links from individual cards. Removed from nav to reduce the rail's
  // length; the home-page tab is the primary entry point now.
  { href: "/messages", label: "Messages", icon: MessageSquare, tour: "messages" },
  { href: "/notifications", label: "Notifications", icon: Bell, tour: "activity" },
  { href: "/activity", label: "Activity", icon: Activity, tour: "activity" },
  { href: "/freelancer-home", label: "Freelancer Profile", icon: Palette, tour: "freelancers" },
  { href: "/ai-insights", label: "AI Tools", icon: Bot, tour: "ai" },
  { href: "/payments", label: "Payments", icon: CreditCard, tour: "payments" },
  { href: "/demo-guide", label: "Walkthrough", icon: HelpCircle, tour: "walkthrough" },
  { href: "/feedback", label: "FAQ", icon: MessageSquareText, tour: "feedback" }
];

const brandNav = [
  { href: "/brand-home", label: "Home", icon: Home, tour: "home" },
  { href: "/profile", label: "Edit Profile", icon: Users, tour: "profile" },
  { href: "/campaigns", label: "Campaigns", icon: ClipboardList, tour: "campaigns" },
  { href: "/brand-insights", label: "Insights", icon: BarChart3, tour: "insights" },
  { href: "/deals", label: "Offers", icon: BriefcaseBusiness, tour: "offers" },
  { href: "/messages", label: "Messages", icon: MessageSquare, tour: "messages" },
  { href: "/notifications", label: "Notifications", icon: Bell, tour: "activity" },
  { href: "/activity", label: "Activity", icon: Activity, tour: "activity" },
  { href: "/payments", label: "Payments", icon: CreditCard, tour: "payments" },
  { href: "/demo-guide", label: "Walkthrough", icon: HelpCircle, tour: "walkthrough" },
  { href: "/feedback", label: "FAQ", icon: MessageSquareText, tour: "feedback" }
];

const freelancerNav = [
  { href: "/freelancer-home", label: "Home", icon: Home, tour: "home" },
  { href: "/profile", label: "Edit Profile", icon: Users, tour: "profile" },
  { href: "/offers", label: "Offers", icon: BriefcaseBusiness, tour: "offers" },
  { href: "/campaigns/discover", label: "Open Campaigns", icon: ClipboardList, tour: "campaigns" },
  { href: "/messages", label: "Messages", icon: MessageSquare, tour: "messages" },
  { href: "/notifications", label: "Notifications", icon: Bell, tour: "activity" },
  { href: "/activity", label: "Activity", icon: Activity, tour: "activity" },
  { href: "/ai-insights", label: "AI Tools", icon: Bot, tour: "ai" },
  { href: "/payments", label: "Payments", icon: CreditCard, tour: "payments" },
  { href: "/demo-guide", label: "Walkthrough", icon: HelpCircle, tour: "walkthrough" },
  { href: "/feedback", label: "FAQ", icon: MessageSquareText, tour: "feedback" }
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const nudges = user && admin ? await ensureNotificationsForUser(admin, user) : [];
  const [unreadMessages, notifications, unreadNotifications, pendingOffers, openDisputes] = user && admin
    ? await Promise.all([
      getUnreadMessageCount(user.id),
      getUserNotifications(admin, user, 6),
      getUnreadNotificationCount(admin, user.id),
      getPendingOfferCount(admin, user.id, user.role),
      user.role === "admin" ? getOpenDisputeCount(admin) : Promise.resolve(0)
    ])
    : [0, [], 0, 0, 0];
  const activeNotifications = notifications.filter((notification) => notification.status === "unread");
  const activityOpenItems = user && admin
    ? await getActivityOpenItemCount(admin, user, nudges.length)
    : 0;
  const nav = user?.role === "creator" ? creatorNav : user?.role === "brand" ? brandNav : user?.role === "freelancer" ? freelancerNav : adminNav;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <SentryUserContext user={user} />
      <aside className="hidden border-r bg-white/85 backdrop-blur dark:border-white/8 dark:bg-card/80 lg:flex lg:min-h-screen lg:flex-col">
        <div className="px-3 py-3"><HomeLogo className="w-full px-2" /></div>
        <nav className="flex flex-col gap-1 overflow-y-auto px-3 pb-3">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={`nav-${item.tour}`}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground dark:hover:bg-white/6 dark:hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                <span className="flex flex-1 items-center justify-between gap-2">
                  {item.label}
                  {item.href === "/messages" && unreadMessages > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">{unreadMessages}</span>
                  ) : null}
                  {item.href === "/notifications" && unreadNotifications > 0 ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${unreadNotifications > 0 ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400" : "bg-blue-100 text-blue-800 dark:bg-sky-950/60 dark:text-sky-400"}`}>
                      {unreadNotifications}
                    </span>
                  ) : null}
                  {item.href === "/activity" && activityOpenItems > 0 ? (
                    <span aria-label={`${activityOpenItems} open activity item${activityOpenItems === 1 ? "" : "s"}`} className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950/60 dark:text-red-400">
                      {activityOpenItems}
                    </span>
                  ) : null}
                  {item.href === "/offers" && pendingOffers > 0 ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950/60 dark:text-red-400">{pendingOffers}</span>
                  ) : null}
                  {item.href === "/disputes" && openDisputes > 0 ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950/60 dark:text-red-400">{openDisputes}</span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pb-3">
          <div className="rounded-lg border bg-white p-3 dark:border-white/8 dark:bg-card">
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
        <div className="mb-4 flex items-center justify-between gap-2 lg:justify-end">
          <MobileNav
            nav={nav.map((item) => {
              const Icon = item.icon;
              return { href: item.href, label: item.label, icon: <Icon className="h-4 w-4" /> };
            })}
            userName={user?.full_name}
            userEmail={user?.email}
            userRole={user?.role}
            unreadMessages={unreadMessages}
            unreadNotifications={unreadNotifications}
            activityOpenItems={activityOpenItems}
            pendingOffers={pendingOffers}
          />
          <div className="flex items-center gap-2 self-start">
            <ThemeToggle />
            {user && admin ? <NotificationBell notifications={activeNotifications} unreadCount={unreadNotifications} /> : null}
          </div>
        </div>
        <div className="mb-4 space-y-2">
          {unreadMessages > 0 ? (
            <Link className="flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300" href="/messages">
              <span className="inline-flex items-center gap-2"><MessageSquare className="h-4 w-4" /> {unreadMessages} unread message{unreadMessages === 1 ? "" : "s"} in campaign conversations.</span>
              <span className="font-semibold">Open</span>
            </Link>
          ) : null}
        </div>
        {children}
      </main>
      <GuidedWalkthrough role={user?.role ?? "admin"} />
    </div>
  );
}

type ShellUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

async function getActivityOpenItemCount(admin: AdminClient, user: ShellUser, nudgeCount: number) {
  const roleProfileCount = user.role === "creator"
    ? await getCreatorReadinessCount(admin, user.id)
    : user.role === "freelancer"
      ? await getFreelancerReadinessCount(admin, user.id)
      : 0;

  return nudgeCount + roleProfileCount;
}

async function getCreatorReadinessCount(admin: AdminClient, profileId: string) {
  const { data: creator } = await admin.from("creators").select("*").eq("profile_id", profileId).maybeSingle();
  if (!creator) return 1;

  const [{ data: platforms }, { data: deals }, { data: audits }] = await Promise.all([
    admin.from("creator_platforms").select("*").eq("creator_id", creator.id),
    admin.from("deals").select("*").eq("creator_id", creator.id),
    admin.from("creator_audits").select("id").eq("creator_id", creator.id).limit(1)
  ]);

  const completeness = creatorCompleteness({
    creator: creator as Record<string, unknown>,
    platforms: platforms ?? [],
    deals: deals ?? [],
    hasAudit: Boolean(audits?.length)
  });

  return completeness.items.filter((item) => !item.done).length;
}

async function getFreelancerReadinessCount(admin: AdminClient, profileId: string) {
  const { data: freelancer } = await admin.from("freelancers").select("*").eq("profile_id", profileId).maybeSingle();
  if (!freelancer) return 1;

  const [{ data: serviceRates }, { data: portfolio }, { data: projects }] = await Promise.all([
    admin.from("freelancer_service_rates").select("*").eq("freelancer_id", freelancer.id),
    admin.from("portfolio_items").select("*").eq("freelancer_id", freelancer.id),
    admin.from("freelancer_projects").select("*").eq("freelancer_id", freelancer.id)
  ]);

  const completeness = freelancerCompleteness({
    freelancer: freelancer as Record<string, unknown>,
    serviceRates: serviceRates ?? [],
    portfolio: portfolio ?? [],
    projects: projects ?? []
  });

  return completeness.items.filter((item) => !item.done).length;
}

async function getOpenDisputeCount(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const { count } = await admin.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open");
  return count ?? 0;
}

async function getPendingOfferCount(admin: NonNullable<ReturnType<typeof createAdminClient>> | null, profileId: string, role?: string) {
  if (!admin) return 0;
  if (role === "creator") {
    const { data: creator } = await admin.from("creators").select("id").eq("profile_id", profileId).maybeSingle();
    if (!creator) return 0;
    const { count } = await admin.from("deals").select("id", { count: "exact", head: true }).eq("creator_id", creator.id).eq("offer_status", "submitted");
    return count ?? 0;
  }
  if (role === "freelancer") {
    const { data: freelancer } = await admin.from("freelancers").select("id").eq("profile_id", profileId).maybeSingle();
    if (!freelancer) return 0;
    const { count } = await admin.from("freelancer_projects").select("id", { count: "exact", head: true }).eq("freelancer_id", freelancer.id).eq("status", "submitted");
    return count ?? 0;
  }
  return 0;
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
