"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  LAUNCH_ACCENTS, generatedSocial, type LaunchFacts, type LaunchImageDraft,
  type LaunchKitDraft,
} from "@/lib/launch-kit";
import { launchFontFamily, paintLaunchGraphic } from "@/lib/launch-graphic";

export type LaunchImageSource = { source: string; url: string; label: string; kind: "logo" | "screenshot" };

type Props = {
  slug: string;
  facts: LaunchFacts;
  initialDraft: LaunchKitDraft;
  initialVersion: number;
  sources: LaunchImageSource[];
  canEdit: boolean;
  previewOnly?: boolean;
  /** Shown in place of the download controls while the startup is not Pro. */
  upgradeHref?: string | null;
};

type MissingImage = "logo" | "screenshot";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.decoding = "async"; image.crossOrigin = "anonymous";
    image.onload = () => resolve(image); image.onerror = () => reject(new Error("IMAGE_LOAD_FAILED")); image.src = url;
  });
}

/** One unavailable image leaves that image out; it never blanks the whole graphic. */
async function loadOptionalImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return null;
  try { return await loadImage(url); } catch { return null; }
}

const BRAND_MARK_URL = "/brand/logo-256.png";

function hostnameOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

export function LaunchStudio({ slug, facts, initialDraft, initialVersion, sources: initialSources, canEdit, previewOnly = false, upgradeHref = null }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [draft, setDraft] = useState(initialDraft);
  const versionRef = useRef(initialVersion);
  const initialized = useRef(false);
  const [sources, setSources] = useState(initialSources);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [notice, setNotice] = useState("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [missingImages, setMissingImages] = useState<MissingImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const renderSeq = useRef(0);
  // Each stored image is fetched once per session, however many edits re-render the card.
  const imageRequests = useRef(new Map<string, Promise<HTMLImageElement | null>>());
  const settledImages = useRef(new Map<string, HTMLImageElement | null>());
  const [downloading, setDownloading] = useState(false);
  const sourceMap = useMemo(() => new Map(sources.map((item) => [item.source, item.url])), [sources]);

  const imageFor = useCallback((url: string): Promise<HTMLImageElement | null> => {
    if (!url) return Promise.resolve(null);
    let request = imageRequests.current.get(url);
    if (!request) {
      request = loadOptionalImage(url).then((image) => { settledImages.current.set(url, image); return image; });
      imageRequests.current.set(url, request);
    }
    return request;
  }, []);

  const render = useCallback(async () => {
    const target = canvas.current;
    if (!target) return null;
    const seq = ++renderSeq.current;
    const logoUrl = sourceMap.get(draft.image.logoSource) ?? "";
    const screenshotUrl = sourceMap.get(draft.image.screenshotSource) ?? "";
    const context = { launchState: facts.launchState, fontFamily: await launchFontFamily(), hostname: hostnameOf(facts.websiteUrl) };
    const pending = Promise.all([imageFor(logoUrl), imageFor(screenshotUrl), imageFor(BRAND_MARK_URL)]);
    const ready = [logoUrl, screenshotUrl, BRAND_MARK_URL].every((url) => !url || settledImages.current.has(url));
    // Paint the words straight away so the card is never blank while images arrive.
    if (!ready) {
      setLoadingImages(true);
      const early = await paintLaunchGraphic(target, draft.image, { logo: null, screenshot: null, brand: settledImages.current.get(BRAND_MARK_URL) ?? null }, context);
      if (seq === renderSeq.current) setRenderError(early);
    }
    const [logo, screenshot, brand] = await pending;
    if (seq !== renderSeq.current) return null; // a newer edit owns the canvas now
    const issue = await paintLaunchGraphic(target, draft.image, { logo, screenshot, brand }, context);
    if (seq !== renderSeq.current) return issue;
    setLoadingImages(false);
    setRenderError(issue);
    setMissingImages([...(logoUrl && !logo ? ["logo" as const] : []), ...(screenshotUrl && !screenshot ? ["screenshot" as const] : [])]);
    return issue;
  }, [draft.image, sourceMap, imageFor, facts.launchState, facts.websiteUrl]);

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

  if (previewOnly) return <div className="launch-preview-only"><canvas ref={canvas} aria-label="Example FounderTrail launch graphic" /><p>Sample startup. With Pro, you edit every word, switch layouts, formats and colours, and download a sharp 2× PNG.</p></div>;

  const missingLabel = missingImages.length === 2 ? "logo and screenshot" : missingImages[0];

  // The preview and its controls share one grid, so the sticky preview is bounded by that
  // grid and scrolls away before the social drafts instead of sliding over them.
  return <div className={`launch-studio${canEdit ? "" : " is-preview"}`}>
    <div className="launch-workspace">
    <section className="launch-preview-panel">
      <div className="launch-preview-frame"><canvas ref={canvas} aria-label="Live launch image preview" /></div>
      {/* Layout warnings only help someone who can edit the words. */}
      {renderError && canEdit ? <p className="form-error" role="alert">{renderError}</p> : null}
      {loadingImages ? <p className="form-hint" role="status">Loading your logo and screenshot…</p> : null}
      {!renderError && !loadingImages && missingLabel ? <p className="launch-image-warning" role="status">The {missingLabel} could not be loaded, so the preview leaves it out. Choose another image under Images to include one.</p> : null}
      {canEdit
        ? <p className="form-hint">Edits save automatically. Downloads are 2× PNGs, so posts stay sharp.</p>
        : <p className="form-hint">This is your real launch graphic. Upgrade to Pro to edit it, save it and download it as a PNG.</p>}
      <div className="launch-actions">
        {!canEdit && upgradeHref ? <a className="button button-primary" href={upgradeHref}>Upgrade to Pro</a> : null}
        <button className={`button ${canEdit ? "button-primary" : "button-secondary"}`} type="button" onClick={() => void downloadPng()} disabled={!canEdit || downloading || loadingImages || Boolean(renderError)} title={canEdit ? undefined : "Available with Pro"}>{downloading ? "Downloading…" : "Download PNG"}</button>
        <button className="button button-secondary" type="button" onClick={resetAll} disabled={!canEdit} title={canEdit ? undefined : "Available with Pro"}>Reset</button>
        <span className={`save-state is-${saveState}`} role="status">{!canEdit ? "Preview only" : saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save error — edits remain here" : "Ready"}</span>
      </div>
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
        <div className="launch-uploads"><form className="compact-upload" onSubmit={(event) => void upload(event, "logo")}><label>Private logo<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required /></label><button className="button button-secondary">Upload</button></form><form className="compact-upload" onSubmit={(event) => void upload(event, "screenshot")}><label>Private screenshot<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required /></label><button className="button button-secondary">Upload</button></form></div>
        <div className="form-grid"><label>Screenshot fit<select value={draft.image.fit} onChange={(event) => imageField("fit", event.target.value as "contain" | "cover")}><option value="cover">Crop to fill</option><option value="contain">Fit whole image</option></select></label><label>Horizontal focus<input type="range" min="0" max="100" value={draft.image.focalX} onChange={(event) => imageField("focalX", Number(event.target.value))} /></label></div><label>Vertical focus<input type="range" min="0" max="100" value={draft.image.focalY} onChange={(event) => imageField("focalY", Number(event.target.value))} /></label>
      </fieldset>
    </aside>
    </div>

    <section id="social-posts" className="social-editor">
      <header><div><p className="eyebrow">Social drafts</p><h2>Ready to adapt, never auto-posted</h2></div><button className="button button-secondary" type="button" disabled={!canEdit} onClick={() => { if (window.confirm("Replace both social drafts with fresh text from the startup's current facts?")) setDraft((current) => ({ ...current, social: { ...current.social, ...generatedSocial(facts) } })); }}>Regenerate</button></header>
      <div className="social-grid"><article><label>Short post <small>{draft.social.short.length}/280</small><textarea rows={8} maxLength={280} disabled={!canEdit} value={draft.social.short} onChange={(event) => setDraft((current) => ({ ...current, social: { ...current.social, short: event.target.value } }))} /></label><div className="button-row"><button className="button button-secondary" onClick={() => void copy(draft.social.short)} type="button">Copy text</button><button className="text-button" onClick={() => textDownload(draft.social.short, "short-post")} type="button">Download .txt</button></div></article><article><label>LinkedIn post <small>{draft.social.linkedin.length}/3000</small><textarea rows={8} maxLength={3000} disabled={!canEdit} value={draft.social.linkedin} onChange={(event) => setDraft((current) => ({ ...current, social: { ...current.social, linkedin: event.target.value } }))} /></label><div className="button-row"><button className="button button-secondary" onClick={() => void copy(draft.social.linkedin)} type="button">Copy text</button><button className="text-button" onClick={() => textDownload(draft.social.linkedin, "linkedin-post")} type="button">Download .txt</button></div></article></div>
      <div className="form-grid"><label>Destination URL<input type="url" disabled={!canEdit} value={draft.social.destination} onChange={(event) => setDraft((current) => ({ ...current, social: { ...current.social, destination: event.target.value } }))} /></label><label>Suggested image alt text <small>{draft.social.altText.length}/300</small><textarea rows={3} maxLength={300} disabled={!canEdit} value={draft.social.altText} onChange={(event) => setDraft((current) => ({ ...current, social: { ...current.social, altText: event.target.value } }))} /></label></div>
    </section>
  </div>;
}
