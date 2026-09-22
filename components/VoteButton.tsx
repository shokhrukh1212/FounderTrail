"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function VoteButton({ slug, initialCount, initialActive = false }: {
  slug: string;
  initialCount: number;
  initialActive?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appliedIntent = useRef(false);
  const [active, setActive] = useState(initialActive);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function setVote(next: boolean) {
    if (busy) return;
    setBusy(true);
    setError(false);
    setActive(next);
    setCount((value) => Math.max(0, value + (next ? 1 : -1)));
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(slug)}/vote`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      const json = await response.json() as { active?: boolean; count?: number; error?: string };
      if (response.status === 401) {
        const current = `${window.location.pathname}${window.location.search}`;
        const separator = current.includes("?") ? "&" : "?";
        router.push(`/sign-in?returnTo=${encodeURIComponent(`${current}${separator}upvote=${encodeURIComponent(slug)}`)}`);
        setActive(!next);
        setCount((value) => Math.max(0, value + (next ? -1 : 1)));
        return;
      }
      if (!response.ok || typeof json.active !== "boolean" || typeof json.count !== "number") {
        throw new Error(json.error ?? "Vote failed");
      }
      setActive(json.active);
      setCount(json.count);
    } catch {
      setActive(!next);
      setCount((value) => Math.max(0, value + (next ? -1 : 1)));
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (appliedIntent.current || initialActive || searchParams.get("upvote") !== slug) return;
    appliedIntent.current = true;
    void setVote(true).then(() => {
      const next = new URL(window.location.href);
      next.searchParams.delete("upvote");
      router.replace(`${next.pathname}${next.search}${next.hash}`, { scroll: false });
    });
    // The intent should be consumed once; state updates are deliberately excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialActive, searchParams, slug]);

  return (
    <button
      type="button"
      className={`vote-button${active ? " is-active" : ""}`}
      aria-pressed={active}
      aria-label={`${active ? "Remove upvote from" : "Upvote"} ${slug}. ${count} upvotes${error ? ". Last update failed" : ""}`}
      disabled={busy}
      onClick={() => void setVote(!active)}
      title={`${count.toLocaleString()} all-time upvote${count === 1 ? "" : "s"}`}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 4 5.5 7H12v5H8v-5H4.5L10 4Z" /></svg>
      <span>{count}</span>
    </button>
  );
}
