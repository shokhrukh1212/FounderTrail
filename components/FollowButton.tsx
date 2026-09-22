"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function FollowButton({ slug, initialActive = false, initialCount, productName }: {
  slug: string;
  initialActive?: boolean;
  initialCount?: number;
  /** Names the product in the accessible label instead of leaving a bare "Follow". */
  productName?: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const response = await fetch(`/api/products/${encodeURIComponent(slug)}/follow`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    if (response.status === 401) {
      router.push(`/sign-in?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    const result = await response.json() as { active?: boolean; count?: number };
    if (response.ok && typeof result.active === "boolean") {
      setActive(result.active);
      if (typeof result.count === "number") setCount(result.count);
    }
    setBusy(false);
  }

  return <button
    type="button"
    className="button button-secondary compact-action follow-button"
    aria-pressed={active}
    aria-label={productName ? `${active ? "Following" : "Follow"} ${productName}` : undefined}
    disabled={busy}
    onClick={() => void toggle()}
  >{active ? "Following" : "Follow"}{typeof count === "number" ? ` · ${count}` : ""}</button>;
}
