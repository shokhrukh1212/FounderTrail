import type { LaunchImageDraft } from "./launch-kit";

/**
 * The FounderTrail launch graphic, drawn on a canvas so the preview a founder edits is
 * exactly the PNG they download.
 *
 * Design: a launch poster in the site's own typeface. A status pill carrying the
 * FounderTrail mark, the startup's real logo on a white tile, a large tightly tracked
 * headline, a muted supporting line, a filled call-to-action and the URL. The screenshot
 * sits in a browser-window frame anchored to the top of the page so the hero shows; with
 * no screenshot, the logo becomes the hero inside soft accent rings. Everything is drawn at
 * 2x, so posts stay sharp on high-density screens.
 */

export const LAUNCH_EXPORT_SCALE = 2;

export type LaunchGraphicImages = {
  logo: HTMLImageElement | null;
  screenshot: HTMLImageElement | null;
  brand: HTMLImageElement | null;
};

export type LaunchGraphicContext = {
  launchState: "upcoming" | "live" | "listed";
  fontFamily: string;
  /** Shown in the browser frame's address bar. */
  hostname: string;
};

type Palette = {
  bg: string; fg: string; muted: string; card: string; border: string; chrome: string;
  address: string; grid: string; pill: string; pillBorder: string; shadow: string;
};

const LIGHT: Palette = {
  bg: "#F8FAFC", fg: "#0F172A", muted: "#556070", card: "#FFFFFF", border: "rgba(15,23,42,0.09)",
  chrome: "#F1F4F8", address: "#FFFFFF", grid: "rgba(15,23,42,0.055)", pill: "#FFFFFF",
  pillBorder: "rgba(15,23,42,0.09)", shadow: "rgba(15,23,42,0.18)",
};
const DARK: Palette = {
  bg: "#0B1020", fg: "#F8FAFC", muted: "#A3AECA", card: "#111A2E", border: "rgba(255,255,255,0.09)",
  chrome: "#18223B", address: "rgba(255,255,255,0.07)", grid: "rgba(255,255,255,0.05)", pill: "rgba(255,255,255,0.06)",
  pillBorder: "rgba(255,255,255,0.12)", shadow: "rgba(0,0,0,0.45)",
};

export function launchDimensions(format: LaunchImageDraft["format"]) {
  return format === "square" ? { width: 1080, height: 1080 } : { width: 1200, height: 630 };
}

export function launchStatusText(state: LaunchGraphicContext["launchState"]): string {
  return state === "live" ? "Launching this week on FounderTrail"
    : state === "upcoming" ? "Launching soon on FounderTrail"
    : "Now on FounderTrail";
}

function rgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const n = Number.parseInt(value.length === 3 ? value.split("").map((c) => c + c).join("") : value, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

type Text = { size: number; lines: string[]; overflow: boolean };

class Typesetter {
  constructor(private ctx: CanvasRenderingContext2D, private family: string) {}

  font(weight: number, size: number, tracking = 0) {
    this.ctx.font = `${weight} ${size}px ${this.family}`;
    // Tight tracking on display sizes is most of what makes type look designed.
    if ("letterSpacing" in this.ctx) (this.ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${tracking}px`;
  }

  width(text: string) { return this.ctx.measureText(text).width; }

  wrap(text: string, width: number): string[] {
    const out: string[] = [];
    for (const paragraph of text.split(/\n/)) {
      let line = "";
      for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (this.width(next) <= width || !line) line = next;
        else { out.push(line); line = word; }
      }
      if (line) out.push(line);
    }
    return out;
  }

  ellipsize(text: string, width: number): string {
    if (this.width(text) <= width) return text;
    let cut = text;
    while (cut.length > 1 && this.width(`${cut.trimEnd()}…`) > width) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}…`;
  }

  clamp(lines: string[], width: number, max: number): string[] {
    const kept = lines.slice(0, max);
    if (lines.length > max && kept.length) kept[kept.length - 1] = this.ellipsize(`${kept[kept.length - 1]}…`, width);
    return kept.map((line) => this.ellipsize(line, width));
  }

  /** The largest size, stepping down, at which the text fits; clipped with "…" if none does. */
  fit(text: string, opts: { width: number; maxLines: number; from: number; to: number; weight: number; tracking?: (size: number) => number; extraLineBelow?: number }): Text {
    for (let size = opts.from; size >= opts.to; size -= 2) {
      const maxLines = opts.extraLineBelow && size <= opts.extraLineBelow ? opts.maxLines + 1 : opts.maxLines;
      this.font(opts.weight, size, opts.tracking?.(size) ?? 0);
      const lines = this.wrap(text, opts.width);
      if (lines.length <= maxLines && lines.every((line) => this.width(line) <= opts.width)) return { size, lines, overflow: false };
    }
    const maxLines = opts.extraLineBelow ? opts.maxLines + 1 : opts.maxLines;
    this.font(opts.weight, opts.to, opts.tracking?.(opts.to) ?? 0);
    return { size: opts.to, lines: this.clamp(this.wrap(text, opts.width), opts.width, maxLines), overflow: true };
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, accent: string, dark: boolean) {
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, w, h);
  // A faint dot grid gives the surface texture without competing with the content.
  ctx.fillStyle = p.grid;
  for (let x = 14; x < w; x += 28) for (let y = 14; y < h; y += 28) ctx.fillRect(x, y, 1.6, 1.6);
  const glow = (x: number, y: number, r: number, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(accent, alpha)); g.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  };
  glow(w * 0.92, h * 0.05, Math.max(w, h) * 0.62, dark ? 0.32 : 0.2);
  glow(w * 0.02, h * 1.02, Math.max(w, h) * 0.45, dark ? 0.16 : 0.08);
}

function drawShadowed(ctx: CanvasRenderingContext2D, p: Palette, blur: number, offsetY: number, draw: () => void) {
  ctx.save(); ctx.shadowColor = p.shadow; ctx.shadowBlur = blur; ctx.shadowOffsetY = offsetY; draw(); ctx.restore();
}

function initials(name: string): string {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  return ((words[0]?.[0] ?? "F") + (words[1]?.[0] ?? "")).toUpperCase();
}

function imageSize(image: HTMLImageElement) {
  // An SVG with only a viewBox can report 0 × 0; treat it as square.
  return { w: image.naturalWidth || 512, h: image.naturalHeight || image.naturalWidth || 512 };
}

function drawLogoTile(ctx: CanvasRenderingContext2D, t: Typesetter, p: Palette, accent: string, logo: HTMLImageElement | null, name: string, x: number, y: number, size: number) {
  const radius = size * 0.24;
  drawShadowed(ctx, p, size * 0.32, size * 0.1, () => {
    roundRect(ctx, x, y, size, size, radius);
    if (logo) ctx.fillStyle = "#FFFFFF";
    else { const g = ctx.createLinearGradient(x, y, x + size, y + size); g.addColorStop(0, accent); g.addColorStop(1, rgba(accent, 0.72)); ctx.fillStyle = g; }
    ctx.fill();
  });
  if (logo) {
    ctx.save(); roundRect(ctx, x, y, size, size, radius); ctx.clip();
    const { w, h } = imageSize(logo);
    const inset = size * 0.1, box = size - inset * 2, scale = Math.min(box / w, box / h);
    ctx.drawImage(logo, x + (size - w * scale) / 2, y + (size - h * scale) / 2, w * scale, h * scale);
    ctx.restore();
  } else {
    t.font(700, size * 0.36, -0.5); ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(initials(name), x + size / 2, y + size / 2 + size * 0.02);
    ctx.textAlign = "left"; ctx.textBaseline = "top";
  }
  ctx.lineWidth = 1; ctx.strokeStyle = p.border; roundRect(ctx, x + 0.5, y + 0.5, size - 1, size - 1, radius); ctx.stroke();
}

function drawStatusPill(ctx: CanvasRenderingContext2D, t: Typesetter, p: Palette, brand: HTMLImageElement | null, text: string, x: number, y: number, scale: number) {
  const h = 36 * scale, icon = 22 * scale, padX = 8 * scale;
  t.font(600, 15 * scale, -0.1);
  const w = padX + icon + 10 * scale + t.width(text) + 14 * scale;
  roundRect(ctx, x, y, w, h, h / 2); ctx.fillStyle = p.pill; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = p.pillBorder; roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2); ctx.stroke();
  if (brand) ctx.drawImage(brand, x + padX, y + (h - icon) / 2, icon, icon);
  ctx.fillStyle = p.fg; ctx.textBaseline = "middle"; ctx.fillText(text, x + padX + icon + 10 * scale, y + h / 2 + scale);
  ctx.textBaseline = "top";
}

