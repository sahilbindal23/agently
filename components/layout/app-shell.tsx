import Link from "next/link";
import { Activity, BarChart3, Bot, BriefcaseBusiness, ClipboardList, CreditCard, FileText, HelpCircle, Home, LayoutDashboard, MessageSquare, MessageSquareText, Palette, Users } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { HomeLogo } from "@/components/layout/home-logo";
import { GuidedWalkthrough } from "@/components/onboarding/guided-walkthrough";
import { WalkthroughLaunchButton } from "@/components/onboarding/walkthrough-launch-button";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/session";

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
                {item.label}
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
      <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      <GuidedWalkthrough role={user?.role ?? "admin"} />
    </div>
  );
}
