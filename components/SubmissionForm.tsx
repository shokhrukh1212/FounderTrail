"use client";
/* eslint-disable @next/next/no-img-element -- local object URLs and untrusted metadata previews cannot use next/image */

import Link from "next/link";
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  isSubmissionField,
  logoFileError,
  screenshotFilesError,
  validateSubmissionForm,
  validateSubmissionStep,
  websiteFieldError,
  type SubmissionField,
  type SubmissionFieldErrors,
  type SubmissionStep,
} from "@/lib/submission-form-validation";
import { ProductLogo } from "./ProductLogo";

type Metadata = {
  productName: string;
  tagline: string;
  logoUrl: string | null;
  screenshotUrl: string | null;
  status: "success" | "partial" | "failed";
};

type Duplicate = { kind: "published" | "own_draft" | "under_review"; slug: string | null; name: string | null; message: string };

const STEP_LABELS: Record<SubmissionStep, string> = { 1: "Website", 2: "Startup details", 3: "Founder and review" };

function FieldError({ field, errors }: { field: SubmissionField; errors: SubmissionFieldErrors }) {
  const message = errors[field];
  return message ? <span id={`submission-${field}-error`} className="field-error" role="alert">{message}</span> : null;
}

function fieldDescription(field: SubmissionField, errors: SubmissionFieldErrors, helperId?: string) {
  return [errors[field] ? `submission-${field}-error` : null, helperId].filter(Boolean).join(" ") || undefined;
}

