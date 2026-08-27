"use client";

import { useEffect, useState } from "react";

export function OwnerAccess({ slug }: { slug: string }) {
  const [message, setMessage] = useState("Open the private management URL issued when this product was submitted.");
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (!token) return;
    window.history.replaceState(null, "", window.location.pathname);
    fetch(`/api/owner/session/${encodeURIComponent(slug)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (response) => { if (!response.ok) throw new Error(); window.location.reload(); })
      .catch(() => setMessage("That management link is invalid or has been rotated."));
  }, [slug]);
  return <section className="owner-access"><h1>Private product management</h1><p>{message}</p></section>;
}
