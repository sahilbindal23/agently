"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronLeft, MousePointer2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Role = "admin" | "creator" | "brand" | "freelancer";

type Step = {
  title: string;
  body: string;
  target: string;
  route: string;
  cta?: string;
};

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const storageKey = "agently-walkthrough-state";

const sharedFinalStep = {
  title: "Payments close the loop",
  body: "Payments are the protected workflow layer. A brand funds the deal before final delivery, the creator or freelancer submits the work, approval moves it into release-ready, and payout is then released. RazorpayX powers automated payouts once accounts are verified.",
  target: "nav-payments",
  route: "/payments",
  cta: "Open payments"
};

const stepsByRole: Record<Role, Step[]> = {
  brand: [
    {
      title: "Start from your brand workspace",
      body: "This home screen gives brands their profile readiness, marketplace talent, campaign audit context, and submitted offers in one place.",
      target: "nav-home",
      route: "/brand-home",
      cta: "Go home"
    },
    {
      title: "Tune the brand profile first",
      body: "The profile tells Agently what kind of creators, freelancers, audience, and campaign context the brand is looking for.",
      target: "nav-profile",
      route: "/profile",
      cta: "Edit profile"
    },
    {
      title: "Campaign briefs power matching",
      body: "Brands create a brief before choosing talent. That lets the fit engine rank creators and freelancers against goals, budget, city, language, and production needs.",
      target: "nav-campaigns",
      route: "/campaigns",
      cta: "Open campaigns"
    },
    {
      title: "Offers become managed work",
      body: "Creator offers and freelancer projects are where campaign recommendations turn into real workflow: terms, amount, dates, acceptance, and delivery.",
      target: "nav-offers",
      route: "/deals",
      cta: "View offers"
    },
    {
      title: "Insights make brands come back",
      body: "Campaign insights summarize accepted talent, deliverables in review, payment readiness, projected reach, engagement, and CPM signals.",
      target: "nav-insights",
      route: "/brand-insights",
      cta: "Open insights"
    },
    sharedFinalStep
  ],
  creator: [
    {
      title: "This is the creator command center",
      body: "Creators see readiness, profile signals, marketplace network, active offers, and the profile data brands use to evaluate them.",
      target: "nav-home",
      route: "/creator-home",
      cta: "Go home"
    },
    {
      title: "Profile edits are trust-aware",
      body: "Creators can update positioning, socials, niche, and content style. Agently-calculated scores stay protected so brands can trust them.",
      target: "nav-profile",
      route: "/profile",
      cta: "Edit profile"
    },
    {
      title: "Offers are the talent inbox",
      body: "This is where creators accept, decline, request changes, and submit deliverable links after work is approved.",
      target: "nav-offers",
      route: "/offers",
      cta: "Open offers"
    },
    {
      title: "AI helps the talent side",
      body: "Valuation, brand matching, contract intelligence, and negotiation support are built for creators and freelancers. Brands do not get the talent-side negotiation copilot.",
      target: "nav-ai",
      route: "/ai-insights",
      cta: "Open AI tools"
    },
    sharedFinalStep
  ],
  freelancer: [
    {
      title: "Freelancers have a production workspace",
      body: "Freelancers are for creating assets, editing, shooting, designing, or producing campaign work without needing to post on their own socials.",
      target: "nav-home",
      route: "/freelancer-home",
      cta: "Go home"
    },
    {
      title: "Service profiles sell capability",
      body: "Freelancers can edit skills, hourly rate, service packages, portfolio links, regions, and availability so brands know exactly what they can hire.",
      target: "nav-profile",
      route: "/profile",
      cta: "Edit profile"
    },
    {
      title: "Project offers live here",
      body: "Brands can send production projects. Freelancers can accept, request changes, decline, and submit work links for review.",
      target: "nav-offers",
      route: "/offers",
      cta: "Open offers"
    },
    {
      title: "Negotiation support protects scope",
      body: "The AI copilot helps talent push back on vague scope, revision creep, unpaid usage, and risky payment timing.",
      target: "nav-ai",
      route: "/ai-insights",
      cta: "Open AI tools"
    },
    sharedFinalStep
  ],
  admin: [
    {
      title: "Admin sees the operating system",
      body: "The dashboard gives a top-level view of pipeline value, represented creators, contract risks, funded payments, and release queue.",
      target: "nav-dashboard",
      route: "/dashboard",
      cta: "Open dashboard"
    },
    {
      title: "Creator CRM is the supply layer",
      body: "Creator profiles, platform metrics, valuations, active deals, and sponsor readiness feed the matching and pricing engines.",
      target: "nav-creators",
      route: "/creators",
      cta: "Open creators"
    },
    {
      title: "Campaigns drive realistic matching",
      body: "The recommendation engine ranks creators and freelancers against campaign goals, city focus, audience, languages, budget, and production needs.",
      target: "nav-campaigns",
      route: "/campaigns",
      cta: "Open campaigns"
    },
    {
      title: "Contracts protect the talent relationship",
      body: "Contract intelligence scans usage, payment timing, exclusivity, revisions, cancellation, and licensing duration.",
      target: "nav-contracts",
      route: "/contracts",
      cta: "Open contracts"
    },
    sharedFinalStep
  ]
};

