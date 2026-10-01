import { activationPost, postLength } from "./launch-policy";
export const LAUNCH_ACCENTS = ["#FF6154", "#2563EB", "#7C3AED", "#047857", "#D97706"] as const;

export type LaunchImageDraft = {
  template: "spotlight" | "minimal";
  format: "landscape" | "square";
  theme: "light" | "dark";
  accent: typeof LAUNCH_ACCENTS[number];
  name: string;
  headline: string;
  support: string;
  cta: string;
  url: string;
  logoSource: string;
  screenshotSource: string;
  fit: "contain" | "cover";
  focalX: number;
  focalY: number;
};

export type LaunchSocialDraft = {
  short: string;
  linkedin: string;
  destination: string;
  altText: string;
};

export type LaunchKitDraft = { image: LaunchImageDraft; social: LaunchSocialDraft };
export type LaunchFacts = {
  name: string;
  tagline: string;
  useCase: string | null;
  audience: string | null;
  websiteUrl: string;
  founderTrailUrl: string;
  launchDate?: string | null;
  launchState: "upcoming" | "live" | "listed" | "preview";
};

function limit(value: unknown, max: number, fallback: string): string {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback.slice(0, max);
}

function validDestination(value: unknown, fallback: string): string {
  const text = limit(value, 2048, fallback);
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : fallback;
  } catch { return fallback; }
}

function source(value: unknown, fallback = ""): string {
  const text = typeof value === "string" ? value : fallback;
  return /^(?:media|asset):[0-9a-f-]{36}$/i.test(text) || text === LISTING_LOGO_SOURCE || text === "" ? text : fallback;
}

/** The logo read from the startup's own website, for listings without an uploaded logo. */
export const LISTING_LOGO_SOURCE = "listing:logo";

/** The URL as printed on the graphic: no protocol, no trailing slash. */
/** A URL as printed on the graphic: no scheme, query (share-card version, UTM) or hash. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
}

export function generatedSocial(facts: LaunchFacts): Pick<LaunchSocialDraft, "short" | "linkedin" | "altText"> {
  const state = facts.launchState === "upcoming"
    ? `${facts.name} is launching${facts.launchDate ? ` on ${facts.launchDate}` : " soon"}.`
    : facts.launchState === "live" ? `${facts.name} has launched.` : `Meet ${facts.name}.`;
  const purpose = facts.useCase || facts.tagline;
  const audience = facts.audience ? ` Built for ${facts.audience}.` : "";
  const rich = `${state} ${purpose}${audience} Take a look and share your feedback: ${facts.founderTrailUrl}`;
  return {
    short: postLength(rich) <= 280 ? rich : activationPost(facts.name, facts.founderTrailUrl, facts.launchState === "upcoming" ? "scheduled" : facts.launchState === "live" ? "live" : "listed", facts.launchDate ?? "soon"),
    linkedin: `${state}\n\n${purpose}${audience}\n\nWe'd value thoughtful feedback from the FounderTrail community.\n\n${facts.founderTrailUrl}`.slice(0, 3000),
    altText: `${facts.name} launch announcement graphic: ${facts.tagline}`.slice(0, 300),
  };
}

export function defaultLaunchKitDraft(facts: LaunchFacts, logoSource = "", screenshotSource = ""): LaunchKitDraft {
  const social = generatedSocial(facts);
  return {
    image: {
      template: "spotlight", format: "landscape", theme: "light", accent: LAUNCH_ACCENTS[0],
      name: facts.name.slice(0, 60), headline: facts.tagline.slice(0, 100),
      support: (facts.launchState === "upcoming" && facts.launchDate ? `Launching ${facts.launchDate}` : facts.useCase || facts.audience || "Discover what we're building.").slice(0, 180),
      cta: "See the launch", url: displayUrl(facts.founderTrailUrl).slice(0, 120), logoSource, screenshotSource,
      // Website screenshots lead with their hero, so new drafts anchor to the top.
      fit: "cover", focalX: 50, focalY: 0,
    },
    social: { ...social, destination: facts.founderTrailUrl },
  };
}

export function normalizeLaunchKitDraft(value: unknown, facts: LaunchFacts, fallback?: LaunchKitDraft): LaunchKitDraft {
  const base = fallback ?? defaultLaunchKitDraft(facts);
  const root = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const image = root.image && typeof root.image === "object" ? root.image as Record<string, unknown> : {};
  const social = root.social && typeof root.social === "object" ? root.social as Record<string, unknown> : {};
  const numeric = (candidate: unknown, old: number) => typeof candidate === "number" && Number.isFinite(candidate) ? Math.max(0, Math.min(100, candidate)) : old;
  return {
    image: {
      template: image.template === "minimal" ? "minimal" : "spotlight",
      format: image.format === "square" ? "square" : "landscape",
      theme: image.theme === "dark" ? "dark" : "light",
      accent: LAUNCH_ACCENTS.includes(image.accent as typeof LAUNCH_ACCENTS[number]) ? image.accent as typeof LAUNCH_ACCENTS[number] : base.image.accent,
      name: limit(image.name, 60, base.image.name), headline: limit(image.headline, 100, base.image.headline),
      support: limit(image.support, 180, base.image.support), cta: limit(image.cta, 40, base.image.cta),
      url: limit(image.url, 120, base.image.url), logoSource: source(image.logoSource, base.image.logoSource),
      screenshotSource: source(image.screenshotSource, base.image.screenshotSource), fit: image.fit === "contain" ? "contain" : "cover",
      focalX: numeric(image.focalX, base.image.focalX), focalY: numeric(image.focalY, base.image.focalY),
    },
    social: {
      short: limit(social.short, 280, base.social.short), linkedin: limit(social.linkedin, 3000, base.social.linkedin),
      destination: validDestination(social.destination, base.social.destination), altText: limit(social.altText, 300, base.social.altText),
    },
  };
}
