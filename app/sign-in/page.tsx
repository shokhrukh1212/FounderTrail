import type { Metadata } from "next";
import { SignInForm } from "@/components/SignInForm";
import { config, isAuthConfigured } from "@/lib/config";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; error?: string }> }) {
  const { returnTo = "/", error } = await searchParams;
  return <main className="app-shell auth-page"><SignInForm returnTo={returnTo} errorCode={error} googleEnabled={isAuthConfigured() && Boolean(config.auth.googleClientId && config.auth.googleClientSecret)} /></main>;
}
