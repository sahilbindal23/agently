import Link from "next/link";
import { MessageRecipientButton } from "@/components/messages/message-recipient-button";
import { SocialTrustBadge } from "@/components/social/social-trust-badge";
import { VerificationBadge } from "@/components/verification/verification-badge";
import { getBangaloreFit, getIndiaAudiencePercent } from "@/lib/utils/creator-metrics";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

const GRADIENTS = [
  "from-violet-600 to-indigo-700",
  "from-emerald-500 to-teal-700",
  "from-rose-500 to-pink-700",
  "from-orange-500 to-amber-600",
  "from-sky-500 to-blue-700",
  "from-fuchsia-500 to-purple-700",
];

function gradientFor(name: string) {
  return GRADIENTS[(name.charCodeAt(0) || 0) % GRADIENTS.length];
}

function HeroImage({ src, label }: { src: string; label: string }) {
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={label}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          src={src}
        />
      ) : (
        <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(label)}`}>
          <span className="select-none text-8xl font-black text-white/60">
            {label.slice(0, 1).toUpperCase() || "A"}
          </span>
        </div>
      )}
      {/* Bottom scrim so overlaid text is always readable */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-2.5">
      <span className="text-sm font-bold tabular-nums text-foreground">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

export function CreatorMarketCard({ creator, platform }: { creator: Record<string, unknown>; platform?: Record<string, unknown> }) {
  const href = `/creators/${stringValue(creator.id)}`;
  const name = stringValue(creator.display_name);
  const niche = stringValue(creator.primary_niche) || "Creator";
  const bangaloreFit = getBangaloreFit(creator as never);
  const metricSource = stringValue(platform?.metric_source);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/8 dark:bg-card/90">
      {/* Hero image — clicking navigates to profile */}
      <Link href={href} className="relative block shrink-0">
        <HeroImage src={stringValue(creator.image_url)} label={name} />
        {/* Verification badge — top right */}
        <div className="absolute right-3 top-3">
          <VerificationBadge status={creator.verification_status} tier={creator.verification_tier} />
        </div>
        <div className="absolute left-3 top-3 max-w-[calc(100%-7rem)]">
          <SocialTrustBadge source={metricSource} compact />
        </div>
        {/* Name + niche — overlaid on image */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="truncate text-base font-bold leading-tight text-white drop-shadow">{name}</p>
          <p className="mt-0.5 text-xs font-medium text-white/70">{niche}</p>
        </div>
        {/* Bangalore fit pill — bottom right */}
        {bangaloreFit >= 45 && (
          <div className="absolute bottom-3 right-4">
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
              📍 {bangaloreFit}
            </span>
          </div>
        )}
      </Link>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-border/60 border-y border-border/60 dark:divide-white/8 dark:border-white/8">
        <StatPill label="Followers" value={formatNumber(numberValue(platform?.followers))} />
        <StatPill label="Avg views" value={formatNumber(numberValue(platform?.avg_views))} />
        <StatPill label="India" value={`${getIndiaAudiencePercent(creator as never)}%`} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 p-3">
        <MessageRecipientButton entityId={stringValue(creator.id)} entityType="creator" />
        <Link
          href={href}
          className="ml-auto text-xs font-semibold text-primary transition hover:opacity-70"
        >
          View profile →
        </Link>
      </div>
    </div>
  );
}

export function FreelancerMarketCard({ freelancer }: { freelancer: Record<string, unknown> }) {
  const href = `/freelancers/${stringValue(freelancer.id)}`;
  const name = stringValue(freelancer.display_name);
  const service = stringValue(freelancer.service_category) || "Creative services";
  const rate = numberValue(freelancer.hourly_rate_cents) || numberValue(freelancer.day_rate_cents);
  const availability = stringValue(freelancer.availability_status) || "available";

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/8 dark:bg-card/90">
      <Link href={href} className="relative block shrink-0">
        <HeroImage src={stringValue(freelancer.image_url)} label={name} />
        <div className="absolute right-3 top-3">
          <VerificationBadge status={freelancer.verification_status} tier={freelancer.verification_tier} />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="truncate text-base font-bold leading-tight text-white drop-shadow">{name}</p>
          <p className="mt-0.5 text-xs font-medium text-white/70">{service}</p>
        </div>
        <div className="absolute bottom-3 right-4">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm ${availability === "available" ? "bg-emerald-500/80 text-white" : "bg-white/15 text-white"}`}>
            {availability}
          </span>
        </div>
      </Link>

      <div className="grid grid-cols-3 divide-x divide-border/60 border-y border-border/60 dark:divide-white/8 dark:border-white/8">
        <StatPill label="Hourly" value={rate ? formatCurrency(rate, "inr") : "–"} />
        <StatPill label="Portfolio" value={`${numberValue(freelancer.portfolio_score)}/100`} />
        <StatPill label="City" value={stringValue(freelancer.home_city) || "Flexible"} />
      </div>

      <div className="flex items-center gap-2 p-3">
        <MessageRecipientButton entityId={stringValue(freelancer.id)} entityType="freelancer" />
        <Link href={href} className="ml-auto text-xs font-semibold text-primary transition hover:opacity-70">
          View profile →
        </Link>
      </div>
    </div>
  );
}

export function BrandMarketCard({ brand }: { brand: Record<string, unknown> }) {
  const href = `/brands/${stringValue(brand.id)}`;
  const name = stringValue(brand.name);
  const industry = stringValue(brand.industry) || "Brand";
  const status = stringValue(brand.status) || "active";

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/8 dark:bg-card/90">
      <Link href={href} className="relative block shrink-0">
        <HeroImage src={stringValue(brand.image_url)} label={name} />
        <div className="absolute right-3 top-3">
          <VerificationBadge status={brand.verification_status} tier={brand.verification_tier} />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="truncate text-base font-bold leading-tight text-white drop-shadow">{name}</p>
          <p className="mt-0.5 text-xs font-medium text-white/70">{industry}</p>
        </div>
        <div className="absolute bottom-3 right-4">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm ${status === "active" ? "bg-emerald-500/80 text-white" : "bg-white/15 text-white"}`}>
            {status}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col justify-between p-4">
        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
          {stringValue(brand.website) || "No website listed yet"}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <MessageRecipientButton entityId={stringValue(brand.id)} entityType="brand" />
          <Link href={href} className="ml-auto text-xs font-semibold text-primary transition hover:opacity-70">
            View profile →
          </Link>
        </div>
      </div>
    </div>
  );
}

function stringValue(value: unknown) {
  return value ? String(value) : "";
}

function numberValue(value: unknown) {
  return Number(value ?? 0);
}
