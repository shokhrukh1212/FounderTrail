/**
 * Public text handling shared by lists, the product page and product-page sharing.
 *
 * Two separate jobs live here:
 *  - decoding text that was stored with HTML entities in it (`&#x27;` from a scraped
 *    page title) so a visitor reads an apostrophe, not markup. The result is always
 *    rendered as text by React; nothing here produces HTML.
 *  - choosing which name to show: the founder's or an admin's short brand name when one
 *    exists, otherwise the original stored name, untouched.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’",
  ldquo: "“", rdquo: "”", middot: "·", bull: "•", trade: "™",
  reg: "®", copy: "©", deg: "°", euro: "€", pound: "£", yen: "¥", cent: "¢",
};

function codePoint(value: number): string {
  // Lone surrogates, out-of-range values and the C0 controls are dropped rather than
  // turned into replacement characters that would then be stored on a re-save.
  if (!Number.isFinite(value) || value < 0x20 || value > 0x10ffff) return "";
  if (value >= 0xd800 && value <= 0xdfff) return "";
  return String.fromCodePoint(value);
}

/**
 * Decode HTML entities in stored text. Legitimate Unicode, apostrophes, ampersands and
 * brand punctuation survive untouched; `&` that is not part of an entity is left alone.
 */
export function decodeEntities(value: string): string {
  if (!value.includes("&")) return value;
  return value.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) return codePoint(Number.parseInt(entity.slice(2), 16)) || match;
    if (entity.startsWith("#")) return codePoint(Number.parseInt(entity.slice(1), 10)) || match;
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Collapse whitespace and decode entities for any string shown to the public. */
export function publicText(value: string | null | undefined): string {
  return decodeEntities((value ?? "").replace(/\s+/g, " ").trim());
}

/**
 * The brand name to print. `shortName` is only ever set by a founder or an admin, so an
 * unreviewed legacy name is shown exactly as submitted instead of being guessed at.
 */
export function displayProductName(name: string, shortName?: string | null): string {
  const short = publicText(shortName);
  return short || publicText(name) || name;
}

const NAME_SEPARATORS = /\s+(?:[—–|·]|-{1,2}|:)\s+/;

/**
 * A *suggestion* for an admin reviewing a legacy name that looks like "Brand — tagline".
 * It is never applied automatically: real brand names contain hyphens, dots and spaces,
 * so only a person can say whether the tail is marketing copy or part of the name.
 */
export function suggestedShortName(name: string): string | null {
  const decoded = publicText(name);
  const [head] = decoded.split(NAME_SEPARATORS);
  const candidate = head?.trim() ?? "";
  if (!candidate || candidate === decoded) return null;
  if (candidate.length < 2 || candidate.length > 60) return null;
  return candidate;
}

/** Whether a stored name still looks like it carries its tagline and needs review. */
export function nameNeedsReview(name: string, shortName?: string | null): boolean {
  if (publicText(shortName)) return false;
  const decoded = publicText(name);
  return decoded.length > 28 || NAME_SEPARATORS.test(decoded);
}
