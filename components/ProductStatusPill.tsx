const STATUS_LABELS: Record<string, string> = {
  published: "Live",
  pending: "Pending review",
  rejected: "Changes requested",
  draft: "Draft",
  archived: "Archived",
};

/** An owner-facing listing status, coloured so live and waiting listings are told apart at a glance. */
export function ProductStatusPill({ status }: { status: string }) {
  const tone = status in STATUS_LABELS ? status : "draft";
  return <span className={`product-status-pill is-${tone}`}>{STATUS_LABELS[status] ?? status.replaceAll("_", " ")}</span>;
}
