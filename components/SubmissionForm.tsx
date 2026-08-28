"use client";
/* eslint-disable @next/next/no-img-element -- local object URLs and untrusted metadata previews cannot use next/image */

import Link from "next/link";
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  isSubmissionField,
  logoFileError,
  screenshotFilesError,
  validateSubmissionForm,
  websiteFieldError,
  type SubmissionField,
  type SubmissionFieldErrors,
} from "@/lib/submission-form-validation";
import { ProductLogo } from "./ProductLogo";

type Metadata = {
  productName: string;
  tagline: string;
  logoUrl: string | null;
  screenshotUrl: string | null;
  status: "success" | "partial" | "failed";
};

function FieldError({ field, errors }: { field: SubmissionField; errors: SubmissionFieldErrors }) {
  const message = errors[field];
  return message ? <span id={`submission-${field}-error`} className="field-error" role="alert">{message}</span> : null;
}

function fieldDescription(field: SubmissionField, errors: SubmissionFieldErrors, helperId?: string) {
  return [errors[field] ? `submission-${field}-error` : null, helperId].filter(Boolean).join(" ") || undefined;
}

export function SubmissionForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const screenshotsInputRef = useRef<HTMLInputElement>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [suggestedLogo, setSuggestedLogo] = useState<string | null>(null);
  const [suggestedScreenshot, setSuggestedScreenshot] = useState<string | null>(null);
  const [metadataToken, setMetadataToken] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SubmissionFieldErrors>({});
  const [fetchMessage, setFetchMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState<{ slug: string; managementUrl: string } | null>(null);
  const logoPreview = useMemo(() => logo ? URL.createObjectURL(logo) : suggestedLogo, [logo, suggestedLogo]);
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
      if (!(control instanceof HTMLElement)) return;
      control.focus({ preventScroll: true });
      control.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function submissionData(form: HTMLFormElement): FormData {
    const data = new FormData(form);
    data.delete("logo");
    if (logo) data.append("logo", logo, logo.name);
    data.delete("screenshots");
    for (const screenshot of screenshots) data.append("screenshots", screenshot, screenshot.name);
    return data;
  }

  function handleFormInput(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (target instanceof HTMLInputElement && isSubmissionField(target.name)) clearFieldError(target.name);
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
      event.target.value = "";
      setFieldErrors((current) => ({ ...current, screenshots: nextError }));
      focusField("screenshots");
      return;
    }
    setScreenshots(selected);
    clearFieldError("screenshots");
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
    try {
      const response = await fetch("/api/products/metadata", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: websiteUrl }),
      });
      const result = await response.json() as { error?: string; metadata?: Metadata; token?: string };
      if (!response.ok || !result.metadata) throw new Error(result.error || "We could not read that website.");
      setName(result.metadata.productName);
      setTagline(result.metadata.tagline);
      clearFieldErrors(["websiteUrl", "name", "tagline"]);
      setSuggestedLogo(result.metadata.logoUrl);
      setSuggestedScreenshot(result.metadata.screenshotUrl);
      setMetadataToken(result.token ?? "");
      setReviewing(true);
      if (result.metadata.status === "failed") setFetchMessage("We could not read the site metadata, but you can enter the details manually.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "We could not read the site.";
      if (/valid public|valid product website/i.test(message)) {
        setFieldErrors((current) => ({ ...current, websiteUrl: message }));
        focusField("websiteUrl");
      } else {
        setReviewing(true);
        setFetchMessage(`${message} You can still enter the details manually.`);
      }
    } finally {
      setFetching(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = submissionData(event.currentTarget);
    const validation = validateSubmissionForm(data);
    setFieldErrors(validation);
    setError("");
    const firstInvalid = Object.keys(validation).find(isSubmissionField);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/products", { method: "POST", body: data });
      const result = await response.json() as { error?: string; field?: unknown; product?: { slug: string }; managementUrl?: string };
      if (!response.ok || !result.product || !result.managementUrl) {
        const message = result.error || "Submission failed.";
        if (isSubmissionField(result.field)) {
          const field = result.field;
          setFieldErrors((current) => ({ ...current, [field]: message }));
          focusField(field);
          return;
        }
        throw new Error(message);
      }
      setCreated({ slug: result.product.slug, managementUrl: result.managementUrl });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Submission failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyManagementLink() {
    if (!created) return;
    await navigator.clipboard.writeText(created.managementUrl);
    setCopied(true);
  }

  if (created) return <section className="submission-success" aria-live="polite">
    <span className="verified-mark">✓</span>
    <h2>Your product is submitted.</h2>
    <p>We’ll review the listing before it appears publicly. Save your private management link—you’ll use it to edit the product, publish updates and connect verified data.</p>
    <div className="private-link-box">
      <strong>Save this private management link</strong>
      <p>It is shown once. Anyone with this link can manage your listing, so store it safely.</p>
      <code>{created.managementUrl}</code>
      <button className="button button-primary" type="button" onClick={copyManagementLink}>{copied ? "Copied" : "Copy management link"}</button>
    </div>
    <Link className="button button-secondary" href="/">Back to discovery</Link>
  </section>;

  return <>
    <header className="page-heading">
      <p className="eyebrow">Free product launch</p>
      <h1>Submit your bidding product.</h1>
      <p>Paste your website. We’ll prepare the basics for you—you can review everything before submitting.</p>
    </header>
    <form ref={formRef} className="submission-form submission-form-compact" onSubmit={submit} onInput={handleFormInput} encType="multipart/form-data" noValidate aria-busy={busy || fetching}>
      <fieldset>
        <legend className="sr-only">Product website</legend>
        <div className="form-field">
          <label htmlFor="submission-websiteUrl">Website URL</label>
          <div className="url-fetch-row">
            <input id="submission-websiteUrl" name="websiteUrl" type="url" required maxLength={2048} value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://example.com" aria-invalid={Boolean(fieldErrors.websiteUrl)} aria-describedby={fieldDescription("websiteUrl", fieldErrors)} />
            <button className="button button-primary" type="button" disabled={fetching || !websiteUrl} onClick={fetchDetails}>{fetching ? "Fetching…" : "Fetch product details"}</button>
          </div>
          <FieldError field="websiteUrl" errors={fieldErrors} />
        </div>
        {fetching ? <p className="form-status" role="status">Reading public page metadata securely…</p> : null}
        {fetchMessage ? <p className="form-hint" role="status">{fetchMessage}</p> : null}
        {!reviewing ? <button className="text-button" type="button" onClick={() => setReviewing(true)}>Enter details manually</button> : null}
      </fieldset>

      {reviewing ? <>
        <input type="hidden" name="metadataToken" value={metadataToken} />
        <fieldset>
          <legend>Review your listing</legend>
          <p>Everything below stays editable before you submit.</p>
          <div className="submission-review-layout">
            <div className="submission-logo-review">
              <ProductLogo productName={name || "Product"} productUrl={websiteUrl || null} imageUrl={logoPreview} className="submission-logo-preview" />
              <label className="file-action" htmlFor="submission-logo">Replace logo <span>Optional · PNG, JPEG or WebP · max 2 MB</span></label>
              <input ref={logoInputRef} id="submission-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} aria-invalid={Boolean(fieldErrors.logo)} aria-describedby={fieldDescription("logo", fieldErrors)} />
              <FieldError field="logo" errors={fieldErrors} />
              {logo ? <button type="button" className="text-button" onClick={() => { setLogo(null); clearFieldError("logo"); if (logoInputRef.current) logoInputRef.current.value = ""; }}>Remove replacement</button> : null}
            </div>
            <div className="submission-fields">
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="submission-name">Product name</label>
                  <input id="submission-name" name="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. YourHour" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldDescription("name", fieldErrors)} />
                  <FieldError field="name" errors={fieldErrors} />
                </div>
                <div className="form-field">
                  <label htmlFor="submission-launchDate">Launch date</label>
                  <input id="submission-launchDate" name="launchDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} aria-invalid={Boolean(fieldErrors.launchDate)} aria-describedby={fieldDescription("launchDate", fieldErrors)} />
                  <FieldError field="launchDate" errors={fieldErrors} />
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="submission-tagline">One-line description <small>{tagline.length}/160</small></label>
                <input id="submission-tagline" name="tagline" required maxLength={160} value={tagline} onChange={(event) => setTagline(event.target.value)} placeholder="e.g. Pay $1 more to take the top spot." aria-invalid={Boolean(fieldErrors.tagline)} aria-describedby={fieldDescription("tagline", fieldErrors)} />
                <FieldError field="tagline" errors={fieldErrors} />
              </div>
            </div>
          </div>
          <div className="listing-preview" aria-label="Listing preview">
            <ProductLogo productName={name || "Product"} productUrl={websiteUrl || null} imageUrl={logoPreview} className="listing-logo-preview" />
            <div><strong>{name || "Your product"}</strong><p>{tagline || "Your one-line description will appear here."}</p></div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Contact and founder</legend>
          <div className="form-field">
            <label htmlFor="submission-contactEmail">Contact email</label>
            <input id="submission-contactEmail" name="contactEmail" type="email" required maxLength={320} placeholder="founder@example.com" aria-invalid={Boolean(fieldErrors.contactEmail)} aria-describedby={fieldDescription("contactEmail", fieldErrors, "submission-contactEmail-help")} />
            <small id="submission-contactEmail-help" className="field-help">Private. Used only for approval, managing your listing and verification. Never displayed publicly.</small>
            <FieldError field="contactEmail" errors={fieldErrors} />
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="submission-founderName">Founder name <small>Optional</small></label>
              <input id="submission-founderName" name="founderName" maxLength={120} placeholder="e.g. Alex Smith" />
            </div>
            <div className="form-field">
              <label htmlFor="submission-founderSocialHandle">Founder X/social handle <small>Optional</small></label>
              <input id="submission-founderSocialHandle" name="founderSocialHandle" maxLength={120} placeholder="e.g. @alexsmith" aria-invalid={Boolean(fieldErrors.founderSocialHandle)} aria-describedby={fieldDescription("founderSocialHandle", fieldErrors)} />
              <FieldError field="founderSocialHandle" errors={fieldErrors} />
            </div>
          </div>
          <p className="form-hint">Optional founder details are displayed on your product page if provided.</p>
        </fieldset>

        <fieldset>
          <legend>Product screenshots <small>Optional</small></legend>
          <label className="file-action" htmlFor="submission-screenshots">Add screenshots <span>Up to four · PNG, JPEG or WebP · max 5 MB each</span></label>
          <input ref={screenshotsInputRef} id="submission-screenshots" name="screenshots" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleScreenshotsChange} aria-invalid={Boolean(fieldErrors.screenshots)} aria-describedby={fieldDescription("screenshots", fieldErrors)} />
          <FieldError field="screenshots" errors={fieldErrors} />
          {suggestedScreenshot && !screenshots.length ? <div className="suggested-media"><img src={suggestedScreenshot} alt="Suggested website preview" /><p>Suggested from the website. Upload it above if you want it included in the listing.</p></div> : null}
          {screenshotPreviews.length ? <div className="upload-preview-grid">{screenshotPreviews.map(({ file, url }, index) => <div key={`${file.name}-${index}`}><img src={url} alt={`${name || "Product"} screenshot preview ${index + 1}`} /><button type="button" aria-label={`Remove ${file.name}`} onClick={() => { setScreenshots((items) => items.filter((_, itemIndex) => itemIndex !== index)); clearFieldError("screenshots"); if (screenshotsInputRef.current) screenshotsInputRef.current.value = ""; }}>Remove</button></div>)}</div> : null}
        </fieldset>

        <div className="consent-field">
          <label className="consent-row" htmlFor="submission-ownershipConsent"><input id="submission-ownershipConsent" name="ownershipConsent" type="checkbox" required aria-invalid={Boolean(fieldErrors.ownershipConsent)} aria-describedby={fieldDescription("ownershipConsent", fieldErrors)} /> <span>I built this product or am authorized to submit it, and the information above is accurate. See the <Link href="/about#submission-guidelines">submission guidelines</Link>.</span></label>
          <FieldError field="ownershipConsent" errors={fieldErrors} />
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button button-primary submit-final-button" disabled={busy} type="submit">{busy ? "Submitting…" : "Submit for review"}</button>
      </> : null}
    </form>
  </>;
}
