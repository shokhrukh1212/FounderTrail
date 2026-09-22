"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  LAUNCH_ACCENTS, generatedSocial, type LaunchFacts, type LaunchImageDraft,
  type LaunchKitDraft,
} from "@/lib/launch-kit";

export type LaunchImageSource = { source: string; url: string; label: string; kind: "logo" | "screenshot" };

type Props = {
  slug: string;
  facts: LaunchFacts;
  initialDraft: LaunchKitDraft;
  initialVersion: number;
  sources: LaunchImageSource[];
  canEdit: boolean;
  previewOnly?: boolean;
};

function dimensions(format: LaunchImageDraft["format"]) {
  return format === "square" ? { width: 1080, height: 1080 } : { width: 1200, height: 630 };
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.closePath();
}

function lines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const output: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= width || !line) line = next;
      else { output.push(line); line = word; }
    }
    if (line) output.push(line);
  }
  return output;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number, preferred: number, minimum: number, weight = 800) {
  for (let size = preferred; size >= minimum; size -= 2) {
    ctx.font = `${weight} ${size}px Geist, Arial, sans-serif`;
    const wrapped = lines(ctx, text, width);
    if (wrapped.length <= maxLines && wrapped.every((line) => ctx.measureText(line).width <= width)) return { size, lines: wrapped };
  }
  ctx.font = `${weight} ${minimum}px Geist, Arial, sans-serif`;
  return { size: minimum, lines: lines(ctx, text, width), overflow: true };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.decoding = "async"; image.crossOrigin = "anonymous";
    image.onload = () => resolve(image); image.onerror = () => reject(new Error("IMAGE_LOAD_FAILED")); image.src = url;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, fit: "cover" | "contain", focalX: number, focalY: number) {
  const scale = fit === "contain" ? Math.min(width / image.naturalWidth, height / image.naturalHeight) : Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawnWidth = image.naturalWidth * scale, drawnHeight = image.naturalHeight * scale;
  const dx = x + (width - drawnWidth) * (focalX / 100), dy = y + (height - drawnHeight) * (focalY / 100);
  ctx.drawImage(image, dx, dy, drawnWidth, drawnHeight);
}

