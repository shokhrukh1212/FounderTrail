"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { claimSignInUrl } from "@/lib/return-to";

type Challenge = { claimId: string; fileUrl: string; fileContents: string; expiresAt: string };
type StartResult = Partial<Challenge> & { method?: "domain_file" | "manual_review"; error?: string; correlationId?: string };
type ClaimState = "claimed" | "pending" | "disputed" | "unclaimed";

/**
 * A failed request must still say something. Reading the body can itself throw -- an edge
 * error or a crashed route returns HTML, not JSON -- and the original code left the button
 * spinning forever in that case.
 */
async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

function withReference(message: string, correlationId?: string): string {
  return correlationId ? `${message} Reference: ${correlationId}` : message;
}

export function ProductClaim({ slug, signedIn, state }: { slug: string; signedIn: boolean; state: ClaimState }) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [manualPending, setManualPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function start(method: "domain_file" | "manual_review") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(slug)}/claims`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method }),
      });
      if (response.status === 401) {
        router.push(claimSignInUrl(slug));
        return;
      }
      const result = await readJson<StartResult>(response);
      if (!response.ok) {
        setMessage(withReference(result.error ?? "Could not start the claim.", result.correlationId));
        return;
      }
      if (result.method === "manual_review") {
        setManualPending(true);
        setMessage("");
        router.refresh();
        return;
      }
      setChallenge({
        claimId: result.claimId!,
        fileUrl: result.fileUrl!,
        fileContents: result.fileContents!,
        expiresAt: result.expiresAt!,
      });
    } catch {
      setMessage("Could not reach FounderTrail. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!challenge) return;
    setBusy(true);
    setMessage("Checking the domain…");
    try {
      const response = await fetch(`/api/claims/${challenge.claimId}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: challenge.fileContents.replace(/^foundertrail-claim=/, "") }),
      });
      const result = await readJson<{ error?: string; disputed?: boolean; correlationId?: string }>(response);
      if (response.ok) {
        setMessage(result.disputed
          ? "Domain control was verified. The competing claim is waiting for administrator review."
          : "");
        router.refresh();
        return;
      }
      setMessage(withReference(result.error ?? "We could not verify the file yet.", result.correlationId));
    } catch {
      setMessage("Could not reach FounderTrail. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "disputed") {
    return (
      <section id="claim" className="detail-section claim-section">
        <p className="eyebrow">Ownership dispute</p>
        <h2>Manual review pending</h2>
        <p className="long-copy">Domain control was verified, but this listing already has an owner. FounderTrail will review the competing evidence; the current owner remains attached unless an administrator completes a documented resolution.</p>
      </section>
    );
  }

  const owned = state === "claimed";
  const startLabel = state === "pending" ? "Continue or refresh domain proof" : owned ? "Verify domain and open dispute" : "Start domain verification";

  return (
    <section id="claim" className="detail-section claim-section">
      <p className="eyebrow">Ownership</p>
      <h2>{owned ? "Request an ownership review" : "Claim this startup"}</h2>
      <p className="long-copy">{owned
        ? "This listing already has a verified owner. If that ownership is incorrect, verify current control of the product domain to open a competing claim for manual review. Domain proof does not replace the current owner automatically."
        : "Verify control of the startup’s domain to manage its profile, publish updates, and see private reports. This does not change its existing history."}</p>

      {!signedIn ? (
        <Link className="button button-secondary" href={claimSignInUrl(slug)}>Sign in to claim</Link>
      ) : manualPending ? (
        <p className="form-message" role="status">Your claim is waiting for administrator review. You can close this page; nothing else is needed right now.</p>
      ) : !challenge ? (
        <div className="claim-actions">
          <button className="button button-secondary" disabled={busy} onClick={() => void start("domain_file")}>{startLabel}</button>
          <button className="text-button" type="button" disabled={busy} onClick={() => void start("manual_review")}>
            I can’t publish a file — request manual review
          </button>
        </div>
      ) : (
        <div className="claim-challenge">
          <p>Publish this one-line text file on your startup’s domain:</p>
          <dl>
            <div><dt>File</dt><dd><code>{challenge.fileUrl}</code></dd></div>
            <div><dt>Contents</dt><dd><code>{challenge.fileContents}</code></dd></div>
            <div><dt>Expires</dt><dd>{new Date(challenge.expiresAt).toLocaleString()}</dd></div>
          </dl>
          <button className="button button-primary" disabled={busy} onClick={() => void verify()}>Check verification file</button>
          <button className="text-button" type="button" disabled={busy} onClick={() => void start("manual_review")}>
            Request manual review instead
          </button>
        </div>
      )}

      {message ? <p className="form-message" role="status">{message}</p> : null}
    </section>
  );
}
