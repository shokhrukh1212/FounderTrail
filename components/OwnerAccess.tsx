"use client";

import { useEffect, useState } from "react";

export function OwnerAccess({ slug }: { slug: string }) {
  const [message, setMessage] = useState("Open the private management URL issued when this product was submitted.");
  useEffect(() => {
    const storedFragment = window.sessionStorage.getItem("bidindex-owner-fragment") ?? "";
    window.sessionStorage.removeItem("bidindex-owner-fragment");
    const fragment = window.location.hash || storedFragment;
    const parameters = new URLSearchParams(fragment.slice(1));
    const token = parameters.get("token");
    const approvalToken = parameters.get("approval");
    const credential = token ?? approvalToken;
    if (!credential) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    fetch(`/api/owner/session/${encodeURIComponent(slug)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(token ? { token } : { approvalToken }) })
      .then(async (response) => { if (!response.ok) throw new Error(); window.location.reload(); })
      .catch(() => setMessage("That management link is invalid or has been rotated."));
  }, [slug]);
  return <section className="owner-access"><h1>Private product management</h1><p>{message}</p></section>;
}
