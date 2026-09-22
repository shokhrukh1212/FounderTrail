"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

function safeReturnTo(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

const authErrors: Record<string, string> = {
  access_denied: "Google sign-in was cancelled or this account is not allowed yet.",
  account_not_linked: "This email already has an account that needs to be linked securely. Contact the FounderTrail administrator.",
  email_not_verified: "Use a Google account with a verified email address.",
  oauth_callback_error: "Google could not complete sign-in. Check the callback URL and try again.",
};

export function SignInForm({ returnTo, googleEnabled, errorCode }: { returnTo: string; googleEnabled: boolean; errorCode?: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(errorCode ? authErrors[errorCode] ?? "Google sign-in could not be completed. Please try again." : "");
  const callbackURL = safeReturnTo(returnTo);

  async function signIn() {
    if (!googleEnabled || busy) return;
    setBusy(true);
    setMessage("");
    const result = await authClient.signIn.social({ provider: "google", callbackURL, errorCallbackURL: `/sign-in?returnTo=${encodeURIComponent(callbackURL)}` });
    if (result?.error) {
      setBusy(false);
      setMessage(result.error.message || "Google sign-in could not be started. Please try again.");
    }
  }

  return <div className="google-auth-card">
    <div className="google-auth-mark" aria-hidden="true">FT</div>
    <h1>Welcome to FounderTrail</h1>
    <p>Continue with Google to upvote startups, join conversations, and manage your products.</p>
    <button className="google-signin-button" type="button" disabled={!googleEnabled || busy} onClick={() => void signIn()}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.3h5.4a4.6 4.6 0 0 1-2 3v2.8h3.3c1.9-1.8 2.9-4.4 2.9-7.9Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.8c-.9.6-2.1 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2H2.9v2.9A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.3 13.6A6 6 0 0 1 6 12c0-.6.1-1.1.3-1.6V7.5H2.9A10 10 0 0 0 2 12c0 1.6.4 3.1 1 4.5l3.3-2.9Z"/><path fill="#EA4335" d="M12 6.2c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9.1 5.5l3.4 2.9C7.1 8 9.4 6.2 12 6.2Z"/></svg>
      <span>{busy ? "Opening Google…" : "Continue with Google"}</span>
    </button>
    {!googleEnabled ? <p className="auth-unavailable" role="status">Google sign-in is temporarily unavailable. The owner must add the Google OAuth settings listed in the setup guide.</p> : null}
    {message ? <p className="form-error" role="alert">{message}</p> : null}
    <p className="new-account-note"><strong>New here?</strong> Your account is created when you continue.</p>
    <div className="auth-links"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/">Back to browsing</Link></div>
  </div>;
}