async function paint(canvas: HTMLCanvasElement, draft: LaunchImageDraft, sourceMap: Map<string, string>): Promise<string | null> {
  const { width, height } = dimensions(draft.format);
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "Your browser could not start the image renderer.";
  await document.fonts?.ready;
  const dark = draft.theme === "dark";
  const background = dark ? "#111827" : "#F8FAFC";
  const foreground = dark ? "#F9FAFB" : "#172033";
  const muted = dark ? "#CBD5E1" : "#5B6577";
  ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = draft.accent; ctx.fillRect(0, 0, draft.format === "square" ? 18 : 14, height);

  const sourceUrl = (source: string) => sourceMap.get(source) ?? "";
  let logo: HTMLImageElement | null = null, screenshot: HTMLImageElement | null = null;
  try {
    [logo, screenshot] = await Promise.all([
      sourceUrl(draft.logoSource) ? loadImage(sourceUrl(draft.logoSource)) : Promise.resolve(null),
      sourceUrl(draft.screenshotSource) ? loadImage(sourceUrl(draft.screenshotSource)) : Promise.resolve(null),
    ]);
  } catch { return "An image could not be loaded. Choose another stored asset and retry."; }

  const square = draft.format === "square";
  const pad = square ? 76 : 64;
  const logoSize = square ? 106 : 82;
  if (draft.template === "spotlight") {
    const copyWidth = square ? width - pad * 2 : 500;
    if (screenshot) {
      const box = square
        ? { x: pad, y: 600, width: width - pad * 2, height: 370 }
        : { x: 650, y: 54, width: 486, height: 522 };
      ctx.save(); rounded(ctx, box.x, box.y, box.width, box.height, 28); ctx.clip();
      ctx.fillStyle = dark ? "#1F2937" : "#E5E7EB"; ctx.fillRect(box.x, box.y, box.width, box.height);
      drawCover(ctx, screenshot, box.x, box.y, box.width, box.height, draft.fit, draft.focalX, draft.focalY); ctx.restore();
      ctx.strokeStyle = dark ? "#374151" : "#D1D5DB"; ctx.lineWidth = 2; rounded(ctx, box.x, box.y, box.width, box.height, 28); ctx.stroke();
    }
    if (logo) { ctx.save(); rounded(ctx, pad, pad, logoSize, logoSize, 22); ctx.clip(); ctx.drawImage(logo, pad, pad, logoSize, logoSize); ctx.restore(); }
    else { ctx.fillStyle = draft.accent; rounded(ctx, pad, pad, logoSize, logoSize, 22); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = `800 ${Math.round(logoSize * .42)}px Geist,Arial,sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText((draft.name[0] || "F").toUpperCase(), pad + logoSize / 2, pad + logoSize / 2); }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = foreground;
    const name = fitText(ctx, draft.name, copyWidth, 1, square ? 38 : 30, 18, 750);
    if (name.overflow) return "The startup name is too long for this layout. Shorten it before downloading.";
    ctx.fillText(name.lines[0] ?? "", pad, pad + logoSize + (square ? 55 : 45));
    const heading = fitText(ctx, draft.headline, copyWidth, square ? 3 : 3, square ? 68 : 56, 32);
    if (heading.overflow) return "The headline is too long for this layout. Shorten it before downloading.";
    ctx.fillStyle = foreground; heading.lines.forEach((line, index) => ctx.fillText(line, pad, pad + logoSize + (square ? 135 : 112) + index * heading.size * 1.08));
    const headingBottom = pad + logoSize + (square ? 135 : 112) + heading.lines.length * heading.size * 1.08;
    ctx.font = `500 ${square ? 28 : 22}px Geist,Arial,sans-serif`; ctx.fillStyle = muted;
    const supporting = lines(ctx, draft.support, copyWidth);
    if (supporting.length > 3) return "The supporting line is too long for this layout. Shorten it before downloading.";
    supporting.forEach((line, index) => ctx.fillText(line, pad, headingBottom + 30 + index * (square ? 38 : 30)));
  } else {
    ctx.globalAlpha = .16; ctx.fillStyle = draft.accent; ctx.beginPath(); ctx.arc(square ? 870 : 1010, square ? 210 : 80, square ? 330 : 300, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    if (logo) { ctx.save(); rounded(ctx, pad, pad, logoSize, logoSize, 22); ctx.clip(); ctx.drawImage(logo, pad, pad, logoSize, logoSize); ctx.restore(); }
    ctx.fillStyle = draft.accent;
    const name = fitText(ctx, draft.name.toUpperCase(), width - pad * 2, 1, square ? 28 : 24, 18, 750);
    if (name.overflow) return "The startup name is too long for this layout. Shorten it before downloading.";
    ctx.fillText(name.lines[0] ?? "", pad, square ? 300 : 205);
    const heading = fitText(ctx, draft.headline, width - pad * 2, square ? 4 : 3, square ? 84 : 70, 38);
    if (heading.overflow) return "The headline is too long for this layout. Shorten it before downloading.";
    ctx.fillStyle = foreground; heading.lines.forEach((line, index) => ctx.fillText(line, pad, (square ? 405 : 300) + index * heading.size * 1.08));
    const bottom = (square ? 405 : 300) + heading.lines.length * heading.size * 1.08;
    ctx.fillStyle = muted; ctx.font = `500 ${square ? 30 : 24}px Geist,Arial,sans-serif`;
    const supporting = lines(ctx, draft.support, width - pad * 2);
    if (supporting.length > 3) return "The supporting line is too long for this layout. Shorten it before downloading.";
    supporting.forEach((line, index) => ctx.fillText(line, pad, bottom + 42 + index * (square ? 42 : 33)));
  }

  const footerY = height - (square ? 88 : 55);
  const footerWidth = (width - pad * 2) * .46;
  ctx.textAlign = "left"; ctx.fillStyle = draft.accent;
  const cta = fitText(ctx, draft.cta, footerWidth, 1, square ? 27 : 21, 14, 750);
  if (cta.overflow) return "The CTA is too long for this layout. Shorten it before downloading.";
  ctx.fillText(cta.lines[0] ?? "", pad, footerY);
  ctx.textAlign = "right"; ctx.fillStyle = muted;
  const visibleUrl = fitText(ctx, draft.url || "FounderTrail", footerWidth, 1, square ? 23 : 18, 13, 500);
  if (visibleUrl.overflow) return "The visible URL is too long for this layout. Shorten it before downloading.";
  ctx.fillText(visibleUrl.lines[0] ?? "", width - pad, footerY);
  return null;
}

export function LaunchStudio({ slug, facts, initialDraft, initialVersion, sources: initialSources, canEdit, previewOnly = false }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [draft, setDraft] = useState(initialDraft);
  const versionRef = useRef(initialVersion);
  const initialized = useRef(false);
  const [sources, setSources] = useState(initialSources);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [notice, setNotice] = useState("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const sourceMap = useMemo(() => new Map(sources.map((item) => [item.source, item.url])), [sources]);

  const render = useCallback(async () => {
    if (!canvas.current) return null;
    const issue = await paint(canvas.current, draft.image, sourceMap);
    setRenderError(issue); return issue;
  }, [draft.image, sourceMap]);

  useEffect(() => { void render(); }, [render]);

  useEffect(() => {
    if (!canEdit) return;
    if (!initialized.current) { initialized.current = true; return; }
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/owner/products/${encodeURIComponent(slug)}/launch-kit/draft`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: versionRef.current, draft }) });
        const result = await response.json() as { error?: string; version?: number };
        if (!response.ok || typeof result.version !== "number") throw new Error(result.error || "Save failed.");
        versionRef.current = result.version; setSaveState("saved");
      } catch { setSaveState("error"); }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [canEdit, draft, slug]);

  function imageField<K extends keyof LaunchImageDraft>(key: K, value: LaunchImageDraft[K]) {
    setDraft((current) => ({ ...current, image: { ...current.image, [key]: value } })); setNotice("");
  }

  async function downloadPng() {
    if (!canEdit || !canvas.current) return;
    setDownloading(true); setNotice("");
    const issue = await render();
    if (issue) { setDownloading(false); return; }
    const blob = await new Promise<Blob | null>((resolve) => canvas.current!.toBlob(resolve, "image/png"));
    if (!blob) { setRenderError("The browser could not create the PNG. Retry or use another browser."); setDownloading(false); return; }
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `${slug}-launch-${draft.image.format}.png`; link.click(); URL.revokeObjectURL(url);
    setNotice("PNG downloaded."); setDownloading(false);
    void fetch(`/api/owner/products/${encodeURIComponent(slug)}/launch-kit/exports`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ template: draft.image.template, format: draft.image.format, outcome: "succeeded" }) });
  }

  async function upload(event: FormEvent<HTMLFormElement>, kind: "logo" | "screenshot") {
    event.preventDefault(); if (!canEdit) return;
    const form = event.currentTarget; const data = new FormData(form); data.set("kind", kind);
    setNotice("Uploading image…");
    const response = await fetch(`/api/owner/products/${encodeURIComponent(slug)}/launch-kit/assets`, { method: "POST", body: data });
    const result = await response.json() as { error?: string; asset?: LaunchImageSource };
    if (!response.ok || !result.asset) { setNotice(result.error || "Upload failed."); return; }
    setSources((current) => [...current, result.asset!]); imageField(kind === "logo" ? "logoSource" : "screenshotSource", result.asset.source); form.reset(); setNotice("Private launch-kit image uploaded.");
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice("Copied to clipboard."); }
    catch { setNotice("Copy failed. Select the text and copy it manually."); }
  }

  function textDownload(text: string, suffix: string) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${slug}-${suffix}.txt`; link.click(); URL.revokeObjectURL(url); setNotice("Text file downloaded.");
  }

  function resetAll() {
    if (!canEdit || !window.confirm("Reset the launch kit to its original startup details? Your current edits will be replaced.")) return;
    setDraft(initialDraft); setNotice("Launch kit reset.");
  }

  if (previewOnly) return <div className="launch-preview-only"><canvas ref={canvas} aria-label="Example FounderTrail launch graphic" /><p>Edit and save your design in FounderTrail Pro; download it as a PNG.</p></div>;

  return <div className={`launch-studio${canEdit ? "" : " is-preview"}`}>
    <section className="launch-preview-panel">
      <div className="launch-preview-frame"><canvas ref={canvas} aria-label="Live launch image preview" /></div>
      {renderError ? <p className="form-error" role="alert">{renderError}</p> : null}
      <p className="form-hint">Edit and save your design here; download it as a PNG.</p>
      <div className="launch-actions"><button className="button button-primary" type="button" onClick={() => void downloadPng()} disabled={!canEdit || downloading || Boolean(renderError)}>{downloading ? "Downloading…" : "Download PNG"}</button><button className="button button-secondary" type="button" onClick={resetAll} disabled={!canEdit}>Reset</button><span className={`save-state is-${saveState}`} role="status">{!canEdit ? "Preview only" : saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save error — edits remain here" : "Ready"}</span></div>
      {notice ? <p className="manager-notice" role="status">{notice}</p> : null}
    </section>

    <aside className="launch-controls">
      <fieldset disabled={!canEdit}><legend>Design</legend>
        <div className="form-grid"><label>Template<select value={draft.image.template} onChange={(event) => imageField("template", event.target.value as LaunchImageDraft["template"])}><option value="spotlight">Product spotlight</option><option value="minimal">Minimal announcement</option></select></label><label>Format<select value={draft.image.format} onChange={(event) => imageField("format", event.target.value as LaunchImageDraft["format"])}><option value="landscape">Landscape · 1200 × 630</option><option value="square">Square · 1080 × 1080</option></select></label></div>
        <div className="form-grid"><label>Theme<select value={draft.image.theme} onChange={(event) => imageField("theme", event.target.value as LaunchImageDraft["theme"])}><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Accent<span className="accent-options">{LAUNCH_ACCENTS.map((color) => <button key={color} type="button" aria-label={`Use accent ${color}`} aria-pressed={draft.image.accent === color} style={{ backgroundColor: color }} onClick={() => imageField("accent", color)} />)}</span></label></div>
      </fieldset>
      <fieldset disabled={!canEdit}><legend>Words</legend>
        <label>Startup name <small>{draft.image.name.length}/60</small><input value={draft.image.name} maxLength={60} onChange={(event) => imageField("name", event.target.value)} /></label>
        <label>Headline <small>{draft.image.headline.length}/100</small><textarea value={draft.image.headline} maxLength={100} rows={2} onChange={(event) => imageField("headline", event.target.value)} /></label>
        <label>Supporting line <small>{draft.image.support.length}/180</small><textarea value={draft.image.support} maxLength={180} rows={3} onChange={(event) => imageField("support", event.target.value)} /></label>
        <div className="form-grid"><label>CTA <small>{draft.image.cta.length}/40</small><input value={draft.image.cta} maxLength={40} onChange={(event) => imageField("cta", event.target.value)} /></label><label>Visible URL <small>{draft.image.url.length}/120</small><input value={draft.image.url} maxLength={120} onChange={(event) => imageField("url", event.target.value)} /></label></div>
      </fieldset>
      <fieldset disabled={!canEdit}><legend>Images</legend>
        <label>Logo<select value={draft.image.logoSource} onChange={(event) => imageField("logoSource", event.target.value)}><option value="">Generated initial</option>{sources.filter((item) => item.kind === "logo").map((item) => <option key={item.source} value={item.source}>{item.label}</option>)}</select></label>
        <label>Screenshot<select value={draft.image.screenshotSource} onChange={(event) => imageField("screenshotSource", event.target.value)}><option value="">No screenshot</option>{sources.filter((item) => item.kind === "screenshot").map((item) => <option key={item.source} value={item.source}>{item.label}</option>)}</select></label>
        <div className="form-grid"><form className="compact-upload" onSubmit={(event) => void upload(event, "logo")}><label>Private logo<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required /></label><button className="button button-secondary">Upload</button></form><form className="compact-upload" onSubmit={(event) => void upload(event, "screenshot")}><label>Private screenshot<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required /></label><button className="button button-secondary">Upload</button></form></div>
        <div className="form-grid"><label>Screenshot fit<select value={draft.image.fit} onChange={(event) => imageField("fit", event.target.value as "contain" | "cover")}><option value="cover">Crop to fill</option><option value="contain">Fit whole image</option></select></label><label>Horizontal focus<input type="range" min="0" max="100" value={draft.image.focalX} onChange={(event) => imageField("focalX", Number(event.target.value))} /></label></div><label>Vertical focus<input type="range" min="0" max="100" value={draft.image.focalY} onChange={(event) => imageField("focalY", Number(event.target.value))} /></label>
      </fieldset>
    </aside>

    <section className="social-editor">
      <header><div><p className="eyebrow">Social drafts</p><h2>Ready to adapt, never auto-posted</h2></div><button className="button button-secondary" type="button" disabled={!canEdit} onClick={() => { if (window.confirm("Replace both social drafts with fresh text from the startup's current facts?")) setDraft((current) => ({ ...current, social: { ...current.social, ...generatedSocial(facts) } })); }}>Regenerate</button></header>
      <div className="social-grid"><article><label>Short post <small>{draft.social.short.length}/280</small><textarea rows={8} maxLength={280} disabled={!canEdit} value={draft.social.short} onChange={(event) => setDraft((current) => ({ ...current, social: { ...current.social, short: event.target.value } }))} /></label><div className="button-row"><button className="button button-secondary" onClick={() => void copy(draft.social.short)} type="button">Copy text</button><button className="text-button" onClick={() => textDownload(draft.social.short, "short-post")} type="button">Download .txt</button></div></article><article><label>LinkedIn post <small>{draft.social.linkedin.length}/3000</small><textarea rows={8} maxLength={3000} disabled={!canEdit} value={draft.social.linkedin} onChange={(event) => setDraft((current) => ({ ...current, social: { ...current.social, linkedin: event.target.value } }))} /></label><div className="button-row"><button className="button button-secondary" onClick={() => void copy(draft.social.linkedin)} type="button">Copy text</button><button className="text-button" onClick={() => textDownload(draft.social.linkedin, "linkedin-post")} type="button">Download .txt</button></div></article></div>
      <div className="form-grid"><label>Destination URL<input type="url" disabled={!canEdit} value={draft.social.destination} onChange={(event) => setDraft((current) => ({ ...current, social: { ...current.social, destination: event.target.value } }))} /></label><label>Suggested image alt text <small>{draft.social.altText.length}/300</small><textarea rows={3} maxLength={300} disabled={!canEdit} value={draft.social.altText} onChange={(event) => setDraft((current) => ({ ...current, social: { ...current.social, altText: event.target.value } }))} /></label></div>
    </section>
  </div>;
}
