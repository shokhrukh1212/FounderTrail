"use client";

import { useState } from "react";

export function VoteButton({ slug, initialCount, initialActive = false }: {
  slug: string;
  initialCount: number;
  initialActive?: boolean;
}) {
  const [active, setActive] = useState(initialActive);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !active;
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

  return (
    <button
      type="button"
      className={`vote-button${active ? " is-active" : ""}`}
      aria-pressed={active}
      aria-label={`${active ? "Remove upvote from" : "Upvote"} ${slug}. ${count} upvotes${error ? ". Last update failed" : ""}`}
      disabled={busy}
      onClick={toggle}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 4 5.5 7H12v5H8v-5H4.5L10 4Z" /></svg>
      <span>{count}</span>
    </button>
  );
}
