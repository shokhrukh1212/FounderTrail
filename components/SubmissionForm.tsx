"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

type Category = { slug: string; name: string };

export function SubmissionForm({ categories }: { categories: Category[] }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ slug: string; managementUrl?: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) { setStep((value) => value + 1); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/products", { method: "POST", body: new FormData(event.currentTarget) });
      const result = await response.json() as { error?: string; product?: { slug: string }; managementUrl?: string };
      if (!response.ok || !result.product) throw new Error(result.error || "Submission failed.");
      setCreated({ slug: result.product.slug, managementUrl: result.managementUrl });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Submission failed.");
    } finally { setBusy(false); }
  }

  function continueStep(form: HTMLFormElement | null) {
    if (!form) return;
    const fieldset = form.querySelector<HTMLFieldSetElement>(`fieldset[data-step="${step}"]`);
    const controls = [...(fieldset?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select") ?? [])];
    const invalid = controls.find((control) => !control.checkValidity());
    if (invalid) { invalid.reportValidity(); return; }
    setStep((value) => value + 1);
  }

  if (created) return <section className="submission-success" aria-live="polite">
    <span className="verified-mark">✓</span>
    <h2>Submission received</h2>
    <p>Your product is pending moderation. It will not appear publicly until approved.</p>
    {created.managementUrl ? <div className="private-link-box">
      <strong>Save this private management link now</strong>
      <p>For local development it is displayed once. Production delivery must use the configured email/auth adapter.</p>
      <a href={created.managementUrl}>{created.managementUrl}</a>
    </div> : null}
    <Link className="button button-secondary" href="/">Back to discovery</Link>
  </section>;

  return <form className="submission-form" onSubmit={submit} encType="multipart/form-data" noValidate>
    <div className="step-indicator" aria-label={`Step ${step} of 3`}>
      {[1,2,3].map((number) => <span key={number} className={number <= step ? "is-active" : ""}>{number}</span>)}
    </div>
    <fieldset data-step="1" hidden={step !== 1}>
      <legend>Product basics</legend>
      <p>Tell visitors what you built. Every new submission starts in moderation.</p>
      <label>Website URL<input name="websiteUrl" type="url" required maxLength={2048} placeholder="https://example.com" /></label>
      <div className="form-grid"><label>Product name<input name="name" required minLength={1} maxLength={80} /></label><label>Launch date<input name="launchDate" type="date" required /></label></div>
      <label>Short tagline<input name="tagline" required minLength={1} maxLength={180} /></label>
      <label>Full description<textarea name="description" required minLength={20} maxLength={5000} rows={7} /></label>
    </fieldset>
    <fieldset data-step="2" hidden={step !== 2}>
      <legend>Founder and mechanism</legend>
      <p>Explain how bidding works plainly. Pricing can be left blank.</p>
      <div className="form-grid"><label>Founder name<input name="founderName" required maxLength={120} /></label><label>Contact email<input name="contactEmail" type="email" required maxLength={320} /></label></div>
      <label>Founder X/social handle <small>Optional</small><input name="founderSocialHandle" maxLength={120} placeholder="@handle" /></label>
      <label>How does the bidding mechanism work?<textarea name="biddingMechanism" required minLength={10} maxLength={2000} rows={5} /></label>
      <div className="form-grid form-grid-three"><label>Minimum bid <small>Optional</small><input name="minimumBid" inputMode="decimal" placeholder="5.00" /></label><label>Current bid <small>Optional</small><input name="currentBid" inputMode="decimal" placeholder="25.00" /></label><label>Currency<input name="bidCurrency" maxLength={3} placeholder="USD" /></label></div>
    </fieldset>
    <fieldset data-step="3" hidden={step !== 3}>
      <legend>Categories and media</legend>
      <p>Select up to three categories. Images are optional and validated on the server.</p>
      <div className="category-options">{categories.map((category) => <label key={category.slug}><input type="checkbox" name="categories" value={category.slug} /> {category.name}</label>)}</div>
      <label>Product logo <small>PNG, JPEG or WebP · max 2 MB</small><input name="logo" type="file" accept="image/png,image/jpeg,image/webp" /></label>
      <label>Product screenshots <small>Up to four · max 5 MB each</small><input name="screenshots" type="file" accept="image/png,image/jpeg,image/webp" multiple /></label>
      <label>Public analytics or revenue URL <small>Optional</small><input name="publicAnalyticsUrl" type="url" maxLength={2048} /></label>
    </fieldset>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="form-actions">
      {step > 1 ? <button className="button button-secondary" type="button" onClick={() => setStep((value) => value - 1)}>Back</button> : <span />}
      {step < 3 ? <button className="button button-primary" type="button" onClick={(event) => continueStep(event.currentTarget.form)}>Continue</button> : <button className="button button-primary" disabled={busy} type="submit">{busy ? "Submitting…" : "Submit for review"}</button>}
    </div>
  </form>;
}
