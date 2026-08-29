"use client";

import { useEffect, useState } from "react";
import type { VisitorStat } from "@/lib/vemetric-stats";

function describe(stat: VisitorStat | null): string {
  if (!stat) return "Open the Vemetric dashboard";
  if (stat.source !== "vemetric") return "BidIndex's own counter — Vemetric key not configured. Opens the dashboard.";
  const synced = stat.syncedAt ? new Date(stat.syncedAt).toLocaleTimeString() : "never";
  return `Daily visitors summed across ${stat.days} day${stat.days === 1 ? "" : "s"} of Vemetric data (synced ${synced}). Opens the dashboard.`;
}

// The server render is a snapshot, so refresh while an admin sits on a moderation
// screen. Failures keep the last known number rather than blanking the stat.
export function AdminVisitorCount({ initial, dashboardUrl }: { initial: VisitorStat | null; dashboardUrl: string }) {
  const [stat, setStat] = useState(initial);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/admin/visitor-stats", { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json() as VisitorStat;
        if (active && typeof body.total === "number") setStat(body);
      } catch { /* Keep the previous value. */ }
    };
    void load();
    const timer = setInterval(load, 60_000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  return (
    <a
      className="admin-visitor-stat"
      href={dashboardUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={describe(stat)}
    >
      <span>All-time visitors</span>
      <strong>{stat ? stat.total.toLocaleString("en-US") : "—"}</strong>
      <span aria-hidden="true">↗</span>
    </a>
  );
}
