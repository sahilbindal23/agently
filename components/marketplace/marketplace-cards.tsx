import Link from "next/link";
import { MessageRecipientButton } from "@/components/messages/message-recipient-button";
import { Badge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/verification/verification-badge";
import { getBangaloreFit, getIndiaAudiencePercent } from "@/lib/utils/creator-metrics";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

type CreatorCardProps = {
  creator: Record<string, unknown>;
  platform?: Record<string, unknown>;
};

type FreelancerCardProps = {
  freelancer: Record<string, unknown>;
};

type BrandCardProps = {
  brand: Record<string, unknown>;
};

export function CreatorMarketCard({ creator, platform }: CreatorCardProps) {
  const href = `/creators/${stringValue(creator.id)}`;
  return (
    <div className="rounded-md border bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[116px_1fr]">
        <Link href={href} aria-label={`Open ${stringValue(creator.display_name)} profile`}>
          <ProfileImage src={stringValue(creator.image_url)} label={stringValue(creator.display_name)} />
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link className="font-semibold transition hover:text-primary" href={href}>
              {stringValue(creator.display_name)}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">{stringValue(creator.primary_niche)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <VerificationBadge status={creator.verification_status} tier={creator.verification_tier} />
            <Badge tone="blue">{getBangaloreFit(creator as never)}/100</Badge>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Mini label="Platform" value={stringValue(platform?.platform) || "Linked soon"} />
        <Mini label="Followers" value={formatNumber(numberValue(platform?.followers))} />
        <Mini label="Avg views" value={formatNumber(numberValue(platform?.avg_views))} />
        <Mini label="India audience" value={`${getIndiaAudiencePercent(creator as never)}%`} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <MessageRecipientButton entityId={stringValue(creator.id)} entityType="creator" />
        <Link className="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm font-medium transition hover:bg-muted" href={href}>View profile</Link>
      </div>
    </div>
  );
}

export function FreelancerMarketCard({ freelancer }: FreelancerCardProps) {
  const href = `/freelancers/${stringValue(freelancer.id)}`;
  return (
    <div className="rounded-md border bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[116px_1fr]">
        <Link href={href} aria-label={`Open ${stringValue(freelancer.display_name)} profile`}>
          <ProfileImage src={stringValue(freelancer.image_url)} label={stringValue(freelancer.display_name)} />
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link className="font-semibold transition hover:text-primary" href={href}>
              {stringValue(freelancer.display_name)}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">{stringValue(freelancer.service_category) || "Creative services"}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <VerificationBadge status={freelancer.verification_status} tier={freelancer.verification_tier} />
            <Badge tone="green">{stringValue(freelancer.availability_status) || "available"}</Badge>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Mini label="City" value={stringValue(freelancer.home_city) || "Flexible"} />
        <Mini label="Hourly" value={formatCurrency(numberValue(freelancer.hourly_rate_cents) || numberValue(freelancer.day_rate_cents), "inr")} />
        <Mini label="Portfolio" value={`${numberValue(freelancer.portfolio_score)}/100`} />
        <Mini label="Skills" value={arrayValue(freelancer.skills).slice(0, 2).join(", ") || "Not listed"} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <MessageRecipientButton entityId={stringValue(freelancer.id)} entityType="freelancer" />
        <Link className="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm font-medium transition hover:bg-muted" href={href}>View profile</Link>
      </div>
    </div>
  );
}

export function BrandMarketCard({ brand }: BrandCardProps) {
  const href = `/brands/${stringValue(brand.id)}`;
  return (
    <div className="rounded-md border bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[116px_1fr]">
        <Link href={href} aria-label={`Open ${stringValue(brand.name)} profile`}>
          <ProfileImage src={stringValue(brand.image_url)} label={stringValue(brand.name)} />
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link className="font-semibold transition hover:text-primary" href={href}>{stringValue(brand.name)}</Link>
            <p className="mt-1 text-xs text-muted-foreground">{stringValue(brand.industry) || "Campaign partner"}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <VerificationBadge status={brand.verification_status} tier={brand.verification_tier} />
            <Badge tone={stringValue(brand.status) === "active" ? "green" : "blue"}>{stringValue(brand.status) || "target"}</Badge>
          </div>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{stringValue(brand.website) || "Website not listed yet"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <MessageRecipientButton entityId={stringValue(brand.id)} entityType="brand" />
        <Link className="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm font-medium transition hover:bg-muted" href={href}>View profile</Link>
      </div>
    </div>
  );
}

function ProfileImage({ src, label }: { src: string; label: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={label} className="aspect-[4/5] w-full rounded-md object-cover" src={src} />
  ) : (
    <div className="flex aspect-[4/5] w-full items-center justify-center rounded-md bg-muted text-2xl font-bold text-muted-foreground">
      {label.slice(0, 1) || "A"}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-semibold">{value}</p>
    </div>
  );
}

function stringValue(value: unknown) {
  return value ? String(value) : "";
}

function numberValue(value: unknown) {
  return Number(value ?? 0);
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}
