const PRO_BADGE_EXPLANATION = "Pro plan · The founder bought FounderTrail Pro (launch kit and results summary). Not identity or revenue verification.";

/**
 * The one Pro badge. It is rendered from a real active entitlement by its callers, and
 * its label says plainly that Pro is a paid plan so it is never read as a verification
 * mark — ownership verification has its own separate badge.
 */
export function ProBadge() {
  return <span className="pro-badge" tabIndex={0} role="img" aria-label={PRO_BADGE_EXPLANATION}>
    Pro
    <span className="pro-badge-tooltip" aria-hidden="true">{PRO_BADGE_EXPLANATION}</span>
  </span>;
}
