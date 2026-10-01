export type LaunchChoice = "now" | "scheduled" | "none";
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Reject nonexistent local times instead of silently moving them across a DST gap. */
export function localLaunchInstant(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  const [year, month, day, hour, minute] = value.split(/[-T:]/).map(Number);
  return Number.isFinite(date.getTime()) && date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day && date.getHours() === hour && date.getMinutes() === minute ? date : null;
}
export function launchWeek(start: Date) {
  const monday = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() - ((start.getUTCDay() + 6) % 7)));
  return { startsAt: monday, endsAt: new Date(monday.getTime() + WEEK_MS) };
}
export function parseLaunchChoice(choice: unknown, instant: unknown, now = new Date()): { choice: LaunchChoice; startsAt: Date | null } {
  if (choice === "none") return { choice, startsAt: null };
  if (choice === "now" || choice === null || choice === undefined || choice === "") return { choice: "now", startsAt: now };
  if (choice !== "scheduled") throw new Error("Choose a launch option.");
  const start = typeof instant === "string" && /Z$|[+-]\d{2}:\d{2}$/.test(instant) ? new Date(instant) : new Date(NaN);
  if (!Number.isFinite(start.getTime()) || start <= now || start.getTime() > now.getTime() + 180 * 86400000) throw new Error("Choose a future date and time within six months.");
  return { choice, startsAt: start };
}
export function activationPost(name: string, url: string, state: "live" | "scheduled" | "listed" | "past", date?: string) {
  const heading = state === "live" || state === "past" ? `I just launched ${name} on FounderTrail.` : state === "scheduled" ? `${name} is on FounderTrail. We're launching on ${date}.` : `${name} now has a home on FounderTrail.`;
  const closing = state === "live" || state === "past" ? "I'd love your feedback. Take a look and follow the page for updates:" : state === "scheduled" ? "Take a look and follow our progress:" : "Take a look, share your feedback, and follow what we build next:";
  const full = `${heading}\n\n${closing}\n${url}`;
  return postLength(full) <= 280 ? full : `${name} is on FounderTrail.${state === "scheduled" ? ` Launching ${date}.` : ""}\n\nTake a look and share your feedback:\n${url}`;
}
/** Conservative X weighting: URLs use t.co length; non-Latin characters count twice. */
export function postLength(text: string) {
  return Array.from(text.replace(/https?:\/\/\S+/g, "x".repeat(23))).reduce((total, char) => total + (char.codePointAt(0)! > 0x10ff ? 2 : 1), 0);
}
export function productIdentity(raw: string) {
  const url = new URL(raw);
  return `${url.host.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}${url.search}`;
}