/** The call to action as a real button, with the visible URL beside it. Returns its height. */
function drawCta(ctx: CanvasRenderingContext2D, t: Typesetter, p: Palette, accent: string, cta: string, url: string, x: number, y: number, maxWidth: number, scale: number, urlWidth = maxWidth) {
  const h = 52 * scale;
  t.font(650, 19 * scale, -0.2);
  const label = t.ellipsize(`${cta} →`, maxWidth * 0.6);
  const w = t.width(label) + 48 * scale;
  drawShadowed(ctx, { ...p, shadow: rgba(accent, 0.35) }, 18 * scale, 6 * scale, () => { roundRect(ctx, x, y, w, h, h / 2); ctx.fillStyle = accent; ctx.fill(); });
  ctx.fillStyle = "#FFFFFF"; ctx.textBaseline = "middle"; ctx.fillText(label, x + 24 * scale, y + h / 2 + scale);
  if (url) {
    t.font(500, 17 * scale, 0);
    ctx.fillStyle = p.muted;
    const room = urlWidth - w - 20 * scale;
    if (room > 80 * scale) ctx.fillText(t.ellipsize(url, room), x + w + 20 * scale, y + h / 2 + scale);
  }
  ctx.textBaseline = "top";
  return h;
}

function drawBrowser(ctx: CanvasRenderingContext2D, t: Typesetter, p: Palette, screenshot: HTMLImageElement, draft: LaunchImageDraft, hostname: string, x: number, y: number, w: number, h: number, scale: number) {
  const radius = 18 * scale, chrome = 40 * scale;
  drawShadowed(ctx, p, 60 * scale, 24 * scale, () => { roundRect(ctx, x, y, w, h, radius); ctx.fillStyle = p.card; ctx.fill(); });
  ctx.save(); roundRect(ctx, x, y, w, h, radius); ctx.clip();
  ctx.fillStyle = p.chrome; ctx.fillRect(x, y, w, chrome);
  ["#FF5F57", "#FEBC2E", "#28C840"].forEach((color, i) => { ctx.beginPath(); ctx.arc(x + (20 + i * 17) * scale, y + chrome / 2, 5.5 * scale, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); });
  if (hostname) {
    t.font(500, 12.5 * scale, 0);
    const text = t.ellipsize(hostname, w * 0.42), aw = Math.min(w * 0.5, t.width(text) + 40 * scale), ah = 24 * scale;
    const ax = x + (w - aw) / 2, ay = y + (chrome - ah) / 2;
    roundRect(ctx, ax, ay, aw, ah, ah / 2); ctx.fillStyle = p.address; ctx.fill();
    ctx.fillStyle = p.muted; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, ax + aw / 2, ay + ah / 2 + scale * 0.5);
    ctx.textAlign = "left"; ctx.textBaseline = "top";
  }
  const cy = y + chrome, ch = h - chrome;
  ctx.fillStyle = p.card; ctx.fillRect(x, cy, w, ch);
  const { w: iw, h: ih } = imageSize(screenshot);
  const s = draft.fit === "contain" ? Math.min(w / iw, ch / ih) : Math.max(w / iw, ch / ih);
  const dw = iw * s, dh = ih * s;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(screenshot, x + (w - dw) * (draft.focalX / 100), cy + (ch - dh) * (draft.focalY / 100), dw, dh);
  ctx.restore();
  ctx.lineWidth = 1; ctx.strokeStyle = p.border; roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, cy + 0.5); ctx.lineTo(x + w, cy + 0.5); ctx.stroke();
}

/** Without a screenshot, the logo becomes the hero inside soft accent rings. */
function drawLogoHero(ctx: CanvasRenderingContext2D, t: Typesetter, p: Palette, accent: string, logo: HTMLImageElement | null, name: string, cx: number, cy: number, size: number, scale: number) {
  const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 1.25);
  disc.addColorStop(0, rgba(accent, 0.16)); disc.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(cx, cy, size * 1.25, 0, Math.PI * 2); ctx.fill();
  [0.78, 1.12, 1.48].forEach((r, i) => { ctx.beginPath(); ctx.arc(cx, cy, size * r, 0, Math.PI * 2); ctx.strokeStyle = rgba(accent, 0.22 - i * 0.06); ctx.lineWidth = 1.5 * scale; ctx.stroke(); });
  drawLogoTile(ctx, t, p, accent, logo, name, cx - size / 2, cy - size / 2, size);
  // Two FounderTrail actions orbiting the logo make the card read as a launch.
  const chip = (label: string, x: number, y: number) => {
    t.font(600, 15 * scale, -0.1);
    const w = t.width(label) + 30 * scale, h = 36 * scale;
    drawShadowed(ctx, p, 22 * scale, 8 * scale, () => { roundRect(ctx, x, y, w, h, h / 2); ctx.fillStyle = p.card; ctx.fill(); });
    ctx.strokeStyle = p.border; ctx.lineWidth = 1; roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2); ctx.stroke();
    ctx.fillStyle = p.fg; ctx.textBaseline = "middle"; ctx.fillText(label, x + 15 * scale, y + h / 2 + scale); ctx.textBaseline = "top";
  };
  chip("▲  Upvote", cx - size * 1.45, cy - size * 0.95);
  chip("Follow the build", cx + size * 0.35, cy + size * 0.78);
}