export function GuidedWalkthrough({ role }: { role: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const steps = useMemo(() => stepsByRole[role] ?? stepsByRole.admin, [role]);
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [missingTarget, setMissingTarget] = useState(false);
  const [positionReady, setPositionReady] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);

  const current = steps[index];

  const persist = useCallback((nextActive: boolean, nextIndex: number) => {
    if (nextActive) {
      window.sessionStorage.setItem(storageKey, JSON.stringify({ active: true, index: nextIndex, role }));
      return;
    }
    window.sessionStorage.removeItem(storageKey);
  }, [role]);

  const goToIndex = useCallback((nextIndex: number) => {
    const bounded = Math.max(0, Math.min(steps.length - 1, nextIndex));
    // Intentionally NOT clearing `rect` or `positionReady` here. Keeping
    // the previous step's highlight visible during navigation means the
    // user sees a smooth slide to the new target once the new page
    // paints, instead of a fade-out + fade-in flicker. measure() in the
    // useLayoutEffect updates the rect in place when the new page mounts.
    setMissingTarget(false);
    setIndex(bounded);
    setActive(true);
    persist(true, bounded);
  }, [persist, steps.length]);

  const endTour = useCallback(() => {
    setActive(false);
    setPendingStart(false);
    setRect(null);
    setMissingTarget(false);
    persist(false, 0);
  }, [persist]);

  const measure = useCallback(() => {
    if (!active || !current) return;
    const element = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
    if (!element) {
      setMissingTarget(true);
      setRect(null);
      setPositionReady(true);
      return;
    }

    const updateRect = () => {
      const box = element.getBoundingClientRect();
      setMissingTarget(false);
      setRect({
        top: Math.max(10, box.top - 8),
        left: Math.max(10, box.left - 8),
        width: box.width + 16,
        height: box.height + 16
      });
      setPositionReady(true);
    };

    element.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
    updateRect();
    window.requestAnimationFrame(updateRect);
  }, [active, current]);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(storageKey);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as { active?: boolean; index?: number; role?: Role };
      if (parsed.active && parsed.role === role) {
        setIndex(Math.max(0, Math.min(steps.length - 1, Number(parsed.index ?? 0))));
        setActive(true);
      }
    } catch {
      window.sessionStorage.removeItem(storageKey);
    }
  }, [role, steps.length]);

  useEffect(() => {
    if (searchParams.get("walkthrough") !== "1") return;
    window.sessionStorage.setItem(storageKey, JSON.stringify({ active: true, index: 0, role }));
    goToIndex(0);
  }, [goToIndex, role, searchParams]);

  useEffect(() => {
    function start() {
      if (steps[0]?.route && steps[0].route !== window.location.pathname) {
        setIndex(0);
        setActive(false);
        setPendingStart(true);
        setPositionReady(false);
        setMissingTarget(false);
        setRect(null);
        persist(true, 0);
        router.push(steps[0].route);
        return;
      }
      goToIndex(0);
    }

    window.addEventListener("agently:start-walkthrough", start);
    return () => window.removeEventListener("agently:start-walkthrough", start);
  }, [goToIndex, persist, router, steps]);

  useEffect(() => {
    if (!active || !current) return;
    if (current.route !== pathname) {
      // Don't clear rect / positionReady — keep the previous highlight
      // visible while the new page loads. router.push() will trigger a
      // re-render and measure() picks up the new target.
      router.push(current.route);
    }
  }, [active, current, pathname, router]);

  // Prefetch every step's route as soon as the walkthrough activates so
  // that subsequent navigations come out of the Next.js router cache
  // instead of doing a full server roundtrip. This is the single biggest
  // win for perceived "instant Next" — without prefetch each Next click
  // can wait 500ms-2s for the new server component to render.
  useEffect(() => {
    if (!active) return;
    for (const step of steps) {
      router.prefetch(step.route);
    }
  }, [active, steps, router]);

  useLayoutEffect(() => {
    if (pendingStart && current?.route === pathname) {
      setPendingStart(false);
      setActive(true);
    }
  }, [current, pathname, pendingStart]);

  useLayoutEffect(() => {
    if (!active || !current || current.route !== pathname) return;

    measure();
    const timeout = window.setTimeout(measure, 40);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, current, measure, pathname]);

  if (!active || !current || current.route !== pathname) return null;

  const cardPosition = rect || missingTarget ? getCardPosition(rect) : undefined;
  const progress = `${index + 1} / ${steps.length}`;

  function next() {
    if (index >= steps.length - 1) {
      endTour();
      return;
    }
    goToIndex(index + 1);
  }

  function back() {
    goToIndex(index - 1);
  }

  return (
    <div className="fixed inset-0 z-50">
      {rect ? (
        <div
          // duration-200 lets the highlight smoothly SLIDE to the next
          // target when Next is clicked, instead of vanishing-then-
          // reappearing. The "next page" loads behind this overlay so
          // user perceives a continuous experience.
          className="pointer-events-none absolute rounded-xl border-2 border-accent bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.62),0_18px_50px_rgba(20,184,166,0.28)] transition-[top,left,width,height] duration-200 ease-out"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        >
          <div className="absolute -right-3 -top-3 flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-accent text-accent-foreground shadow-soft">
            <MousePointer2 className="h-4 w-4" />
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 bg-slate-950/55" />
      )}

      <div
        // Card stays at opacity-100 once the tour starts; we just move
        // it. Previously the card faded out on every Next click which
        // amplified the "page reload" perception.
        className={`absolute w-[min(420px,calc(100vw-32px))] rounded-lg border bg-white p-5 shadow-[0_24px_90px_rgba(15,23,42,0.28)] transition-[top,left] duration-200 ease-out ${cardPosition ? "opacity-100" : "pointer-events-none opacity-0"}`}
        style={cardPosition}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Agently walkthrough</p>
            <h2 className="mt-2 text-xl font-bold tracking-normal">{current.title}</h2>
          </div>
          <button className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" onClick={endTour} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{current.body}</p>
        {missingTarget ? (
          <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-800">
            This step is moving to the right area. If the highlight does not appear, click the button below.
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{progress}</p>
          <div className="flex gap-2">
            <Button disabled={index === 0} onClick={back} size="sm" type="button" variant="secondary">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button onClick={next} size="sm" type="button">
              {index >= steps.length - 1 ? "Finish" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getCardPosition(rect: Rect | null): React.CSSProperties {
  if (!rect) {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)"
    };
  }

  const viewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const cardWidth = Math.min(420, viewportWidth - 32);
  const topCandidate = rect.top + rect.height + 18;
  const top = topCandidate + 260 > viewportHeight ? Math.max(16, rect.top - 278) : topCandidate;
  const left = Math.min(Math.max(16, rect.left), viewportWidth - cardWidth - 16);

  return { top, left };
}