export function SubmissionForm({ categories, accountName = "", accountEmail = "" }: { categories: Array<{ id: string; name: string }>; accountName?: string; accountEmail?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const screenshotsInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<SubmissionStep>(1);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [screenshotAlts, setScreenshotAlts] = useState<string[]>([]);
  const [suggestedLogo, setSuggestedLogo] = useState<string | null>(null);
  const [suggestedScreenshot, setSuggestedScreenshot] = useState<string | null>(null);
  const [metadataToken, setMetadataToken] = useState("");
  const [fetched, setFetched] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SubmissionFieldErrors>({});
  const [fetchMessage, setFetchMessage] = useState("");
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  const [created, setCreated] = useState<{ slug: string; status: "draft" | "pending"; managementUrl: string; claimPath?: string; claimValue?: string } | null>(null);
  const [existingProduct, setExistingProduct] = useState<{ slug: string; name: string } | null>(null);
  // A field the founder has typed in is never replaced by a later fetch.
  const edited = useRef<Set<"name" | "tagline">>(new Set());

  const logoPreview = useMemo(() => (logo ? URL.createObjectURL(logo) : suggestedLogo), [logo, suggestedLogo]);
  const screenshotPreviews = useMemo(() => screenshots.map((file) => ({ file, url: URL.createObjectURL(file) })), [screenshots]);

  function clearFieldError(field: SubmissionField) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function clearFieldErrors(fields: SubmissionField[]) {
    setFieldErrors((current) => {
      const next = { ...current };
      for (const field of fields) delete next[field];
      return next;
    });
  }

  function focusField(field: SubmissionField) {
    requestAnimationFrame(() => {
      const control = formRef.current?.elements.namedItem(field);
      const target = control instanceof RadioNodeList ? control.item(0) : control;
      if (!(target instanceof HTMLElement)) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  /**
   * Inactive steps stay mounted and are only visually hidden, so every field is still in
   * this FormData. Unmounting them would silently drop whatever the founder already typed.
   */
  function submissionData(form: HTMLFormElement, submitter: HTMLElement | null): FormData {
    const data = new FormData(form, submitter);
    data.delete("logo");
    if (logo) data.append("logo", logo, logo.name);
    data.delete("screenshots");
    data.delete("screenshotAlt");
    for (const [index, screenshot] of screenshots.entries()) {
      data.append("screenshots", screenshot, screenshot.name);
      data.append("screenshotAlt", screenshotAlts[index] ?? "");
    }
    return data;
  }

  function handleFormInput(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) && isSubmissionField(target.name)) {
      clearFieldError(target.name);
    }
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const nextLogo = event.target.files?.[0] ?? null;
    const nextError = logoFileError(nextLogo);
    setLogo(nextLogo);
    setFieldErrors((current) => {
      const next = { ...current };
      if (nextError) next.logo = nextError;
      else delete next.logo;
      return next;
    });
  }

  function handleScreenshotsChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const nextError = screenshotFilesError(selected);
    if (nextError) {
      setScreenshots([]);
      setScreenshotAlts([]);
      event.target.value = "";
      setFieldErrors((current) => ({ ...current, screenshots: nextError }));
      focusField("screenshots");
      return;
    }
    setScreenshots(selected);
    setScreenshotAlts(selected.map(() => ""));
    clearFieldError("screenshots");
  }

  function removeScreenshot(index: number) {
    setScreenshots((items) => items.filter((_, itemIndex) => itemIndex !== index));
    setScreenshotAlts((items) => items.filter((_, itemIndex) => itemIndex !== index));
    clearFieldError("screenshots");
    if (screenshotsInputRef.current) screenshotsInputRef.current.value = "";
  }

  async function fetchDetails() {
    const invalidWebsite = websiteFieldError(websiteUrl);
    if (invalidWebsite) {
      setFieldErrors((current) => ({ ...current, websiteUrl: invalidWebsite }));
      focusField("websiteUrl");
      return;
    }
    setFetching(true);
    setError("");
    setFetchMessage("");
    setDuplicate(null);
    try {
      const response = await fetch("/api/products/metadata", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: websiteUrl }),
      });
      const result = await response.json() as { error?: string; metadata?: Metadata; token?: string; duplicate?: Duplicate | null };
      if (!response.ok || !result.metadata) throw new Error(result.error || "We could not read that website.");

      if (!edited.current.has("name")) setName(result.metadata.productName);
      if (!edited.current.has("tagline")) setTagline(result.metadata.tagline);
      clearFieldErrors(["websiteUrl", "name", "tagline"]);
      setSuggestedLogo(result.metadata.logoUrl);
      setSuggestedScreenshot(result.metadata.screenshotUrl);
      setMetadataToken(result.token ?? "");
      setFetched(true);

      if (result.duplicate) {
        // Stay on step 1. Uploading logos and screenshots for a listing that already
        // exists wastes the founder's time, and a published match belongs in the claim
        // flow. The notice itself carries the shared-domain option.
        setDuplicate(result.duplicate);
        return;
      }
      setStep(2);
      if (result.metadata.status === "failed") setFetchMessage("We could not read the site metadata, but you can enter the details manually.");
      else if (result.metadata.status === "partial") setFetchMessage("We read part of the site. Check the details below before continuing.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "We could not read the site.";
      if (/valid public|valid product website/i.test(message)) {
        setFieldErrors((current) => ({ ...current, websiteUrl: message }));
        focusField("websiteUrl");
      } else {
        setFetched(true);
        setStep(2);
        setFetchMessage(`${message} You can still enter the details manually.`);
      }
    } finally {
      setFetching(false);
    }
  }

  function goToStep(next: SubmissionStep) {
    setError("");
    if (next <= step) { setStep(next); return; }
    const form = formRef.current;
    if (!form) return;
    const data = submissionData(form, null);
    const stepErrors = validateSubmissionStep(data, step);
    setFieldErrors((current) => ({ ...current, ...stepErrors }));
    const firstInvalid = Object.keys(stepErrors).find(isSubmissionField);
    if (firstInvalid) { focusField(firstInvalid); return; }
    setStep(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = submissionData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    const validation = validateSubmissionForm(data);
    setFieldErrors(validation);
    setError("");
    setExistingProduct(null);
    const firstInvalid = Object.keys(validation).find(isSubmissionField);
    if (firstInvalid) {
      // Send the founder back to the step that actually owns the problem.
      const owningStep = ([1, 2, 3] as SubmissionStep[]).find((candidate) => Object.keys(validateSubmissionStep(data, candidate)).includes(firstInvalid));
      if (owningStep) setStep(owningStep);
      focusField(firstInvalid);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/products", { method: "POST", body: data });
      const result = await response.json() as { error?: string; field?: unknown; product?: { slug: string; status: "draft" | "pending" }; managementUrl?: string; ownershipVerification?: { path: string; value: string }; existingProduct?: { slug: string; name: string } | null };
      if (!response.ok || !result.product || !result.managementUrl) {
        const message = result.error || "Submission failed.";
        if (isSubmissionField(result.field)) {
          const field = result.field;
          setFieldErrors((current) => ({ ...current, [field]: message }));
          focusField(field);
          return;
        }
        if (result.existingProduct) setExistingProduct(result.existingProduct);
        throw new Error(message);
      }
      setCreated({ slug: result.product.slug, status: result.product.status, managementUrl: result.managementUrl, claimPath: result.ownershipVerification?.path, claimValue: result.ownershipVerification?.value });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Submission failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (created) return <section className="submission-success" aria-live="polite">
    <span className="verified-mark">✓</span>
    <h2>{created.status === "draft" ? "Your draft is saved." : "Your startup is submitted."}</h2>
    <p>{created.status === "draft"
      ? "Verify the domain, finish any details, then submit it for review from My products."
      : "We’ll review the listing before it appears publicly. Once it’s approved you can schedule its launch week and publish updates."} The draft stays attached to your signed-in account.</p>
    {created.claimPath && created.claimValue ? <div className="private-link-box"><strong>Verify the startup’s domain</strong><p>Publish a plain-text file at <code>{created.claimPath}</code> containing this exact value, then verify it from My products.</p><code>{created.claimValue}</code></div> : null}
    <div className="button-row">
      <Link className="button button-primary" href={`/claim/${created.slug}`}>Verify ownership</Link>
      <Link className="button button-secondary" href="/my-products">My products</Link>
    </div>
    <p className="form-hint">Promotion is a separate, optional product. It becomes available from your dashboard once this listing is approved and you own it — it never affects review, ranking or launch position.</p>
  </section>;

  return <>
    <header className="page-heading">
      <p className="eyebrow">Free startup profile</p>
      <h1>Submit your startup.</h1>
      <p>Give your startup a home for its launch and everything you build next.</p>
    </header>

    <ol className="submission-steps" aria-label="Submission progress">
      {([1, 2, 3] as SubmissionStep[]).map((item) => (
        <li key={item} className={item === step ? "is-current" : item < step ? "is-done" : ""} aria-current={item === step ? "step" : undefined}>
          <button type="button" className="text-button" disabled={item > step || busy} onClick={() => goToStep(item)}>
            <span aria-hidden="true">{item}</span> {STEP_LABELS[item]}
          </button>
        </li>
      ))}
    </ol>

    <form ref={formRef} className="submission-form submission-form-compact" onSubmit={submit} onInput={handleFormInput} encType="multipart/form-data" noValidate aria-busy={busy || fetching}>
      <input type="hidden" name="metadataToken" value={metadataToken} />

      <fieldset hidden={step !== 1}>
        <legend>Your startup’s website</legend>
        <p>We’ll read the public page to fill in what we can. Everything stays editable.</p>
        <div className="form-field">
          <label htmlFor="submission-websiteUrl">Website URL</label>
          <div className="url-fetch-row">
            <input id="submission-websiteUrl" name="websiteUrl" type="url" required maxLength={2048} value={websiteUrl} onChange={(event) => { setWebsiteUrl(event.target.value); setDuplicate(null); }} placeholder="https://example.com" aria-invalid={Boolean(fieldErrors.websiteUrl)} aria-describedby={fieldDescription("websiteUrl", fieldErrors)} />
            <button className="button button-primary" type="button" disabled={fetching || !websiteUrl} onClick={fetchDetails}>{fetching ? "Fetching…" : "Fetch startup details"}</button>
          </div>
          <FieldError field="websiteUrl" errors={fieldErrors} />
        </div>
        {fetching ? <p className="form-status" role="status">Reading public page metadata securely…</p> : null}
        {fetchMessage ? <p className="form-hint" role="status">{fetchMessage}</p> : null}

        {duplicate ? <div className="duplicate-notice" role="status">
          <strong>This domain is already on FounderTrail.</strong>
          <p>{duplicate.message}</p>
          {duplicate.kind === "published" && duplicate.slug ? <Link className="button button-primary" href={`/product/${duplicate.slug}#claim`}>Claim {duplicate.name}</Link> : null}
          {duplicate.kind === "own_draft" ? <Link className="button button-secondary" href="/my-products">Continue in My products</Link> : null}
          <label className="consent-row" htmlFor="submission-distinctProduct">
            <input id="submission-distinctProduct" name="distinctProduct" type="checkbox" />
            <span>This is a genuinely different startup that happens to share the domain. Submit it as its own listing.</span>
          </label>
          <button type="button" className="text-button" onClick={() => setStep(2)}>Continue anyway</button>
        </div> : null}

        <div className="button-row">
          <button className="button button-secondary" type="button" disabled={fetching} onClick={() => { setFetched(true); goToStep(2); }}>
            {fetched ? "Continue" : "Enter details manually"}
          </button>
        </div>
      </fieldset>

      <fieldset hidden={step !== 2}>
        <legend>Startup details</legend>
        <p>Everything below stays editable before you submit.</p>
        <div className="submission-review-layout">
          <div className="submission-logo-review">
            <ProductLogo productName={name || "Startup"} productUrl={websiteUrl || null} imageUrl={logoPreview} className="submission-logo-preview" />
            <label className="file-action" htmlFor="submission-logo">Replace logo <span>Optional · PNG, JPEG or WebP · max 2 MB</span></label>
            <input ref={logoInputRef} id="submission-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} aria-invalid={Boolean(fieldErrors.logo)} aria-describedby={fieldDescription("logo", fieldErrors)} />
            <FieldError field="logo" errors={fieldErrors} />
            {logo ? <button type="button" className="text-button" onClick={() => { setLogo(null); clearFieldError("logo"); if (logoInputRef.current) logoInputRef.current.value = ""; }}>Remove replacement</button> : null}
          </div>
          <div className="submission-fields">
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="submission-name">Startup name</label>
                <input id="submission-name" name="name" required maxLength={80} value={name} onChange={(event) => { edited.current.add("name"); setName(event.target.value); }} placeholder="e.g. Atlas" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldDescription("name", fieldErrors)} />
                <FieldError field="name" errors={fieldErrors} />
              </div>
              <div className="form-field">
                <label htmlFor="submission-categoryId">Category</label>
                <select id="submission-categoryId" name="categoryId" required defaultValue="" aria-invalid={Boolean(fieldErrors.categoryId)} aria-describedby={fieldDescription("categoryId", fieldErrors)}>
                  <option value="" disabled>Choose a category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <FieldError field="categoryId" errors={fieldErrors} />
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="submission-tagline">One-line description <small>{tagline.length}/160</small></label>
              <input id="submission-tagline" name="tagline" required maxLength={160} value={tagline} onChange={(event) => { edited.current.add("tagline"); setTagline(event.target.value); }} placeholder="e.g. Turn support questions into clear, searchable answers." aria-invalid={Boolean(fieldErrors.tagline)} aria-describedby={fieldDescription("tagline", fieldErrors)} />
              <FieldError field="tagline" errors={fieldErrors} />
            </div>
            <div className="form-field"><label htmlFor="submission-useCase">What does it help people do?</label><textarea id="submission-useCase" name="useCase" maxLength={500} rows={3} placeholder="Describe the task or problem in plain language." /></div>
            <div className="form-field"><label htmlFor="submission-intendedAudience">Who is it for?</label><input id="submission-intendedAudience" name="intendedAudience" maxLength={500} placeholder="e.g. Independent SaaS founders" /></div>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="submission-pricingModel">Pricing</label>
                <select id="submission-pricingModel" name="pricingModel" required defaultValue="" aria-invalid={Boolean(fieldErrors.pricingModel)} aria-describedby={fieldDescription("pricingModel", fieldErrors)}>
                  <option value="" disabled>Choose a pricing model</option>
                  <option value="unknown">See website</option>
                  <option value="free">Free</option>
                  <option value="freemium">Freemium</option>
                  <option value="paid">Paid</option>
                  <option value="open_source">Open source</option>
                  <option value="contact">Contact sales</option>
                </select>
                <FieldError field="pricingModel" errors={fieldErrors} />
              </div>
              <div className="form-field">
                <label htmlFor="submission-startingPrice">Known starting price <small>Optional</small></label>
                <div className="price-entry">
                  <select name="pricingCurrency" defaultValue="USD" aria-label="Currency"><option>USD</option><option>EUR</option><option>GBP</option></select>
                  <input id="submission-startingPrice" name="startingPrice" type="number" min="0" step="0.01" placeholder="9.00" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="form-field">
          <label className="file-action" htmlFor="submission-screenshots">Screenshots <span>Optional · up to four · PNG, JPEG or WebP · max 5 MB each</span></label>
          <input ref={screenshotsInputRef} id="submission-screenshots" name="screenshots" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleScreenshotsChange} aria-invalid={Boolean(fieldErrors.screenshots)} aria-describedby={fieldDescription("screenshots", fieldErrors)} />
          <FieldError field="screenshots" errors={fieldErrors} />
          {suggestedScreenshot && !screenshots.length ? <div className="suggested-media"><img src={suggestedScreenshot} alt="Suggested website preview" /><p>Suggested from the website. Upload it above if you want it included in the listing.</p></div> : null}
          {screenshotPreviews.length ? <div className="upload-preview-grid">{screenshotPreviews.map(({ file, url }, index) => <div key={`${file.name}-${index}`}>
            <img src={url} alt={screenshotAlts[index] || `${name || "Startup"} screenshot preview ${index + 1}`} />
            <label className="screenshot-alt">
              <span>Describe this screenshot <small>For screen readers</small></span>
              <input type="text" maxLength={240} value={screenshotAlts[index] ?? ""} placeholder="e.g. The dashboard showing weekly activity" onChange={(event) => setScreenshotAlts((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
            </label>
            <button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeScreenshot(index)}>Remove</button>
          </div>)}</div> : null}
        </div>

        <div className="button-row">
          <button className="button button-secondary" type="button" onClick={() => goToStep(1)}>Back</button>
          <button className="button button-primary" type="button" onClick={() => goToStep(3)}>Continue</button>
        </div>
      </fieldset>

      <fieldset hidden={step !== 3}>
        <legend>Founder and review</legend>
        <div className="form-field">
          <label htmlFor="submission-contactEmail">Contact email</label>
          <input id="submission-contactEmail" name="contactEmail" type="email" required maxLength={320} defaultValue={accountEmail} placeholder="founder@example.com" aria-invalid={Boolean(fieldErrors.contactEmail)} aria-describedby={fieldDescription("contactEmail", fieldErrors, "submission-contactEmail-help")} />
          <small id="submission-contactEmail-help" className="field-help">Private. Used only for approval, managing your listing and verification. Never displayed publicly.</small>
          <FieldError field="contactEmail" errors={fieldErrors} />
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="submission-founderName">Founder name <small>Optional</small></label>
            <input id="submission-founderName" name="founderName" maxLength={120} defaultValue={accountName} placeholder="e.g. Alex Smith" />
          </div>
          <div className="form-field">
            <label htmlFor="submission-founderSocialHandle">Founder X/social handle <small>Optional</small></label>
            <input id="submission-founderSocialHandle" name="founderSocialHandle" maxLength={120} placeholder="e.g. @alexsmith" aria-invalid={Boolean(fieldErrors.founderSocialHandle)} aria-describedby={fieldDescription("founderSocialHandle", fieldErrors)} />
            <FieldError field="founderSocialHandle" errors={fieldErrors} />
          </div>
        </div>
        <p className="form-hint">Optional founder details are displayed on your startup page if provided. Your name and email are prefilled from your Google account and can be changed.</p>
        <label className="consent-row optional-marketing" htmlFor="submission-marketingOptIn"><input id="submission-marketingOptIn" name="marketingOptIn" type="checkbox" /> <span>Send me optional FounderTrail product and audience updates. You can unsubscribe at any time.</span></label>

        <div className="listing-preview" aria-label="Listing preview">
          <ProductLogo productName={name || "Startup"} productUrl={websiteUrl || null} imageUrl={logoPreview} className="listing-logo-preview" />
          <div>
            <strong>{name || "Your startup"}</strong>
            <p>{tagline || "Your one-line description will appear here."}</p>
            <small>{websiteUrl || "your website"}{screenshots.length ? ` · ${screenshots.length} screenshot${screenshots.length === 1 ? "" : "s"}` : ""}</small>
          </div>
        </div>

        <div className="consent-field">
          <label className="consent-row" htmlFor="submission-ownershipConsent"><input id="submission-ownershipConsent" name="ownershipConsent" type="checkbox" required aria-invalid={Boolean(fieldErrors.ownershipConsent)} aria-describedby={fieldDescription("ownershipConsent", fieldErrors)} /> <span>I built this startup or am authorized to submit it, and the information above is accurate. See the <Link href="/about#submission-guidelines">submission guidelines</Link>.</span></label>
          <FieldError field="ownershipConsent" errors={fieldErrors} />
        </div>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {existingProduct ? <p><Link className="button button-secondary" href={`/product/${existingProduct.slug}#claim`}>Claim {existingProduct.name}</Link></p> : null}
        <div className="button-row submit-final-button">
          <button className="button button-secondary" type="button" onClick={() => goToStep(2)}>Back</button>
          <button name="submissionStatus" value="draft" className="button button-secondary" disabled={busy} type="submit">Save draft</button>
          <button name="submissionStatus" value="pending" className="button button-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Submit for review"}</button>
        </div>
      </fieldset>
    </form>
  </>;
}