type Layout = { issue: string | null };

function report(layout: Layout, text: Text, message: string) {
  if (text.overflow && !layout.issue) layout.issue = message;
}

export async function paintLaunchGraphic(canvas: HTMLCanvasElement, draft: LaunchImageDraft, images: LaunchGraphicImages, context: LaunchGraphicContext): Promise<string | null> {
  const { width: W, height: H } = launchDimensions(draft.format);
  canvas.width = W * LAUNCH_EXPORT_SCALE; canvas.height = H * LAUNCH_EXPORT_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "Your browser could not start the image renderer.";
  ctx.setTransform(LAUNCH_EXPORT_SCALE, 0, 0, LAUNCH_EXPORT_SCALE, 0, 0);
  ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  const dark = draft.theme === "dark";
  const p = dark ? DARK : LIGHT;
  const accent = draft.accent;
  const t = new Typesetter(ctx, context.fontFamily);
  const layout: Layout = { issue: null };
  const square = draft.format === "square";
  const k = square ? 1.2 : 1; // square posts are viewed smaller in feeds, so type runs larger
  const pad = square ? 72 : 64;

  drawBackground(ctx, W, H, p, accent, dark);
  drawStatusPill(ctx, t, p, images.brand, launchStatusText(context.launchState), pad, square ? 68 : 52, k);

  if (draft.template === "spotlight") {
    const colW = square ? W - pad * 2 : 472;
    const logoSize = square ? 96 : 76;
    const logoY = square ? 138 : 116;
    drawLogoTile(ctx, t, p, accent, images.logo, draft.name, pad, logoY, logoSize);
    const name = t.fit(draft.name, { width: colW - logoSize - 22, maxLines: 1, from: square ? 40 : 30, to: 20, weight: 650, tracking: (s) => -s * 0.02 });
    report(layout, name, "The startup name is too long for this layout. Shorten it before downloading.");
    ctx.fillStyle = p.fg; ctx.fillText(name.lines[0] ?? "", pad + logoSize + 22, logoY + (logoSize - name.size) / 2);

    const headTop = logoY + logoSize + (square ? 46 : 36);
    const head = t.fit(draft.headline, { width: colW, maxLines: 3, from: square ? 66 : 50, to: square ? 44 : 32, weight: 700, tracking: (s) => -s * 0.035, extraLineBelow: square ? 50 : 38 });
    report(layout, head, "The headline is too long for this layout. Shorten it before downloading.");
    const headLine = head.size * 1.1;
    ctx.fillStyle = p.fg; head.lines.forEach((line, i) => ctx.fillText(line, pad, headTop + i * headLine));
    const headBottom = headTop + head.lines.length * headLine;

    const ctaH = 52 * k;
    // In the square format the CTA follows the copy and the browser frame fills the bottom;
    // in landscape the CTA anchors to the bottom edge of the text column.
    const supportSize = square ? 26 : 21, supportLine = supportSize * 1.45;
    const ctaYLandscape = H - pad - ctaH;
    t.font(400, supportSize, -0.1);
    const supportRoom = square ? 2 : Math.max(0, Math.floor((ctaYLandscape - 26 - (headBottom + 16)) / supportLine));
    const supportAll = t.wrap(draft.support, colW);
    const supportLines = t.clamp(supportAll, colW, Math.min(2, supportRoom));
    if (supportAll.length > Math.min(2, supportRoom) && !layout.issue) layout.issue = "The supporting line is too long for this layout. Shorten it before downloading.";
    ctx.fillStyle = p.muted; supportLines.forEach((line, i) => ctx.fillText(line, pad, headBottom + 16 + i * supportLine));
    const supportBottom = headBottom + 16 + supportLines.length * supportLine;

    const ctaY = square ? supportBottom + 30 : ctaYLandscape;
    // In landscape the CTA row sits below the browser frame, so the URL can use the full width.
    drawCta(ctx, t, p, accent, draft.cta, draft.url, pad, ctaY, colW, k, W - pad * 2);

    if (square) {
      const top = Math.max(ctaY + ctaH + 52, 600);
      if (images.screenshot) drawBrowser(ctx, t, p, images.screenshot, draft, context.hostname, pad, top, W - pad * 2, H - top + 60, 1.15);
      else drawLogoHero(ctx, t, p, accent, images.logo, draft.name, W / 2, top + (H - top) / 2 - 8, 124, 1.1);
    } else {
      const bw = 570, bh = 40 + Math.round(bw * 10 / 16);
      if (images.screenshot) drawBrowser(ctx, t, p, images.screenshot, draft, context.hostname, W - 44 - bw, (H - bh) / 2 + 8, bw, bh, 1);
      else drawLogoHero(ctx, t, p, accent, images.logo, draft.name, W - 44 - bw / 2, H / 2 + 12, 132, 1);
    }
  } else {
    // Minimal announcement: typography first, no screenshot. Everything is measured before
    // it is drawn, so the square format can centre the block in its larger canvas.
    const width = W - pad * 2;
    const logoSize = square ? 72 : 60, blockTop = square ? 150 : 118;
    const name = t.fit(draft.name, { width: width - logoSize - 20, maxLines: 1, from: square ? 34 : 26, to: 18, weight: 650, tracking: (s) => -s * 0.02 });
    report(layout, name, "The startup name is too long for this layout. Shorten it before downloading.");
    const headGap = square ? 56 : 40;
    const head = t.fit(draft.headline, { width: square ? width : width * 0.86, maxLines: square ? 4 : 3, from: square ? 84 : 66, to: square ? 50 : 38, weight: 700, tracking: (s) => -s * 0.04 });
    report(layout, head, "The headline is too long for this layout. Shorten it before downloading.");
    const headLine = head.size * 1.06;
    const ctaH = 52 * k, ctaY = H - pad - ctaH;
    const supportSize = square ? 28 : 22, supportLine = supportSize * 1.45;
    const headBottomAtTop = blockTop + logoSize + headGap + head.lines.length * headLine;
    t.font(400, supportSize, -0.1);
    const room = Math.max(0, Math.floor((ctaY - 28 - (headBottomAtTop + 20)) / supportLine));
    const supportAll = t.wrap(draft.support, width * 0.8);
    const supportLines = t.clamp(supportAll, width * 0.8, Math.min(3, room));
    if (supportAll.length > Math.min(3, room) && !layout.issue) layout.issue = "The supporting line is too long for this layout. Shorten it before downloading.";
    const blockH = logoSize + headGap + head.lines.length * headLine + (supportLines.length ? 20 + supportLines.length * supportLine : 0);
    const offset = square ? Math.max(0, Math.round((ctaY - 40 - blockTop - blockH) / 2)) : 0;

    const rowY = blockTop + offset;
    drawLogoTile(ctx, t, p, accent, images.logo, draft.name, pad, rowY, logoSize);
    t.font(650, name.size, -name.size * 0.02);
    ctx.fillStyle = p.fg; ctx.fillText(name.lines[0] ?? "", pad + logoSize + 20, rowY + (logoSize - name.size) / 2);
    const headTop = rowY + logoSize + headGap;
    t.font(700, head.size, -head.size * 0.04);
    ctx.fillStyle = p.fg; head.lines.forEach((line, i) => ctx.fillText(line, pad, headTop + i * headLine));
    const headBottom = headTop + head.lines.length * headLine;
    t.font(400, supportSize, -0.1);
    ctx.fillStyle = p.muted; supportLines.forEach((line, i) => ctx.fillText(line, pad, headBottom + 20 + i * supportLine));
    drawCta(ctx, t, p, accent, draft.cta, draft.url, pad, ctaY, width, k);
  }
  return layout.issue;
}

let resolvedFamily: Promise<string> | null = null;

/**
 * The site loads Geist through next/font, which registers it under a generated family
 * name, so "Geist" on its own never matches. Use the family the page actually renders
 * with, and wait until its weights are ready before drawing.
 */
export function launchFontFamily(): Promise<string> {
  if (!resolvedFamily) {
    resolvedFamily = (async () => {
      const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
      try { await Promise.all([400, 500, 600, 650, 700].map((weight) => document.fonts.load(`${weight} 40px ${family}`))); } catch { /* fall back silently */ }
      return family;
    })();
  }
  return resolvedFamily;
}
