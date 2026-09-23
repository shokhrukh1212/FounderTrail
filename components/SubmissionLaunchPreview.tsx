"use client";

import { useEffect, useRef, useState } from "react";
import { defaultLaunchKitDraft, type LaunchFacts } from "@/lib/launch-kit";
import { paintLaunchGraphic, launchFontFamily } from "@/lib/launch-graphic";

function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => resolve(null), 4000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); resolve(null); };
    image.src = url;
  });
}

export default function SubmissionLaunchPreview({ name, tagline, websiteUrl, logoUrl }: { name: string; tagline: string; websiteUrl: string; logoUrl: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const facts: LaunchFacts = { name, tagline, websiteUrl, founderTrailUrl: websiteUrl, launchState: "preview", useCase: null, audience: null };
  const draft = defaultLaunchKitDraft(facts);
  draft.image.cta = "Explore startup";
  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const [logo, brand] = await Promise.all([loadImage(logoUrl), loadImage("/logo.png")]);
        if (cancelled || !canvas.current) return;
        const current = defaultLaunchKitDraft({ name, tagline, websiteUrl, founderTrailUrl: websiteUrl, launchState: "preview", useCase: null, audience: null });
        current.image.cta = "Explore startup";
        await paintLaunchGraphic(canvas.current, current.image, { logo, brand, screenshot: null }, { launchState: "preview", fontFamily: await launchFontFamily(), hostname: "" });
      } catch { if (!cancelled) setFailed(true); }
    }
    void render();
    return () => { cancelled = true; };
  }, [name, tagline, websiteUrl, logoUrl, retry]);
  return <div className="submission-pro-preview">
    <p className="eyebrow">Preview</p>
    {failed ? <p role="status">Preview couldn’t load. <button type="button" className="text-button" onClick={() => { setFailed(false); setRetry(retry + 1); }}>Try again</button></p> : <canvas ref={canvas} aria-label={`Preview launch graphic for ${name}: ${tagline}`} role="img" />}
    <strong>Post draft</strong><p className="submission-post-preview">{draft.social.short}</p>
    <small>Sample only. Pro unlocks editing and downloads. Nothing is posted automatically.</small>
  </div>;
}
